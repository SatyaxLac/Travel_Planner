from __future__ import annotations

from typing import Any, Dict

from ..services.train_service import train_service


async def search_trains(
    origin: str,
    destination: str,
    date: str,
    sort_by: str = "cheapest",
) -> Dict[str, Any]:
    """
    Search a deterministic local train inventory for a specific route and date.
    """
    return await train_service.search(origin, destination, date, sort_by=sort_by)


async def book_train(
    train_id: str,
    passenger_name: str,
    id_number: str,
    payment_confirmed: bool = False,
    payment_reference: str = "",
) -> Dict[str, Any]:
    """
    Confirm or hold a train booking using deterministic local booking references.
    """
    return train_service.book(
        train_id,
        passenger_name,
        id_number,
        payment_confirmed=payment_confirmed,
        payment_reference=payment_reference,
    )
