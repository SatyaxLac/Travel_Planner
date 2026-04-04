from __future__ import annotations

import re
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


TRAIN_ALIASES = {
    "DELHI": "NDLS",
    "DEL": "NDLS",
    "NEW DELHI": "NDLS",
    "NDLS": "NDLS",
    "LUCKNOW": "LKO",
    "LKO": "LKO",
    "MUMBAI": "BCT",
    "MUMBAI CENTRAL": "BCT",
    "BCT": "BCT",
    "CHENNAI": "MAS",
    "CHENNAI CENTRAL": "MAS",
    "MAS": "MAS",
    "BENGALURU": "SBC",
    "BANGALORE": "SBC",
    "SBC": "SBC",
    "HOWRAH": "HWH",
    "HWH": "HWH",
    "PURI": "PURI",
    "AHMEDABAD": "ADI",
    "ADI": "ADI",
    "JAIPUR": "JP",
    "JP": "JP",
    "VARANASI": "BSB",
    "BSB": "BSB",
    "JABALPUR": "JBP",
    "JBP": "JBP",
}


class TrainService:
    dataset_name = "trains.json"
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
        normalized_origin = normalize_lookup(origin, TRAIN_ALIASES)
        normalized_destination = normalize_lookup(destination, TRAIN_ALIASES)
        selected_sort = sort_by if sort_by in self.supported_sorting else "cheapest"

        if Config.TRAIN_PROVIDER == "rapidapi":
            return await self._search_rapidapi(
                origin=origin,
                destination=destination,
                normalized_origin=normalized_origin,
                normalized_destination=normalized_destination,
                date=date,
                sort_by=selected_sort,
            )

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
                record["train_id"],
                date,
                float(record.get("route_popularity", 0.75)),
                weekend_boost=0.08,
                peak_month_boost=0.06,
            )
            class_options = self._build_local_class_options(record, date, demand_factor)
            if not class_options:
                continue

            total_seats_left = sum(option["seats_left"] for option in class_options)
            matched_items.append(
                {
                    "train_id": record["train_id"],
                    "train_number": record["train_number"],
                    "train_name": record["train_name"],
                    "train_type": record.get("train_type"),
                    "origin": record["origin"],
                    "destination": record["destination"],
                    "origin_name": record["origin_name"],
                    "destination_name": record["destination_name"],
                    "departure_time": combine_date_and_time(date, record["departure_time"]),
                    "arrival_time": combine_date_and_time(
                        date,
                        record["arrival_time"],
                        int(record.get("arrival_day_offset", 0)),
                    ),
                    "duration_minutes": int(record["duration_minutes"]),
                    "duration": format_duration(int(record["duration_minutes"])),
                    "currency": "INR",
                    "display_price": min(option["price"] for option in class_options),
                    "availability_status": availability_status(total_seats_left, threshold=25),
                    "seats_available": total_seats_left,
                    "class_options": class_options,
                    "seat_class": class_options[0]["code"],
                }
            )

        sorted_items = self._sort_items(matched_items, sort_by)
        return build_search_response(
            "train",
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

    async def _search_rapidapi(
        self,
        *,
        origin: str,
        destination: str,
        normalized_origin: str,
        normalized_destination: str,
        date: str,
        sort_by: str,
    ) -> Dict[str, Any]:
        if not Config.TRAIN_API_KEY:
            raise RuntimeError("TRAIN_API_KEY is missing for RapidAPI train search.")

        origin_code = await self._resolve_station_code(origin, normalized_origin)
        destination_code = await self._resolve_station_code(destination, normalized_destination)
        payload = await self._rapidapi_get(
            Config.TRAIN_SEARCH_PATH or "/api/v3/trainBetweenStations",
            {
                "fromStationCode": origin_code,
                "toStationCode": destination_code,
                "dateOfJourney": date,
            },
        )
        items = self._parse_rapidapi_items(payload, origin_code, destination_code, date)
        sorted_items = self._sort_items(items, sort_by)

        response = build_search_response(
            "train",
            {
                "requested_origin": origin,
                "requested_destination": destination,
                "origin": origin_code,
                "destination": destination_code,
                "date": date,
                "sort_by": sort_by,
            },
            sorted_items,
            provider="rapidapi",
            supported_sorting=self.supported_sorting,
        )
        response["live_data"] = True
        message = str(payload.get("message") or payload.get("error") or "").strip()
        if response["status"] == "no_results" and message:
            response["message"] = message
        return response

    async def _resolve_station_code(self, raw_value: str, normalized_value: str) -> str:
        candidate = str(normalized_value or "").strip().upper()
        if re.fullmatch(r"[A-Z]{2,6}", candidate):
            return candidate

        payload = await self._rapidapi_get(
            Config.TRAIN_STATION_SEARCH_PATH or "/api/v1/searchStation",
            {"query": str(raw_value or "").strip()},
        )
        for item in self._extract_train_rows(payload):
            station_code = self._first_value(item, "station_code", "stationCode", "code", "scode")
            if station_code:
                return str(station_code).strip().upper()
        raise RuntimeError(f"Could not resolve station code for '{raw_value}'.")

    async def _rapidapi_get(self, path: str, params: Dict[str, Any]) -> Dict[str, Any]:
        base_url = (Config.TRAIN_API_BASE_URL or "https://irctc1.p.rapidapi.com").rstrip("/")
        url = f"{base_url}/{path.lstrip('/')}"
        headers = {
            "Accept": "application/json",
            "X-RapidAPI-Key": Config.TRAIN_API_KEY or "",
            "X-RapidAPI-Host": (Config.TRAIN_RAPIDAPI_HOST or "irctc1.p.rapidapi.com").strip(),
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    url,
                    params=params,
                    headers=headers,
                    timeout=float(Config.TRAIN_TIMEOUT_SECONDS or 15),
                )
        except httpx.TimeoutException as exc:
            raise RuntimeError("RapidAPI train search timed out.") from exc
        except httpx.HTTPError as exc:
            raise RuntimeError("RapidAPI train search request failed.") from exc

        if response.is_error:
            detail = response.text.strip()
            try:
                payload = response.json()
                if isinstance(payload, dict):
                    detail = str(payload.get("message") or payload.get("error") or payload.get("detail") or detail)
            except ValueError:
                payload = None

            if response.status_code == 403 and "not subscribed" in detail.lower():
                raise RuntimeError(
                    "RapidAPI train search is configured, but this key is not subscribed to the selected train API."
                )
            raise RuntimeError(f"RapidAPI train search failed: {detail or f'HTTP {response.status_code}'}")

        try:
            payload = response.json()
        except ValueError as exc:
            raise RuntimeError("RapidAPI train search returned invalid JSON.") from exc
        if not isinstance(payload, dict):
            raise RuntimeError("RapidAPI train search returned an unexpected response shape.")
        return payload

    def _parse_rapidapi_items(
        self,
        payload: Dict[str, Any],
        origin_code: str,
        destination_code: str,
        date: str,
    ) -> List[Dict[str, Any]]:
        items: List[Dict[str, Any]] = []
        for row in self._extract_train_rows(payload):
            train_number = str(
                self._first_value(
                    row,
                    "train_number",
                    "trainNo",
                    "train_no",
                    "number",
                    "train_num",
                    "train_id",
                )
                or ""
            ).strip()
            if not train_number:
                continue

            train_name = str(self._first_value(row, "train_name", "trainName", "name", "train") or train_number).strip()
            class_options = self._normalize_classes(
                self._first_value(row, "class_type", "classType", "classes", "available_classes")
            )
            fare = self._normalize_price(
                self._first_value(row, "price", "fare", "ticket_price", "ticketPrice", "train_fare")
            )
            display_price = fare if fare is not None else None
            item = {
                "train_id": train_number,
                "train_number": train_number,
                "train_name": train_name,
                "train_type": self._first_value(row, "train_type", "type", "trainType") or "Train",
                "origin": origin_code,
                "destination": destination_code,
                "origin_name": self._first_value(row, "from_station_name", "fromStationName") or origin_code,
                "destination_name": self._first_value(row, "to_station_name", "toStationName") or destination_code,
                "departure_time": self._normalize_time(
                    self._first_value(row, "from_std", "departure_time", "departure", "depart_time"),
                    date,
                ),
                "arrival_time": self._normalize_time(
                    self._first_value(row, "to_sta", "arrival_time", "arrival", "arrival_time_text"),
                    date,
                ),
                "duration_minutes": self._duration_to_minutes(
                    self._first_value(row, "duration", "travel_time", "journey_time")
                ),
                "duration": self._normalize_duration_text(
                    self._first_value(row, "duration", "travel_time", "journey_time")
                ),
                "currency": "INR",
                "display_price": display_price,
                "availability_status": "available" if class_options else "unknown",
                "seats_available": None,
                "class_options": class_options,
                "seat_class": class_options[0]["code"] if class_options else "Not provided",
                "provider_notes": [],
            }
            if fare is None:
                item["provider_notes"].append("Fare was not returned by the train search provider.")
            if not class_options:
                item["provider_notes"].append("Available classes were not returned by the train search provider.")
            items.append(item)
        return items

    def _extract_train_rows(self, payload: Any) -> List[Dict[str, Any]]:
        if not isinstance(payload, dict):
            return []
        for key in ("data", "trains", "results", "result"):
            value = payload.get(key)
            if isinstance(value, list):
                return [item for item in value if isinstance(item, dict)]
            if isinstance(value, dict):
                for nested_key in ("data", "trains", "results", "result"):
                    nested_value = value.get(nested_key)
                    if isinstance(nested_value, list):
                        return [item for item in nested_value if isinstance(item, dict)]
        return []

    def _first_value(self, source: Dict[str, Any], *keys: str) -> Any:
        for key in keys:
            value = source.get(key)
            if value not in (None, "", [], {}):
                return value
        return None

    def _normalize_classes(self, raw_value: Any) -> List[Dict[str, Any]]:
        if isinstance(raw_value, list):
            values = [str(item).strip() for item in raw_value if str(item).strip()]
        elif isinstance(raw_value, str):
            values = [segment.strip() for segment in re.split(r"[,/|]", raw_value) if segment.strip()]
        else:
            values = []
        return [
            {
                "code": value,
                "name": value,
                "price": None,
                "currency": "INR",
                "seats_left": None,
                "availability_status": "unknown",
            }
            for value in values
        ]

    def _normalize_price(self, raw_value: Any) -> float | None:
        if raw_value in (None, "", "N/A"):
            return None
        if isinstance(raw_value, (int, float)):
            return float(raw_value)
        cleaned = re.sub(r"[^0-9.]", "", str(raw_value))
        if not cleaned:
            return None
        try:
            return float(cleaned)
        except ValueError:
            return None

    def _normalize_time(self, raw_value: Any, date: str) -> str | None:
        text = str(raw_value or "").strip()
        if not text:
            return None
        if "T" in text:
            return text
        if re.fullmatch(r"\d{2}:\d{2}(:\d{2})?", text):
            normalized = text if len(text) == 8 else f"{text}:00"
            return f"{date}T{normalized}"
        return text

    def _duration_to_minutes(self, raw_value: Any) -> int:
        text = str(raw_value or "").strip()
        if not text:
            return 0
        if re.fullmatch(r"\d{2}:\d{2}", text):
            hours, minutes = text.split(":")
            return int(hours) * 60 + int(minutes)
        hours_match = re.search(r"(\d+)\s*h", text, flags=re.IGNORECASE)
        minutes_match = re.search(r"(\d+)\s*m", text, flags=re.IGNORECASE)
        hours = int(hours_match.group(1)) if hours_match else 0
        minutes = int(minutes_match.group(1)) if minutes_match else 0
        return hours * 60 + minutes

    def _normalize_duration_text(self, raw_value: Any) -> str:
        minutes = self._duration_to_minutes(raw_value)
        if minutes:
            return format_duration(minutes)
        return str(raw_value or "Not provided")

    def _build_local_class_options(
        self,
        record: Dict[str, Any],
        date: str,
        demand_factor: float,
    ) -> List[Dict[str, Any]]:
        options: List[Dict[str, Any]] = []
        for coach_class in record.get("classes", []):
            class_code = coach_class["code"]
            seats_left = derive_inventory(
                f"{record['train_id']}:{class_code}",
                date,
                int(coach_class["base_inventory"]),
                demand_factor,
                float(coach_class.get("demand_weight", 1.0)),
            )
            if seats_left <= 0:
                continue

            premium_weight = max(float(coach_class.get("base_price", 0)) / 4000, 0.8)
            price = derive_price(
                f"{record['train_id']}:{class_code}",
                date,
                float(coach_class["base_price"]),
                demand_factor,
                premium_weight=premium_weight,
            )
            options.append(
                {
                    "code": class_code,
                    "name": coach_class["name"],
                    "price": price,
                    "currency": "INR",
                    "seats_left": seats_left,
                    "availability_status": availability_status(seats_left, threshold=12),
                }
            )

        return sorted(options, key=lambda option: option["price"])

    def _sort_items(self, items: List[Dict[str, Any]], sort_by: str) -> List[Dict[str, Any]]:
        return sort_items(
            items,
            sort_by,
            {
                "cheapest": lambda item: (item["display_price"] is None, item["display_price"] or float("inf"), item["departure_time"] or ""),
                "fastest": lambda item: (item["duration_minutes"] or float("inf"), item["display_price"] is None, item["display_price"] or float("inf")),
                "earliest_departure": lambda item: (item["departure_time"] or "", item["display_price"] is None, item["display_price"] or float("inf")),
            },
            default_sort="cheapest",
        )

    def book(
        self,
        train_id: str,
        passenger_name: str,
        id_number: str,
        payment_confirmed: bool = False,
        payment_reference: str = "",
    ) -> Dict[str, Any]:
        reference_seed = (train_id, passenger_name, id_number[-4:])
        if not payment_confirmed:
            return {
                "status": "pending_payment",
                "reservation_reference": build_reference("TRH", *reference_seed),
                "train_id": train_id,
                "passenger": passenger_name,
                "provider": "local_dataset",
                "id_number_last4": str(id_number)[-4:],
                "message": "Train selection saved, but payment is still required before the booking can be confirmed.",
                "next_step": "Create or complete payment first, then confirm the booking.",
            }

        return {
            "status": "confirmed",
            "booking_reference": build_reference("TRB", *reference_seed, payment_reference or "CONFIRMED"),
            "train_id": train_id,
            "passenger": passenger_name,
            "provider": "local_dataset",
            "id_number_last4": str(id_number)[-4:],
            "payment_reference": payment_reference or None,
        }


train_service = TrainService()
