from __future__ import annotations

import re
from datetime import datetime
from typing import Any, Dict, List

import httpx

from ..config import Config
from .base_service import (
    availability_status,
    build_reference,
    build_search_response,
    combine_date_and_time,
    demand_multiplier,
    derive_inventory,
    derive_price,
    format_duration,
    load_dataset,
    normalize_lookup,
    sort_items,
    weekday_matches,
)


FLIGHT_ALIASES = {
    "DELHI": "DEL",
    "DEL": "DEL",
    "GOA": "GOI",
    "GOI": "GOI",
    "MUMBAI": "BOM",
    "BOMBAY": "BOM",
    "BOM": "BOM",
    "BENGALURU": "BLR",
    "BANGALORE": "BLR",
    "BLR": "BLR",
    "DALLAS": "DFW",
    "DFW": "DFW",
    "NEW YORK": "JFK",
    "NYC": "JFK",
    "JFK": "JFK",
    "LONDON": "LHR",
    "LON": "LHR",
    "LHR": "LHR",
    "PARIS": "CDG",
    "CDG": "CDG",
    "DUBAI": "DXB",
    "DXB": "DXB",
    "SINGAPORE": "SIN",
    "SIN": "SIN",
}

SERPAPI_FLIGHT_SORT_MAPPING = {
    "cheapest": "1",
    "earliest_departure": "2",
    "fastest": "3",
}


