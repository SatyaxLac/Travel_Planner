from __future__ import annotations

import re
from datetime import timedelta
from typing import Any, Dict, List

import httpx

from ..config import Config
from .base_service import (
    availability_status,
    build_search_response,
    demand_multiplier,
    derive_inventory,
    derive_price,
    load_dataset,
    normalize_lookup,
    parse_date,
    sort_items,
)


HOTEL_ALIASES = {
    "GOA": "GOA",
    "PANAJI": "GOA",
    "LUCKNOW": "LUCKNOW",
    "LKO": "LUCKNOW",
    "LONDON": "LONDON",
    "LON": "LONDON",
    "PARIS": "PARIS",
    "CDG": "PARIS",
    "DUBAI": "DUBAI",
    "DXB": "DUBAI",
    "SINGAPORE": "SINGAPORE",
    "SIN": "SINGAPORE",
}

SERPAPI_SORT_MAPPING = {
    "cheapest": "3",
    "highest_rated": "8",
}


class HotelService:
    dataset_name = "hotels.json"
    supported_sorting = (
        "cheapest",
        "highest_rated",
        "fastest",
        "earliest_check_in",
        "earliest_departure",
    )

    def _records(self) -> List[Dict[str, Any]]:
        return load_dataset(self.dataset_name)

    async def search(
        self,
        destination: str,
        date: str,
        nights: int = 1,
        rooms: int = 1,
        sort_by: str = "cheapest",
    ) -> Dict[str, Any]:
        Config.refresh()
        normalized_destination = normalize_lookup(destination, HOTEL_ALIASES)
        requested_nights = max(int(nights), 1)
        requested_rooms = max(int(rooms), 1)
        selected_sort = self._normalize_sort(sort_by)

        if Config.HOTEL_PROVIDER == "serpapi":
            try:
                return await self._search_serpapi(
                    destination=destination,
                    normalized_destination=normalized_destination,
                    date=date,
                    nights=requested_nights,
                    rooms=requested_rooms,
                    sort_by=selected_sort,
                )
            except Exception as exc:
                local_response = self._search_local(
                    destination=destination,
                    normalized_destination=normalized_destination,
                    date=date,
                    nights=requested_nights,
                    rooms=requested_rooms,
                    sort_by=selected_sort,
                )
                local_response["fallback_used"] = True
                local_response["fallback_reason"] = f"SerpApi hotel search failed: {exc}"
                local_response["provider_requested"] = "serpapi"
                return local_response

        return self._search_local(
            destination=destination,
            normalized_destination=normalized_destination,
            date=date,
            nights=requested_nights,
            rooms=requested_rooms,
            sort_by=selected_sort,
        )

    def _search_local(
        self,
        destination: str,
        normalized_destination: str,
        date: str,
        nights: int,
        rooms: int,
        sort_by: str,
    ) -> Dict[str, Any]:
        matched_items: List[Dict[str, Any]] = []
        for record in self._records():
            if normalize_lookup(record.get("city", ""), HOTEL_ALIASES) != normalized_destination:
                continue

            demand_factor = demand_multiplier(
                record["hotel_id"],
                date,
                float(record.get("city_popularity", 0.75)),
                weekend_boost=0.14,
                peak_month_boost=0.12,
            )
            room_options = self._build_local_room_options(record, date, nights, rooms, demand_factor)
            if not room_options:
                continue

            total_rooms_left = sum(option["rooms_left"] for option in room_options)
            matched_items.append(
                {
                    "hotel_id": record["hotel_id"],
                    "hotel_name": record["name"],
                    "city": record["city"],
                    "country": record["country"],
                    "area": record["area"],
                    "property_type": record.get("property_type"),
                    "rating": float(record["rating"]),
                    "review_count": int(record["review_count"]),
                    "check_in_from": record["check_in_from"],
                    "check_out_until": record["check_out_until"],
                    "airport_transfer_minutes": int(record["airport_transfer_minutes"]),
                    "distance_to_center_km": float(record["distance_to_center_km"]),
                    "amenities": list(record.get("amenities", [])),
                    "currency": "INR",
                    "display_price_per_night": min(option["price_per_night"] for option in room_options),
                    "display_total_price": min(option["total_price"] for option in room_options),
                    "availability_status": availability_status(total_rooms_left, threshold=6),
                    "rooms_available": total_rooms_left,
                    "room_options": room_options,
                }
            )

        sorted_items = self._sort_items(matched_items, sort_by)
        return build_search_response(
            "hotel",
            {
                "requested_destination": destination,
                "destination": normalized_destination,
                "date": date,
                "nights": nights,
                "rooms": rooms,
                "sort_by": sort_by,
            },
            sorted_items,
            supported_sorting=self.supported_sorting,
        )

    async def _search_serpapi(
        self,
        *,
        destination: str,
        normalized_destination: str,
        date: str,
        nights: int,
        rooms: int,
        sort_by: str,
    ) -> Dict[str, Any]:
        if not Config.SERPAPI_API_KEY:
            raise RuntimeError("SERPAPI_API_KEY is missing.")

        check_in_date = parse_date(date)
        check_out_date = check_in_date + timedelta(days=nights)
        adults = max(2, min(rooms * 2, 8))
        params: Dict[str, Any] = {
            "engine": "google_hotels",
            "q": destination,
            "check_in_date": check_in_date.strftime("%Y-%m-%d"),
            "check_out_date": check_out_date.strftime("%Y-%m-%d"),
            "adults": adults,
            "children": 0,
            "gl": Config.SERPAPI_GL,
            "hl": Config.SERPAPI_HL,
            "currency": Config.SERPAPI_CURRENCY,
            "api_key": Config.SERPAPI_API_KEY,
        }
        serp_sort = SERPAPI_SORT_MAPPING.get(sort_by)
        if serp_sort:
            params["sort_by"] = serp_sort

        payload = await self._fetch_serpapi_payload(params)
        items = self._normalize_serpapi_items(
            payload,
            destination=destination,
            normalized_destination=normalized_destination,
            nights=nights,
            rooms=rooms,
        )
        sorted_items = self._sort_items(items, sort_by)

        response = build_search_response(
            "hotel",
            {
                "requested_destination": destination,
                "destination": normalized_destination,
                "date": date,
                "nights": nights,
                "rooms": rooms,
                "sort_by": sort_by,
            },
            sorted_items,
            provider="serpapi",
            supported_sorting=self.supported_sorting,
        )
        response["live_data"] = True
        return response

    async def _fetch_serpapi_payload(self, params: Dict[str, Any]) -> Dict[str, Any]:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                Config.SERPAPI_BASE_URL,
                params=params,
                timeout=float(Config.SERPAPI_TIMEOUT_SECONDS),
            )
        response.raise_for_status()
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
        destination: str,
        normalized_destination: str,
        nights: int,
        rooms: int,
    ) -> List[Dict[str, Any]]:
        properties = payload.get("properties")
        if not isinstance(properties, list):
            properties = []

        if not properties and payload.get("property_token"):
            properties = [payload]

        normalized_items: List[Dict[str, Any]] = []
        for property_item in properties:
            if not isinstance(property_item, dict):
                continue

            hotel_name = str(property_item.get("name") or "").strip()
            hotel_id = str(property_item.get("property_token") or hotel_name or "").strip()
            if not hotel_id:
                continue

            price_per_night = self._extract_price_per_night(property_item)
            total_price = self._extract_total_price(property_item, price_per_night, nights, rooms)
            room_option = {
                "code": "BEST_AVAILABLE",
                "name": "Best available room",
                "price_per_night": price_per_night,
                "total_price": total_price,
                "currency": Config.SERPAPI_CURRENCY,
                "rooms_left": max(rooms, 1),
                "max_guests": max(rooms * 2, 2),
                "breakfast_included": self._infer_breakfast(property_item),
                "availability_status": "available" if price_per_night > 0 else "limited",
            }

            booking_sources = self._extract_booking_sources(property_item)
            normalized_items.append(
                {
                    "hotel_id": hotel_id,
                    "hotel_name": hotel_name or destination,
                    "city": destination,
                    "country": self._extract_country(property_item),
                    "area": self._extract_area(property_item, normalized_destination),
                    "property_type": property_item.get("type") or property_item.get("hotel_class") or "Hotel",
                    "rating": float(property_item.get("overall_rating") or 0.0),
                    "review_count": int(property_item.get("reviews") or 0),
                    "check_in_from": self._normalize_time_text(property_item.get("check_in_time")),
                    "check_out_until": self._normalize_time_text(property_item.get("check_out_time")),
                    "airport_transfer_minutes": self._extract_transfer_minutes(property_item),
                    "distance_to_center_km": 0.0,
                    "amenities": list(property_item.get("amenities") or []),
                    "currency": Config.SERPAPI_CURRENCY,
                    "display_price_per_night": price_per_night,
                    "display_total_price": total_price,
                    "availability_status": "available" if price_per_night > 0 else "limited",
                    "rooms_available": max(rooms, 1),
                    "room_options": [room_option],
                    "booking_url": property_item.get("link"),
                    "free_cancellation": bool(property_item.get("free_cancellation")),
                    "booking_sources": booking_sources,
                    "serpapi_property_details_link": property_item.get("serpapi_property_details_link"),
                }
            )

        return normalized_items

    def _build_local_room_options(
        self,
        record: Dict[str, Any],
        date: str,
        nights: int,
        rooms: int,
        demand_factor: float,
    ) -> List[Dict[str, Any]]:
        options: List[Dict[str, Any]] = []
        for room in record.get("room_types", []):
            room_code = room["code"]
            rooms_left = derive_inventory(
                f"{record['hotel_id']}:{room_code}",
                date,
                int(room["base_inventory"]),
                demand_factor,
                float(room.get("demand_weight", 1.0)),
            )
            if rooms_left < rooms:
                continue

            premium_weight = max(float(room.get("base_price_per_night", 0)) / 12000, 0.82)
            price_per_night = derive_price(
                f"{record['hotel_id']}:{room_code}",
                date,
                float(room["base_price_per_night"]),
                demand_factor,
                premium_weight=premium_weight,
            )
            total_price = round(price_per_night * nights * rooms, 2)
            options.append(
                {
                    "code": room_code,
                    "name": room["name"],
                    "price_per_night": price_per_night,
                    "total_price": total_price,
                    "currency": "INR",
                    "rooms_left": rooms_left,
                    "max_guests": int(room["max_guests"]),
                    "breakfast_included": bool(room["breakfast_included"]),
                    "availability_status": availability_status(rooms_left, threshold=4),
                }
            )

        return sorted(options, key=lambda option: option["total_price"])

    def _sort_items(self, items: List[Dict[str, Any]], sort_by: str) -> List[Dict[str, Any]]:
        return sort_items(
            items,
            sort_by,
            {
                "cheapest": lambda item: (item["display_total_price"], -item["rating"]),
                "highest_rated": lambda item: (-item["rating"], item["display_total_price"]),
                "fastest": lambda item: (item["airport_transfer_minutes"], item["display_total_price"]),
                "earliest_check_in": lambda item: (item["check_in_from"], item["display_total_price"]),
                "earliest_departure": lambda item: (item["check_in_from"], item["display_total_price"]),
            },
            default_sort="cheapest",
        )

    def _normalize_sort(self, sort_by: str) -> str:
        normalized = str(sort_by or "").strip().lower()
        if normalized in self.supported_sorting:
            return normalized
        return "cheapest"

    def _extract_price_per_night(self, property_item: Dict[str, Any]) -> float:
        rate_per_night = property_item.get("rate_per_night") or {}
        if isinstance(rate_per_night, dict):
            extracted = rate_per_night.get("extracted_lowest") or rate_per_night.get("extracted_before_taxes_fees")
            if extracted:
                return round(float(extracted), 2)

        extracted_price = property_item.get("extracted_price")
        if extracted_price:
            return round(float(extracted_price), 2)

        return 0.0

    def _extract_total_price(
        self,
        property_item: Dict[str, Any],
        price_per_night: float,
        nights: int,
        rooms: int,
    ) -> float:
        total_rate = property_item.get("total_rate") or {}
        if isinstance(total_rate, dict):
            extracted = total_rate.get("extracted_lowest") or total_rate.get("extracted_before_taxes_fees")
            if extracted:
                return round(float(extracted), 2)
        return round(price_per_night * max(nights, 1) * max(rooms, 1), 2)

    def _extract_booking_sources(self, property_item: Dict[str, Any]) -> List[Dict[str, Any]]:
        sources: List[Dict[str, Any]] = []
        prices = property_item.get("prices") or []
        for price_item in prices:
            if not isinstance(price_item, dict):
                continue
            nested_rate = price_item.get("rate_per_night") or {}
            amount = None
            if isinstance(nested_rate, dict):
                amount = nested_rate.get("extracted_lowest") or nested_rate.get("extracted_before_taxes_fees")
            sources.append(
                {
                    "source": price_item.get("source"),
                    "rate_per_night": round(float(amount), 2) if amount else None,
                }
            )
        return sources

    def _extract_country(self, property_item: Dict[str, Any]) -> str:
        address = str(property_item.get("address") or "").strip()
        if not address:
            return ""
        return address.split(",")[-1].strip()

    def _extract_area(self, property_item: Dict[str, Any], normalized_destination: str) -> str:
        address = str(property_item.get("address") or "").strip()
        if not address:
            return normalized_destination.title()
        parts = [segment.strip() for segment in address.split(",") if segment.strip()]
        if len(parts) >= 2:
            return parts[-2]
        return parts[0]

    def _extract_transfer_minutes(self, property_item: Dict[str, Any]) -> int:
        durations: List[int] = []
        for nearby_place in property_item.get("nearby_places") or []:
            if not isinstance(nearby_place, dict):
                continue
            for transport in nearby_place.get("transportations") or []:
                if not isinstance(transport, dict):
                    continue
                duration = str(transport.get("duration") or "")
                match = re.search(r"(\d+)\s*min", duration, flags=re.IGNORECASE)
                if match:
                    durations.append(int(match.group(1)))
        return min(durations) if durations else 999

    def _normalize_time_text(self, raw_value: Any) -> str:
        text = str(raw_value or "").replace("\u202f", " ").strip()
        return text or "Not provided"

    def _infer_breakfast(self, property_item: Dict[str, Any]) -> bool:
        description = str(property_item.get("description") or "").lower()
        amenities = [str(item).lower() for item in (property_item.get("amenities") or [])]
        return "breakfast" in description or any("breakfast" in amenity for amenity in amenities)


hotel_service = HotelService()
