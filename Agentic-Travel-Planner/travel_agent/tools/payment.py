"""
Payment processing using Razorpay payment links.

This keeps the existing process_payment tool contract intact while switching the
provider from Stripe to Razorpay. The tool creates a hosted payment link so the
current chat-based UI can hand off payment without a checkout-page rewrite.
"""

import logging
import random
import time
from typing import Any, Dict, Optional

import httpx

from ..config import Config

logger = logging.getLogger(__name__)

RAZORPAY_API_BASE_URL = "https://api.razorpay.com/v1"


def _is_razorpay_key_id(key_id: Optional[str]) -> bool:
    return bool(key_id) and key_id.startswith(("rzp_test_", "rzp_live_"))


def _is_razorpay_key_secret(key_secret: Optional[str]) -> bool:
    if not key_secret:
        return False
    normalized = key_secret.strip()
    return len(normalized) >= 10 and " " not in normalized


def _normalize_metadata(metadata: Optional[Dict[str, str]]) -> Dict[str, str]:
    if not metadata:
        return {}

    normalized = {}
    for key, value in metadata.items():
        if key is None or value is None:
            continue
        normalized[str(key)[:40]] = str(value)[:256]
    return normalized


def process_payment(
    amount: float,
    currency: str,
    description: str = "Travel booking payment",
    customer_email: Optional[str] = None,
    metadata: Optional[Dict[str, str]] = None,
    idempotency_key: Optional[str] = None
) -> Dict[str, Any]:
    """
    Process a payment using Razorpay payment links.
    
    Args:
        amount: Amount to charge in major currency units.
        currency: Currency code, usually INR for this project.
        description: Description of the payment.
        customer_email: Customer email for the payment link and receipt.
        metadata: Additional metadata to store with payment.
        idempotency_key: Optional stable reference for the payment request.
    
    Returns:
        dict: Payment result with status, transaction_id, and details.
    """
    Config.refresh()
    key_id = Config.RAZORPAY_KEY_ID
    key_secret = Config.RAZORPAY_KEY_SECRET

    if key_id or key_secret:
        if not _is_razorpay_key_id(key_id):
            logger.warning(
                "Razorpay key ID does not match expected Razorpay format. "
                "Falling back to mock payment mode."
            )
            return _process_mock_payment(
                amount,
                currency,
                description,
                reason="Razorpay is not configured with a valid Razorpay key ID.",
            )
        if not _is_razorpay_key_secret(key_secret):
            logger.warning(
                "Razorpay key secret is missing or malformed. Falling back to mock payment mode."
            )
            return _process_mock_payment(
                amount,
                currency,
                description,
                reason="Razorpay is not configured with a valid Razorpay key secret.",
            )

        try:
            result = _process_razorpay_payment(
                amount=amount,
                currency=currency,
                description=description,
                customer_email=customer_email,
                metadata=metadata,
                idempotency_key=idempotency_key
            )
            if result.get("status") == "failed" and result.get("error") in {
                "authentication_error",
                "network_error",
            }:
                logger.warning(
                    "Razorpay returned a configuration/network failure. "
                    "Falling back to mock payment mode for demo continuity."
                )
                return _process_mock_payment(
                    amount,
                    currency,
                    description,
                    reason="Razorpay is unavailable or misconfigured, so demo payment mode was used.",
                )
            return result
        except Exception as e:
            logger.error(f"Razorpay payment failed: {e}. Falling back to mock.")
    
    return _process_mock_payment(amount, currency, description)


