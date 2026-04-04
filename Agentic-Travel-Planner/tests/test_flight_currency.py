import sys
import unittest
from pathlib import Path
from unittest.mock import patch

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.append(str(PROJECT_ROOT))

from travel_agent.config import Config
from travel_agent.tools.flights import search_flights
from travel_agent.tools.hotels import search_hotels


class TestLocalTravelSearch(unittest.IsolatedAsyncioTestCase):
    async def test_search_flights_returns_structured_local_results(self):
        with patch("travel_agent.services.flight_service.Config.refresh"), patch.object(
            Config, "FLIGHT_PROVIDER", "local"
        ):
            results = await search_flights("DEL", "GOI", "2026-04-10")

        self.assertEqual(results["status"], "success")
        self.assertEqual(results["provider"], "local_dataset")
        self.assertGreaterEqual(results["count"], 1)

        option = results["items"][0]
        self.assertIn("fare_options", option)
        self.assertGreaterEqual(len(option["fare_options"]), 1)
        self.assertEqual(option["currency"], "INR")
        self.assertGreater(option["display_price"], 0)

    async def test_search_flights_supports_fastest_sorting(self):
        with patch("travel_agent.services.flight_service.Config.refresh"), patch.object(
            Config, "FLIGHT_PROVIDER", "local"
        ):
            results = await search_flights("DEL", "GOI", "2026-04-10", sort_by="fastest")

        self.assertEqual(results["status"], "success")
        durations = [item["duration_minutes"] for item in results["items"]]
        self.assertEqual(durations, sorted(durations))

    async def test_search_flights_supports_serpapi_provider(self):
        autocomplete_origin = {
            "suggestions": [
                {
                    "type": "city",
                    "name": "Varanasi, Uttar Pradesh, India",
                    "airports": [{"id": "VNS", "name": "Lal Bahadur Shastri International Airport"}],
                }
            ]
        }
        autocomplete_destination = {
            "suggestions": [
                {
                    "type": "city",
                    "name": "Jabalpur, Madhya Pradesh, India",
                    "airports": [{"id": "JLR", "name": "Jabalpur Airport"}],
                }
            ]
        }
        serpapi_payload = {
            "best_flights": [
                {
                    "price": 18450,
                    "total_duration": 215,
                    "departure_token": "dep_token_123",
                    "booking_token": "book_token_123",
                    "extensions": ["Economy", "1 carry-on bag"],
                    "flights": [
                        {
                            "airline": "American Airlines",
                            "flight_number": "AA2413",
                            "airplane": "Boeing 737 MAX 8",
                            "departure_airport": {"id": "DFW", "name": "Dallas Fort Worth", "time": "2026-12-25 07:10"},
                            "arrival_airport": {"id": "JFK", "name": "John F. Kennedy International", "time": "2026-12-25 10:45"},
                            "duration": 215,
                        }
                    ],
                }
            ],
            "price_insights": {"lowest_price": 17600},
        }

        with patch("travel_agent.services.flight_service.Config.refresh"), patch.object(
            Config, "FLIGHT_PROVIDER", "serpapi"
        ), patch.object(Config, "SERPAPI_API_KEY", "test-key"), patch.object(
            Config, "SERPAPI_GL", "us"
        ), patch.object(Config, "SERPAPI_HL", "en"), patch.object(
            Config, "SERPAPI_CURRENCY", "USD"
        ), patch(
            "travel_agent.services.flight_service.flight_service._fetch_serpapi_payload",
            side_effect=[autocomplete_origin, autocomplete_destination, serpapi_payload],
        ):
            results = await search_flights("Varanasi", "Jabalpur", "2026-12-25", sort_by="cheapest")

        self.assertEqual(results["status"], "success")
        self.assertEqual(results["provider"], "serpapi")
        self.assertTrue(results["live_data"])
        self.assertEqual(results["items"][0]["flight_id"], "dep_token_123")
        self.assertEqual(results["items"][0]["display_price"], 18450.0)
        self.assertEqual(results["items"][0]["fare_options"][0]["name"], "Economy")
        self.assertEqual(results["price_insights"]["lowest_price"], 17600)
        self.assertEqual(results["search_criteria"]["origin"], "VNS")
        self.assertEqual(results["search_criteria"]["destination"], "JLR")

    async def test_search_flights_falls_back_to_local_when_serpapi_is_unavailable(self):
        with patch("travel_agent.services.flight_service.Config.refresh"), patch.object(
            Config, "FLIGHT_PROVIDER", "serpapi"
        ), patch.object(Config, "SERPAPI_API_KEY", None):
            results = await search_flights("DEL", "GOI", "2026-04-10")

        self.assertEqual(results["provider"], "local_dataset")
        self.assertTrue(results["fallback_used"])
        self.assertEqual(results["provider_requested"], "serpapi")

    async def test_search_flights_keeps_live_no_results_without_fallback(self):
        autocomplete_origin = {
            "suggestions": [
                {
                    "type": "city",
                    "name": "Varanasi, Uttar Pradesh, India",
                    "airports": [{"id": "VNS", "name": "Lal Bahadur Shastri International Airport"}],
                }
            ]
        }
        autocomplete_destination = {
            "suggestions": [
                {
                    "type": "city",
                    "name": "Jabalpur, Madhya Pradesh, India",
                    "airports": [{"id": "JLR", "name": "Jabalpur Airport"}],
                }
            ]
        }
        empty_live_payload = {
            "search_information": {"flights_results_state": "Fully empty"},
            "error": "Google Flights hasn't returned any results for this query.",
            "best_flights": [],
            "other_flights": [],
        }

        with patch("travel_agent.services.flight_service.Config.refresh"), patch.object(
            Config, "FLIGHT_PROVIDER", "serpapi"
        ), patch.object(Config, "SERPAPI_API_KEY", "test-key"), patch.object(
            Config, "SERPAPI_GL", "in"
        ), patch.object(Config, "SERPAPI_HL", "en"), patch.object(
            Config, "SERPAPI_CURRENCY", "INR"
        ), patch(
            "travel_agent.services.flight_service.flight_service._fetch_serpapi_payload",
            side_effect=[autocomplete_origin, autocomplete_destination, empty_live_payload],
        ):
            results = await search_flights("Varanasi", "Jabalpur", "2026-05-12")

        self.assertEqual(results["provider"], "serpapi")
        self.assertEqual(results["status"], "no_results")
        self.assertEqual(results["search_criteria"]["origin"], "VNS")
        self.assertEqual(results["search_criteria"]["destination"], "JLR")
        self.assertEqual(results["no_results_source"], "serpapi_google_flights")
        self.assertIn("Google Flights", results["message"])
        self.assertNotIn("fallback_used", results)

    async def test_search_hotels_returns_structured_results(self):
        with patch("travel_agent.services.hotel_service.Config.refresh"), patch.object(
            Config, "HOTEL_PROVIDER", "local"
        ):
            results = await search_hotels("Goa", "2026-04-10", nights=2, rooms=1, sort_by="cheapest")

        self.assertEqual(results["status"], "success")
        self.assertEqual(results["provider"], "local_dataset")
        self.assertGreaterEqual(results["count"], 1)

        option = results["items"][0]
        self.assertIn("room_options", option)
        self.assertGreaterEqual(len(option["room_options"]), 1)
        self.assertEqual(option["currency"], "INR")
        self.assertGreater(option["display_total_price"], 0)

    async def test_search_hotels_returns_no_available_options_for_unknown_city(self):
        with patch("travel_agent.services.hotel_service.Config.refresh"), patch.object(
            Config, "HOTEL_PROVIDER", "local"
        ):
            results = await search_hotels("Atlantis", "2026-04-10", nights=2, rooms=1)

        self.assertEqual(results["status"], "no_results")
        self.assertEqual(results["message"], "No available options")
        self.assertEqual(results["items"], [])

    async def test_search_hotels_supports_serpapi_provider(self):
        serpapi_payload = {
            "properties": [
                {
                    "name": "Goa Beach Resort",
                    "property_token": "prop_123",
                    "address": "Candolim, Goa, India",
                    "link": "https://example.com/hotel",
                    "type": "hotel",
                    "check_in_time": "3:00 PM",
                    "check_out_time": "12:00 PM",
                    "overall_rating": 4.5,
                    "reviews": 1200,
                    "amenities": ["Pool", "Breakfast included"],
                    "rate_per_night": {"extracted_lowest": 6200},
                    "total_rate": {"extracted_lowest": 12400},
                    "prices": [{"source": "Example Travel", "rate_per_night": {"extracted_lowest": 6200}}],
                    "nearby_places": [{"name": "Airport", "transportations": [{"type": "Taxi", "duration": "35 min"}]}],
                    "free_cancellation": True,
                }
            ]
        }

        with patch("travel_agent.services.hotel_service.Config.refresh"), patch.object(
            Config, "HOTEL_PROVIDER", "serpapi"
        ), patch.object(Config, "SERPAPI_API_KEY", "test-key"), patch.object(
            Config, "SERPAPI_GL", "in"
        ), patch.object(Config, "SERPAPI_HL", "en"), patch.object(
            Config, "SERPAPI_CURRENCY", "INR"
        ), patch(
            "travel_agent.services.hotel_service.hotel_service._fetch_serpapi_payload",
            return_value=serpapi_payload,
        ):
            results = await search_hotels("Goa", "2026-04-10", nights=2, rooms=1, sort_by="cheapest")

        self.assertEqual(results["status"], "success")
        self.assertEqual(results["provider"], "serpapi")
        self.assertTrue(results["live_data"])
        self.assertEqual(results["items"][0]["hotel_id"], "prop_123")
        self.assertEqual(results["items"][0]["display_total_price"], 12400.0)
        self.assertEqual(results["items"][0]["booking_sources"][0]["source"], "Example Travel")

    async def test_search_hotels_falls_back_to_local_when_serpapi_is_unavailable(self):
        with patch("travel_agent.services.hotel_service.Config.refresh"), patch.object(
            Config, "HOTEL_PROVIDER", "serpapi"
        ), patch.object(Config, "SERPAPI_API_KEY", None):
            results = await search_hotels("Goa", "2026-04-10", nights=2, rooms=1)

        self.assertEqual(results["provider"], "local_dataset")
        self.assertTrue(results["fallback_used"])
        self.assertEqual(results["provider_requested"], "serpapi")


if __name__ == "__main__":
    unittest.main()
