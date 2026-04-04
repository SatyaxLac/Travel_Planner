"""
Test script to verify weather and flight API integrations.
Run this after adding FLIGHT_API_SECRET to your .env file.
"""

import asyncio
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.append(str(PROJECT_ROOT))

from travel_agent.config import Config
from travel_agent.tools.flights import search_flights
from travel_agent.tools.weather import get_forecast


async def main():
    print("=== Testing Weather API Integration ===\n")
    try:
        weather = get_forecast("Dallas", "2025-12-15")
        print("OK Weather API test successful!")
        print(f"  Location: {weather.get('location')}")
        print(f"  Condition: {weather.get('condition')}")
        print(
            f"  Temperature: {weather.get('temperature_celsius')}C / "
            f"{weather.get('temperature_fahrenheit')}F"
        )
    except Exception as exc:
        print(f"X Weather API test failed: {exc}")

    print("\n=== Testing Flight API Integration ===\n")
    try:
        flights = await search_flights("DFW", "JFK", "2025-12-15")
        print("OK Flight API test successful!")
        print(f"  Status: {flights.get('status')}")
        print(f"  Found {flights.get('count')} flight(s)")
        if flights.get("items"):
            flight = flights["items"][0]
            print(f"  First flight: {flight.get('airline')} {flight.get('flight_number')}")
            print(f"  Price: {flight.get('display_price')} {flight.get('currency')}")
            print(f"  Departure: {flight.get('departure_time')}")
    except Exception as exc:
        print(f"X Flight API test failed: {exc}")

    print("\n=== Configuration Check ===\n")
    Config.refresh()
    print(f"FLIGHT_API_KEY: {'OK Set' if Config.FLIGHT_API_KEY else 'X Not set'}")
    print(
        "FLIGHT_API_SECRET: "
        f"{'OK Set' if Config.FLIGHT_API_SECRET else 'X Not set (REQUIRED for real API)'}"
    )
    print(f"WEATHER_API_KEY: {'OK Set' if Config.WEATHER_API_KEY else 'X Not set'}")

    if not Config.FLIGHT_API_SECRET:
        print("\nWarning: FLIGHT_API_SECRET not found. Add it to your .env file:")
        print("   FLIGHT_API_SECRET=your_amadeus_api_secret_here")


if __name__ == "__main__":
    asyncio.run(main())
