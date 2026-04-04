import sys
import unittest
from pathlib import Path
from unittest.mock import patch

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.append(str(PROJECT_ROOT))

from travel_agent.config import Config
from travel_agent.tools.flights import search_flights


class TestFlightCurrency(unittest.IsolatedAsyncioTestCase):
    async def test_mock_flights_are_normalized_to_inr(self):
        mock_results = [
            {
                "flight_id": "DL123",
                "airline": "Delta Air Lines (DL)",
                "flight_number": "DL123",
                "price": 100.0,
                "currency": "USD",
            }
        ]

        with patch.object(Config, "FLIGHT_API_KEY", None), patch.object(
            Config, "FLIGHT_API_SECRET", None
        ), patch("travel_agent.tools.flights._search_mock_flights", return_value=mock_results):
            results = await search_flights("DEL", "GOI", "2026-04-10")

        self.assertEqual(results[0]["currency"], "INR")
        self.assertEqual(results[0]["price"], 8300.0)
        self.assertEqual(results[0]["original_currency"], "USD")
        self.assertEqual(results[0]["original_price"], 100.0)
        self.assertIn("Converted from USD", results[0]["price_note"])

    async def test_real_flights_are_normalized_to_inr(self):
        real_results = [
            {
                "flight_id": "AF456",
                "airline": "Air France (AF)",
                "flight_number": "AF456",
                "price": 250.0,
                "currency": "EUR",
            }
        ]

        with patch.object(Config, "FLIGHT_API_KEY", "amadeus-key"), patch.object(
            Config, "FLIGHT_API_SECRET", "amadeus-secret"
        ), patch("travel_agent.tools.flights._search_real_flights", return_value=real_results):
            results = await search_flights("DEL", "CDG", "2026-04-10")

        self.assertEqual(results[0]["currency"], "INR")
        self.assertEqual(results[0]["price"], 22500.0)
        self.assertEqual(results[0]["original_currency"], "EUR")
        self.assertEqual(results[0]["original_price"], 250.0)


if __name__ == "__main__":
    unittest.main()