class FlightService:
    dataset_name = "flights.json"
    supported_sorting = ("cheapest", "fastest", "earliest_departure")

    def _records(self) -> List[Dict[str, Any]]:
        return load_dataset(self.dataset_name)

    async def search(
        self,
        origin: str,
        destination: str,
        date: str,
        sort_by: str = "cheapest",
    ) -> Dict[str, Any]:
        Config.refresh()
        normalized_origin = normalize_lookup(origin, FLIGHT_ALIASES)
        normalized_destination = normalize_lookup(destination, FLIGHT_ALIASES)
        selected_sort = sort_by if sort_by in self.supported_sorting else "cheapest"

        if Config.FLIGHT_PROVIDER == "serpapi":
            try:
                return await self._search_serpapi(
                    origin=origin,
                    destination=destination,
                    normalized_origin=normalized_origin,
                    normalized_destination=normalized_destination,
                    date=date,
                    sort_by=selected_sort,
                )
            except Exception as exc:
                local_response = self._search_local(
                    origin=origin,
                    destination=destination,
                    normalized_origin=normalized_origin,
                    normalized_destination=normalized_destination,
                    date=date,
                    sort_by=selected_sort,
                )
                local_response["fallback_used"] = True
                local_response["fallback_reason"] = f"SerpApi flight search failed: {exc}"
                local_response["provider_requested"] = "serpapi"
                return local_response

        return self._search_local(
            origin=origin,
            destination=destination,
            normalized_origin=normalized_origin,
            normalized_destination=normalized_destination,
            date=date,
            sort_by=selected_sort,
        )

    def _search_local(
        self,
        *,
        origin: str,
        destination: str,
        normalized_origin: str,
        normalized_destination: str,
        date: str,
        sort_by: str,
    ) -> Dict[str, Any]:
        matched_items: List[Dict[str, Any]] = []
        for record in self._records():
            if record.get("origin") != normalized_origin or record.get("destination") != normalized_destination:
                continue
            if not weekday_matches(date, record.get("days_of_week", [])):
                continue

            demand_factor = demand_multiplier(
                record["flight_id"],
                date,
                float(record.get("route_popularity", 0.75)),
            )
            fare_options = self._build_local_fare_options(record, date, demand_factor)
            if not fare_options:
                continue

            total_seats_left = sum(option["seats_left"] for option in fare_options)
            matched_items.append(
                {
                    "flight_id": record["flight_id"],
                    "airline": record["airline"],
                    "airline_code": record["airline_code"],
                    "flight_number": record["flight_number"],
                    "origin": record["origin"],
                    "destination": record["destination"],
                    "origin_city": record["origin_city"],
                    "destination_city": record["destination_city"],
                    "departure_time": combine_date_and_time(date, record["departure_time"]),
                    "arrival_time": combine_date_and_time(
                        date,
                        record["arrival_time"],
                        int(record.get("arrival_day_offset", 0)),
                    ),
                    "duration_minutes": int(record["duration_minutes"]),
                    "duration": format_duration(int(record["duration_minutes"])),
                    "stops": int(record.get("stops", 0)),
                    "aircraft": record.get("aircraft"),
                    "baggage": record.get("baggage"),
                    "currency": "INR",
                    "display_price": min(option["price"] for option in fare_options),
                    "availability_status": availability_status(total_seats_left, threshold=18),
                    "seats_available": total_seats_left,
                    "fare_options": fare_options,
                }
            )

        sorted_items = self._sort_items(matched_items, sort_by)
        return build_search_response(
            "flight",
            {
                "requested_origin": origin,
                "requested_destination": destination,
                "origin": normalized_origin,
                "destination": normalized_destination,
                "date": date,
                "sort_by": sort_by,
            },
            sorted_items,
            supported_sorting=self.supported_sorting,
        )

    async def _search_serpapi(
        self,
        *,
        origin: str,
        destination: str,
        normalized_origin: str,
        normalized_destination: str,
        date: str,
        sort_by: str,
    ) -> Dict[str, Any]:
        if not Config.SERPAPI_API_KEY:
            raise RuntimeError("SERPAPI_API_KEY is missing.")

        departure_id = await self._resolve_serpapi_location_id(origin, normalized_origin)
        arrival_id = await self._resolve_serpapi_location_id(destination, normalized_destination)
        params: Dict[str, Any] = {
            "engine": "google_flights",
            "departure_id": departure_id,
            "arrival_id": arrival_id,
            "outbound_date": date,
            "type": "2",
            "adults": "1",
            "currency": Config.SERPAPI_CURRENCY,
            "gl": Config.SERPAPI_GL,
            "hl": Config.SERPAPI_HL,
            "api_key": Config.SERPAPI_API_KEY,
        }
        serp_sort = SERPAPI_FLIGHT_SORT_MAPPING.get(sort_by)
        if serp_sort:
            params["sort_by"] = serp_sort

        payload = await self._fetch_serpapi_payload(params)
        items = self._normalize_serpapi_items(
            payload,
            normalized_origin=normalized_origin,
            normalized_destination=normalized_destination,
        )
        sorted_items = self._sort_items(items, sort_by)

        response = build_search_response(
            "flight",
            {
                "requested_origin": origin,
                "requested_destination": destination,
                "origin": departure_id,
                "destination": arrival_id,
                "date": date,
                "sort_by": sort_by,
            },
            sorted_items,
            provider="serpapi",
            supported_sorting=self.supported_sorting,
        )
        response["live_data"] = True
        if isinstance(payload.get("price_insights"), dict):
            response["price_insights"] = payload["price_insights"]
        if isinstance(payload.get("search_information"), dict):
            response["search_information"] = payload["search_information"]
        live_error = str(payload.get("error") or "").strip()
        if response["status"] == "no_results":
            response["message"] = live_error or "No live Google Flights results were returned for this route and date."
            response["no_results_source"] = "serpapi_google_flights"
        return response

    async def _resolve_serpapi_location_id(self, raw_value: str, normalized_value: str) -> str:
        candidate = str(normalized_value or "").strip().upper()
        if re.fullmatch(r"[A-Z]{3}", candidate):
            return candidate
        if candidate.startswith("/M/") or candidate.startswith("/G/"):
            return candidate.lower()

        payload = await self._fetch_serpapi_payload(
            {
                "engine": "google_flights_autocomplete",
                "q": str(raw_value or "").strip(),
                "gl": Config.SERPAPI_GL,
                "hl": Config.SERPAPI_HL,
                "exclude_regions": "true",
                "api_key": Config.SERPAPI_API_KEY,
            }
        )
        suggestions = payload.get("suggestions")
        if not isinstance(suggestions, list):
            raise RuntimeError(f"Could not resolve flight location for '{raw_value}'.")

        query = str(raw_value or "").strip().lower()
        best_city_match = None
        fallback_airport = None
        for suggestion in suggestions:
            if not isinstance(suggestion, dict):
                continue
            airports = suggestion.get("airports") or []
            if not isinstance(airports, list) or not airports:
                continue

            if fallback_airport is None:
                airport_id = str((airports[0] or {}).get("id") or "").strip().upper()
                if airport_id:
                    fallback_airport = airport_id

            suggestion_name = str(suggestion.get("name") or "").strip().lower()
            suggestion_type = str(suggestion.get("type") or "").strip().lower()
            if suggestion_type == "city" and query and query in suggestion_name:
                airport_id = str((airports[0] or {}).get("id") or "").strip().upper()
                if airport_id:
                    best_city_match = airport_id
                    break

        if best_city_match:
            return best_city_match
        if fallback_airport:
            return fallback_airport
        raise RuntimeError(f"Could not resolve flight location for '{raw_value}'.")

    async def _fetch_serpapi_payload(self, params: Dict[str, Any]) -> Dict[str, Any]:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                Config.SERPAPI_BASE_URL,
                params=params,
                timeout=float(Config.SERPAPI_TIMEOUT_SECONDS),
            )
        if response.is_error:
            detail = response.text.strip()
            try:
                parsed = response.json()
                if isinstance(parsed, dict) and parsed.get("error"):
                    detail = str(parsed["error"])
            except ValueError:
                pass
            raise RuntimeError(f"SerpApi request failed with HTTP {response.status_code}: {detail}")
        payload = response.json()
        if not isinstance(payload, dict):
            raise RuntimeError("SerpApi returned an unexpected response shape.")
        error_message = str(payload.get("error") or "").strip()
        if error_message and "hasn't returned any results" not in error_message.lower():
            raise RuntimeError(error_message)
        return payload

    def _normalize_serpapi_items(
        self,
        payload: Dict[str, Any],
        *,
        normalized_origin: str,
        normalized_destination: str,
    ) -> List[Dict[str, Any]]:
        raw_items: List[Dict[str, Any]] = []
        for section in ("best_flights", "other_flights"):
            section_items = payload.get(section)
            if isinstance(section_items, list):
                raw_items.extend(item for item in section_items if isinstance(item, dict))

        normalized_items: List[Dict[str, Any]] = []
        for item in raw_items:
            segments = item.get("flights") or []
            if not segments:
                continue

            first_segment = segments[0]
            last_segment = segments[-1]
            departure_time = self._parse_serpapi_datetime(
                ((first_segment.get("departure_airport") or {}).get("time"))
            )
            arrival_time = self._parse_serpapi_datetime(
                ((last_segment.get("arrival_airport") or {}).get("time"))
            )
            duration_minutes = int(item.get("total_duration") or 0)
            if not duration_minutes:
                duration_minutes = sum(int(segment.get("duration") or 0) for segment in segments)

            price = float(item.get("price") or 0)
            flight_number_text = str(first_segment.get("flight_number") or "").strip()
            airline_name = str(first_segment.get("airline") or "Unknown airline").strip()
            airline_code = self._derive_airline_code(
                first_segment,
                flight_number_text,
                airline_name,
            )

            extensions = [str(entry) for entry in (item.get("extensions") or []) if str(entry).strip()]
            travel_class = extensions[0] if extensions else "Best available"
            flight_id = str(item.get("departure_token") or item.get("booking_token") or flight_number_text or departure_time)
            normalized_items.append(
                {
                    "flight_id": flight_id,
                    "airline": airline_name,
                    "airline_code": airline_code,
                    "flight_number": flight_number_text or airline_code,
                    "origin": ((first_segment.get("departure_airport") or {}).get("id") or normalized_origin).upper(),
                    "destination": ((last_segment.get("arrival_airport") or {}).get("id") or normalized_destination).upper(),
                    "origin_city": (first_segment.get("departure_airport") or {}).get("name") or normalized_origin,
                    "destination_city": (last_segment.get("arrival_airport") or {}).get("name") or normalized_destination,
                    "departure_time": departure_time,
                    "arrival_time": arrival_time,
                    "duration_minutes": duration_minutes,
                    "duration": format_duration(duration_minutes) if duration_minutes else "Unknown",
                    "stops": max(len(segments) - 1, 0),
                    "aircraft": first_segment.get("airplane"),
                    "baggage": self._extract_baggage_hint(extensions),
                    "currency": Config.SERPAPI_CURRENCY,
                    "display_price": price,
                    "availability_status": "available" if price > 0 else "unknown",
                    "seats_available": None,
                    "fare_options": [
                        {
                            "code": self._to_fare_code(travel_class),
                            "name": travel_class,
                            "price": price,
                            "currency": Config.SERPAPI_CURRENCY,
                            "seats_left": None,
                            "availability_status": "unknown",
                        }
                    ],
                    "departure_token": item.get("departure_token"),
                    "booking_token": item.get("booking_token"),
                    "carbon_emissions": item.get("carbon_emissions"),
                    "extensions": extensions,
                    "layovers": item.get("layovers") or [],
                }
            )

        return normalized_items

    def _build_local_fare_options(
        self,
        record: Dict[str, Any],
        date: str,
        demand_factor: float,
    ) -> List[Dict[str, Any]]:
        options: List[Dict[str, Any]] = []
        for fare in record.get("fare_classes", []):
            fare_code = fare["code"]
            seats_left = derive_inventory(
                f"{record['flight_id']}:{fare_code}",
                date,
                int(fare["base_inventory"]),
                demand_factor,
                float(fare.get("demand_weight", 1.0)),
            )
            if seats_left <= 0:
                continue

            premium_weight = max(float(fare.get("base_price", 0)) / 20000, 0.85)
            price = derive_price(
                f"{record['flight_id']}:{fare_code}",
                date,
                float(fare["base_price"]),
                demand_factor,
                premium_weight=premium_weight,
            )
            options.append(
                {
                    "code": fare_code,
                    "name": fare["name"],
                    "price": price,
                    "currency": "INR",
                    "seats_left": seats_left,
                    "availability_status": availability_status(seats_left, threshold=8),
                }
            )

        return sorted(options, key=lambda option: option["price"])

    def _sort_items(self, items: List[Dict[str, Any]], sort_by: str) -> List[Dict[str, Any]]:
        return sort_items(
            items,
            sort_by,
            {
                "cheapest": lambda item: (item["display_price"], item["departure_time"]),
                "fastest": lambda item: (item["duration_minutes"], item["display_price"]),
                "earliest_departure": lambda item: (item["departure_time"], item["display_price"]),
            },
            default_sort="cheapest",
        )

    def _parse_serpapi_datetime(self, raw_value: Any) -> str:
        text = str(raw_value or "").strip()
        if not text:
            return ""
        for fmt in ("%Y-%m-%d %I:%M %p", "%Y-%m-%d %H:%M"):
            try:
                return datetime.strptime(text, fmt).isoformat(timespec="seconds")
            except ValueError:
                continue
        return text

    def _derive_airline_code(
        self,
        segment: Dict[str, Any],
        flight_number_text: str,
        airline_name: str,
    ) -> str:
        for key in ("airline_code", "carrier_code", "airline_id"):
            value = str(segment.get(key) or "").strip().upper()
            if value:
                return value

        compact_number = flight_number_text.replace(" ", "")
        match = re.match(r"([A-Z0-9]{2,3})", compact_number)
        if match:
            return match.group(1)

        letters = re.findall(r"[A-Z]", airline_name.upper())
        return "".join(letters[:2]) or "NA"

    def _extract_baggage_hint(self, extensions: List[str]) -> str | None:
        for entry in extensions:
            lowered = entry.lower()
            if "bag" in lowered or "carry" in lowered or "baggage" in lowered:
                return entry
        return None

    def _to_fare_code(self, travel_class: str) -> str:
        normalized = re.sub(r"[^A-Z0-9]+", "_", str(travel_class or "").upper()).strip("_")
        return normalized or "BEST_AVAILABLE"

    def book(
        self,
        flight_id: str,
        passenger_name: str,
        passport_number: str,
        payment_confirmed: bool = False,
        payment_reference: str = "",
    ) -> Dict[str, Any]:
        reference_seed = (flight_id, passenger_name, passport_number[-4:])
        if not payment_confirmed:
            return {
                "status": "pending_payment",
                "reservation_reference": build_reference("FLH", *reference_seed),
                "flight_id": flight_id,
                "passenger": passenger_name,
                "provider": "local_dataset",
                "passport_last4": str(passport_number)[-4:],
                "message": "Flight selection saved, but payment is still required before the booking can be confirmed.",
                "next_step": "Create or complete payment first, then confirm the booking.",
            }

        return {
            "status": "confirmed",
            "booking_reference": build_reference("FLB", *reference_seed, payment_reference or "CONFIRMED"),
            "flight_id": flight_id,
            "passenger": passenger_name,
            "provider": "local_dataset",
            "passport_last4": str(passport_number)[-4:],
            "payment_reference": payment_reference or None,
        }


flight_service = FlightService()
