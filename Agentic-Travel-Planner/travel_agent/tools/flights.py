from __future__ import annotations

from typing import Any, Dict

from ..services.flight_service import flight_service


async def search_flights(
    origin: str,
    destination: str,
    date: str,
    sort_by: str = "cheapest",
) -> Dict[str, Any]:
    """
    Search a deterministic local flight inventory for a specific route and date.
    """
    return await flight_service.search(origin, destination, date, sort_by=sort_by)


async def book_flight(
    flight_id: str,
    passenger_name: str,
    passport_number: str,
    payment_confirmed: bool = False,
    payment_reference: str = "",
) -> Dict[str, Any]:
    """
    Confirm or hold a flight booking using deterministic local booking references.
    """
    return flight_service.book(
        flight_id,
        passenger_name,
        passport_number,
        payment_confirmed=payment_confirmed,
        payment_reference=payment_reference,
    )
