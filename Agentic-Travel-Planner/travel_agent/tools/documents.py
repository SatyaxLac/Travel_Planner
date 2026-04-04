from datetime import datetime, timedelta
from typing import Dict, Any, List


def _parse_iso_date(value: str):
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        return None


def _normalize_transport_mode(value: str) -> str:
    return (value or "").strip().lower().replace("-", "_").replace(" ", "_")


def verify_travel_documents(
    full_name: str = "",
    passport_number: str = "",
    passport_expiry_date: str = "",
    visa_status: str = "not_provided",
    visa_expiry_date: str = "",
    destination_country: str = "",
    departure_date: str = "",
    return_date: str = "",
    authorization_confirmed: bool = False,
    transport_mode: str = "",
    is_international_trip: bool | None = None,
) -> Dict[str, Any]:
    """
    Perform a booking-side passport and visa pre-check after the traveler authorizes verification.
    """
    if not authorization_confirmed:
        return {
            "status": "authorization_required",
            "authorized": False,
            "summary": "Traveler authorization is required before passport or visa verification.",
            "warnings": [
                "Ask the traveler to explicitly authorize document verification first."
            ],
        }

    normalized_transport_mode = _normalize_transport_mode(transport_mode)
    if (
        is_international_trip is False
        or normalized_transport_mode in {"train", "trains", "train_only", "book_train", "bus", "car", "road"}
    ):
        return {
            "status": "not_applicable",
            "authorized": True,
            "summary": "Passport and visa verification was skipped because this is not an international flight booking.",
            "checks": [
                "Document expiry warnings are only enforced for international flight bookings in this planner."
            ],
            "warnings": [],
            "official_note": (
                "This is a booking-side pre-check only, not an official immigration or embassy decision."
            ),
        }

    warnings: List[str] = []
    checks: List[str] = []

    departure = _parse_iso_date(departure_date)
    trip_end = _parse_iso_date(return_date) or departure
    passport_expiry = _parse_iso_date(passport_expiry_date)
    visa_expiry = _parse_iso_date(visa_expiry_date)
    normalized_visa_status = (visa_status or "not_provided").strip().lower()

    if full_name:
        checks.append("Traveler name captured.")
    else:
        warnings.append("Traveler full name was not provided for the document check.")

    if passport_number:
        checks.append("Passport number captured.")
    else:
        warnings.append("Passport number is missing.")

    if passport_expiry:
        checks.append(f"Passport expiry recorded as {passport_expiry.isoformat()}.")
        if trip_end and passport_expiry < trip_end:
            warnings.append("Passport expires before the trip ends.")
        if trip_end and passport_expiry < trip_end + timedelta(days=180):
            warnings.append(
                "Passport has less than 6 months of validity after the trip. Many destinations require more validity."
            )
    else:
        warnings.append("Passport expiry date is missing or invalid.")

    if normalized_visa_status in {"already have visa", "approved", "valid"}:
        checks.append("Traveler indicates an existing visa.")
        if visa_expiry:
            checks.append(f"Visa expiry recorded as {visa_expiry.isoformat()}.")
            if departure and visa_expiry < departure:
                warnings.append("Visa expires before departure.")
        else:
            warnings.append("Visa status says approved, but visa expiry date is missing.")
    elif normalized_visa_status in {"not required", "visa not required", "not_needed"}:
        checks.append("Traveler marked visa as not required.")
    elif normalized_visa_status in {"need visa guidance", "not sure", "required", "pending"}:
        warnings.append("Visa eligibility still needs manual confirmation before booking.")
    else:
        warnings.append("Visa status was not provided.")

    summary = "Document pre-check passed." if not warnings else "Document pre-check found follow-up items."
    if destination_country:
        checks.append(f"Destination country noted as {destination_country}.")

    return {
        "status": "review_complete" if not warnings else "review_needed",
        "authorized": True,
        "summary": summary,
        "checks": checks,
        "warnings": warnings,
        "official_note": (
            "This is a booking-side pre-check only, not an official immigration or embassy decision."
        ),
    }
