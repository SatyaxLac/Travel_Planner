#!/usr/bin/env python3
"""
Quick test to verify Razorpay API keys are configured correctly.
Run this to check if your Razorpay integration is working.
"""

import sys
from pathlib import Path

import httpx

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.append(str(PROJECT_ROOT))

from travel_agent.config import Config
from travel_agent.tools.payment import _is_razorpay_key_id, _is_razorpay_key_secret


def test_razorpay_config():
    """Test Razorpay configuration."""
    print("Testing Razorpay Configuration...\n")

    Config.refresh()
    key_id = Config.RAZORPAY_KEY_ID
    key_secret = Config.RAZORPAY_KEY_SECRET

    if not key_id:
        print("X RAZORPAY_KEY_ID not found in .env file")
        return False

    if not key_secret:
        print("X RAZORPAY_KEY_SECRET not found in .env file")
        return False

    print(f"OK RAZORPAY_KEY_ID found: {key_id[:12]}...")
    print(f"OK RAZORPAY_KEY_SECRET found: {key_secret[:8]}...")

    if not _is_razorpay_key_id(key_id):
        print("X RAZORPAY_KEY_ID does not look like a Razorpay key ID")
        print("   Expected format: rzp_test_... or rzp_live_...")
        return False

    if not _is_razorpay_key_secret(key_secret):
        print("X RAZORPAY_KEY_SECRET does not look like a valid Razorpay key secret")
        return False

    try:
        response = httpx.get(
            "https://api.razorpay.com/v1/payments?count=1",
            auth=(key_id, key_secret),
            timeout=20.0,
        )
    except httpx.RequestError as exc:
        print(f"X Razorpay network error: {exc}")
        return False

    if response.status_code == 200:
        payload = response.json()
        count = len(payload.get("items", []))
        print("OK Razorpay API connection successful!")
        print(f"   Account mode: {'TEST' if key_id.startswith('rzp_test_') else 'LIVE'}")
        print(f"   Sample payments returned: {count}")
        return True

    if response.status_code in {401, 403}:
        print("X Authentication failed - Invalid Razorpay API credentials")
        print("   Please check your Razorpay test mode keys in .env file")
        return False

    print(f"X Razorpay API error: {response.status_code} {response.text}")
    return False


if __name__ == "__main__":
    print("=" * 60)
    print("Razorpay Configuration Test")
    print("=" * 60 + "\n")

    success = test_razorpay_config()

    print("\n" + "=" * 60)
    if success:
        print("OK All tests passed! Your Razorpay integration is ready.")
        print("\nYou can now:")
        print("  1. Start the server: venv\\Scripts\\python.exe web_server.py")
        print("  2. Book a flight in the web UI")
        print("  3. A Razorpay payment link will be created for the booking amount")
        print("=" * 60)
        sys.exit(0)

    print("X Configuration issues found. Please fix them and try again.")
    print("=" * 60)
    sys.exit(1)
