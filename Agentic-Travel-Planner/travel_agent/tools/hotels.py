from __future__ import annotations

from typing import Any, Dict

from ..services.hotel_service import hotel_service


async def search_hotels(
    destination: str,
    date: str,
    nights: int = 1,
    rooms: int = 1,
    sort_by: str = "cheapest",
) -> Dict[str, Any]:
    """
    Search a deterministic local hotel inventory for a destination and check-in date.
    """
    return await hotel_service.search(
        destination=destination,
        date=date,
        nights=nights,
        rooms=rooms,
        sort_by=sort_by,
    )
