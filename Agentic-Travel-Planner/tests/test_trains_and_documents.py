import sys
import unittest
from pathlib import Path
from unittest.mock import AsyncMock
from unittest.mock import patch

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.append(str(PROJECT_ROOT))

from travel_agent.config import Config
from travel_agent.tools.documents import verify_travel_documents
from travel_agent.tools.flights import book_flight
from travel_agent.tools.trains import book_train, search_trains


class TestTrainsAndDocuments(unittest.IsolatedAsyncioTestCase):
    async def test_search_trains_returns_structured_results(self):
        with patch("travel_agent.services.train_service.Config.refresh"), patch.object(
            Config, "TRAIN_PROVIDER", "local"
        ):
            results = await search_trains("DEL", "LKO", "2026-05-10")

        self.assertEqual(results["status"], "success")
        self.assertGreaterEqual(results["count"], 1)
        self.assertEqual(results["provider"], "local_dataset")
        self.assertEqual(results["search_criteria"]["origin"], "NDLS")
        self.assertEqual(results["search_criteria"]["destination"], "LKO")

        first_option = results["items"][0]
        self.assertEqual(first_option["origin"], "NDLS")
        self.assertEqual(first_option["destination"], "LKO")
        self.assertEqual(first_option["currency"], "INR")
        self.assertGreaterEqual(len(first_option["class_options"]), 1)

    async def test_search_trains_returns_no_available_options_for_missing_route(self):
        with patch("travel_agent.services.train_service.Config.refresh"), patch.object(
            Config, "TRAIN_PROVIDER", "local"
        ):
            results = await search_trains("DEL", "SIN", "2026-05-10")

        self.assertEqual(results["status"], "no_results")
        self.assertEqual(results["message"], "No available options")
        self.assertEqual(results["items"], [])

    async def test_search_trains_surfaces_rapidapi_subscription_issue(self):
        with patch("travel_agent.services.train_service.Config.refresh"), patch.object(
            Config, "TRAIN_PROVIDER", "rapidapi"
        ), patch.object(Config, "TRAIN_API_KEY", "demo"), patch(
            "travel_agent.services.train_service.train_service._resolve_station_code",
            new=AsyncMock(side_effect=["NDLS", "LKO"]),
        ), patch(
            "travel_agent.services.train_service.train_service._rapidapi_get",
            new=AsyncMock(
                side_effect=RuntimeError(
                    "RapidAPI train search is configured, but this key is not subscribed to the selected train API."
                )
            ),
        ):
            with self.assertRaises(RuntimeError) as context:
                await search_trains("Delhi", "Lucknow", "2026-05-10")

        self.assertIn("not subscribed", str(context.exception))

    async def test_book_train_returns_confirmation(self):
        result = await book_train("12004", "Alex Traveler", "ID998877", payment_confirmed=True)

        self.assertEqual(result["status"], "confirmed")
        self.assertEqual(result["train_id"], "12004")
        self.assertEqual(result["id_number_last4"], "8877")
        self.assertTrue(result["booking_reference"].startswith("TRB"))

    async def test_book_train_requires_payment_before_confirmation(self):
        result = await book_train("12004", "Alex Traveler", "ID998877")

        self.assertEqual(result["status"], "pending_payment")
        self.assertIn("payment", result["message"].lower())
        self.assertTrue(result["reservation_reference"].startswith("TRH"))

    async def test_book_flight_requires_payment_before_confirmation(self):
        result = await book_flight("AI2871", "Alex Traveler", "P1234567")

        self.assertEqual(result["status"], "pending_payment")
        self.assertIn("payment", result["message"].lower())
        self.assertTrue(result["reservation_reference"].startswith("FLH"))

    def test_verify_documents_requires_authorization(self):
        result = verify_travel_documents(
            full_name="Alex Traveler",
            passport_number="P1234567",
            authorization_confirmed=False,
        )

        self.assertEqual(result["status"], "authorization_required")
        self.assertFalse(result["authorized"])

    def test_verify_documents_flags_short_passport_validity(self):
        result = verify_travel_documents(
            full_name="Alex Traveler",
            passport_number="P1234567",
            passport_expiry_date="2026-06-01",
            visa_status="Already have visa",
            visa_expiry_date="2026-05-20",
            destination_country="Japan",
            departure_date="2026-05-10",
            return_date="2026-05-15",
            authorization_confirmed=True,
        )

        self.assertEqual(result["status"], "review_needed")
        self.assertTrue(any("6 months" in warning for warning in result["warnings"]))

    def test_verify_documents_skips_non_international_flight_rules_for_train_booking(self):
        result = verify_travel_documents(
            full_name="Alex Traveler",
            passport_number="P1234567",
            passport_expiry_date="2026-06-01",
            visa_status="Already have visa",
            visa_expiry_date="2026-05-01",
            destination_country="Japan",
            departure_date="2026-05-10",
            return_date="2026-05-15",
            authorization_confirmed=True,
            transport_mode="train",
            is_international_trip=False,
        )

        self.assertEqual(result["status"], "not_applicable")
        self.assertEqual(result["warnings"], [])
        self.assertIn("not an international flight booking", result["summary"])


if __name__ == "__main__":
    unittest.main()