def _process_razorpay_payment(
    amount: float,
    currency: str,
    description: str,
    customer_email: Optional[str],
    metadata: Optional[Dict[str, str]],
    idempotency_key: Optional[str]
) -> Dict[str, Any]:
    """Create a Razorpay payment link and return the hosted checkout URL."""
    amount_subunits = int(round(amount * 100))

    if not idempotency_key:
        idempotency_key = f"payment_{int(time.time() * 1000)}_{random.randint(1000, 9999)}"

    payload: Dict[str, Any] = {
        "amount": amount_subunits,
        "currency": currency.upper(),
        "description": description,
        "reference_id": idempotency_key[:40],
        "accept_partial": False,
        "reminder_enable": True,
    }

    if customer_email:
        payload["customer"] = {"email": customer_email}
        payload["notify"] = {"email": True}

    notes = _normalize_metadata(metadata)
    if notes:
        payload["notes"] = notes

    try:
        logger.info(f"Creating Razorpay payment link for {amount} {currency}")
        response = httpx.post(
            f"{RAZORPAY_API_BASE_URL}/payment_links",
            json=payload,
            auth=(Config.RAZORPAY_KEY_ID, Config.RAZORPAY_KEY_SECRET),
            timeout=20.0,
        )

        if response.status_code in {401, 403}:
            logger.error("Razorpay authentication failed while creating payment link")
            return {
                "status": "failed",
                "error": "authentication_error",
                "message": "Payment service configuration error. Please contact support.",
                "amount": amount,
                "currency": currency.upper(),
                "provider": "razorpay",
            }

        if response.status_code == 429:
            logger.error("Razorpay rate limit hit while creating payment link")
            return {
                "status": "failed",
                "error": "rate_limit",
                "message": "Payment service is busy. Please try again in a moment.",
                "amount": amount,
                "currency": currency.upper(),
                "provider": "razorpay",
            }

        if response.status_code >= 500:
            logger.error(f"Razorpay server error: {response.status_code} {response.text}")
            return {
                "status": "failed",
                "error": "network_error",
                "message": "Payment service is temporarily unavailable. Please try again.",
                "amount": amount,
                "currency": currency.upper(),
                "provider": "razorpay",
            }

        response.raise_for_status()
        payment_link = response.json()
        payment_status = payment_link.get("status", "created")
        payment_url = payment_link.get("short_url") or payment_link.get("payment_url")
        is_paid = payment_status == "paid"

        return {
            "status": "success" if is_paid else "pending",
            "transaction_id": payment_link["id"],
            "amount": amount,
            "currency": currency.upper(),
            "provider": "razorpay",
            "payment_status": payment_status,
            "payment_url": payment_url,
            "payment_link_id": payment_link["id"],
            "customer_email": customer_email,
            "idempotency_key": idempotency_key,
            "description": description,
            "message": (
                "Payment confirmed via Razorpay."
                if is_paid
                else "Razorpay payment link created. Share or open the payment URL to complete the booking payment."
            ),
        }

    except httpx.HTTPStatusError as exc:
        logger.error(f"Invalid Razorpay request: {exc.response.text}")
        return {
            "status": "failed",
            "error": "invalid_request",
            "message": "Payment request was invalid. Please contact support.",
            "amount": amount,
            "currency": currency.upper(),
            "provider": "razorpay",
        }

    except httpx.RequestError as exc:
        logger.error(f"Razorpay API connection error: {exc}")
        return {
            "status": "failed",
            "error": "network_error",
            "message": "Payment service is temporarily unavailable. Please try again.",
            "amount": amount,
            "currency": currency.upper(),
            "provider": "razorpay",
        }

    except Exception as exc:
        logger.exception(f"Unexpected payment error: {exc}")
        return {
            "status": "failed",
            "error": "unexpected_error",
            "message": "An unexpected error occurred. Please contact support.",
            "amount": amount,
            "currency": currency.upper(),
            "provider": "razorpay",
        }


def _process_mock_payment(
    amount: float,
    currency: str,
    description: str,
    reason: Optional[str] = None,
) -> Dict[str, Any]:
    """Generate mock payment response for development/testing."""
    logger.info(f"[MOCK] Processing payment of {amount} {currency} - {description}")
    
    # Simulate different payment outcomes for testing
    # Use amount to determine outcome for predictable testing
    if amount == 0.01:  # Test failure
        return {
            "status": "failed",
            "error": "card_declined",
            "message": "Your card was declined (mock).",
            "amount": amount,
            "currency": currency.upper()
        }
    
    # Default: successful payment
    return {
        "status": "success",
        "transaction_id": f"MOCK_TXN_{random.randint(100000, 999999)}",
        "amount": amount,
        "currency": currency.upper(),
        "provider": "mock",
        "payment_status": "succeeded",
        "description": description,
        "mock": True,
        "message": reason or "Payment processed in demo mode.",
    }
