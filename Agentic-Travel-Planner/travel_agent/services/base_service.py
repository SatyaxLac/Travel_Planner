from __future__ import annotations

import json
from datetime import datetime, timedelta
from functools import lru_cache
from hashlib import sha256
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping, Sequence


DATA_DIR = Path(__file__).resolve().parent.parent / "data"


class DatasetError(RuntimeError):
    """Raised when a local dataset cannot be loaded or parsed."""


@lru_cache(maxsize=None)
def load_dataset(filename: str) -> List[Dict[str, Any]]:
    dataset_path = DATA_DIR / filename
    try:
        with dataset_path.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)
    except FileNotFoundError as exc:
        raise DatasetError(f"Dataset not found: {dataset_path}") from exc
    except json.JSONDecodeError as exc:
        raise DatasetError(f"Dataset is not valid JSON: {dataset_path}") from exc

    if not isinstance(payload, list):
        raise DatasetError(f"Dataset must contain a list of records: {dataset_path}")
    return payload


def parse_date(date_value: str) -> datetime:
    try:
        return datetime.strptime(str(date_value).strip(), "%Y-%m-%d")
    except ValueError as exc:
        raise ValueError("date must be in YYYY-MM-DD format") from exc


def combine_date_and_time(date_value: str, time_value: str, day_offset: int = 0) -> str:
    travel_date = parse_date(date_value)
    time_portion = datetime.strptime(time_value, "%H:%M").time()
    combined = datetime.combine(travel_date.date(), time_portion) + timedelta(days=day_offset)
    return combined.isoformat(timespec="seconds")


def format_duration(minutes: int) -> str:
    hours, remaining_minutes = divmod(int(minutes), 60)
    if hours and remaining_minutes:
        return f"{hours}h {remaining_minutes}m"
    if hours:
        return f"{hours}h"
    return f"{remaining_minutes}m"


def stable_int(*parts: Any, modulo: int) -> int:
    joined = "|".join(str(part).strip().upper() for part in parts)
    digest = sha256(joined.encode("utf-8")).hexdigest()
    return int(digest[:12], 16) % modulo


def build_reference(prefix: str, *parts: Any, length: int = 10) -> str:
    joined = "|".join(str(part).strip().upper() for part in parts)
    digest = sha256(joined.encode("utf-8")).hexdigest().upper()
    return f"{prefix}{digest[:length]}"


def normalize_lookup(value: str, aliases: Mapping[str, str]) -> str:
    normalized = str(value or "").strip().upper()
    return aliases.get(normalized, normalized)


def weekday_matches(travel_date: str, days_of_week: Sequence[str]) -> bool:
    allowed = {str(day).strip().lower() for day in days_of_week}
    return parse_date(travel_date).strftime("%A").lower() in allowed


def availability_status(units_left: int, threshold: int = 10) -> str:
    if units_left <= 0:
        return "sold_out"
    if units_left <= threshold:
        return "limited"
    return "available"


def demand_multiplier(
    identifier: str,
    travel_date: str,
    popularity: float,
    *,
    weekend_boost: float = 0.12,
    peak_month_boost: float = 0.1,
) -> float:
    travel_dt = parse_date(travel_date)
    weekday = travel_dt.weekday()
    month = travel_dt.month

    weekend_factor = 1.0 + weekend_boost if weekday in {4, 5, 6} else 1.0
    seasonal_factor = 1.0 + peak_month_boost if month in {4, 5, 10, 11, 12} else 1.0
    hash_factor = 0.92 + (stable_int(identifier, travel_date, modulo=17) / 100)
    return popularity * weekend_factor * seasonal_factor * hash_factor


def derive_inventory(
    identifier: str,
    travel_date: str,
    base_inventory: int,
    demand_factor: float,
    demand_weight: float,
) -> int:
    occupancy_ratio = min(0.92, 0.22 + (demand_factor * demand_weight * 0.42))
    demand_shift = stable_int(identifier, travel_date, "inventory", modulo=5)
    units_left = max(int(base_inventory) - round(int(base_inventory) * occupancy_ratio) - demand_shift, 0)
    return units_left


def derive_price(
    identifier: str,
    travel_date: str,
    base_price: float,
    demand_factor: float,
    premium_weight: float = 1.0,
) -> float:
    hash_adjustment = 1.0 + (stable_int(identifier, travel_date, "price", modulo=6) / 100)
    demand_adjustment = 1.0 + max(demand_factor - 0.72, 0) * 0.34 * premium_weight
    return round(float(base_price) * hash_adjustment * demand_adjustment, 2)


def sort_items(
    items: Iterable[Dict[str, Any]],
    sort_key: str,
    sort_map: Mapping[str, Any],
    default_sort: str,
) -> List[Dict[str, Any]]:
    selected_sort = sort_key if sort_key in sort_map else default_sort
    key_func = sort_map[selected_sort]
    return sorted(list(items), key=key_func)


def build_search_response(
    search_type: str,
    search_criteria: Dict[str, Any],
    items: List[Dict[str, Any]],
    *,
    provider: str = "local_dataset",
    supported_sorting: Sequence[str],
) -> Dict[str, Any]:
    if not items:
        return {
            "search_type": search_type,
            "provider": provider,
            "status": "no_results",
            "message": "No available options",
            "search_criteria": search_criteria,
            "supported_sorting": list(supported_sorting),
            "count": 0,
            "items": [],
        }

    return {
        "search_type": search_type,
        "provider": provider,
        "status": "success",
        "message": f"Found {len(items)} option(s)",
        "search_criteria": search_criteria,
        "supported_sorting": list(supported_sorting),
        "count": len(items),
        "items": items,
    }
