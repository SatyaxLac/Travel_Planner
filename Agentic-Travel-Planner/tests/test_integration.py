import json
import os
import sys
import unittest
from unittest.mock import AsyncMock
from unittest.mock import patch

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from travel_agent.agent.orchestrator import AgentOrchestrator
from travel_agent.config import Config
from travel_agent.mcp.mcp_server import MCPServer
from travel_agent.tools import (
    book_flight,
    book_train,
    get_forecast,
    process_payment,
    rent_car,
    search_flights,
    search_hotels,
    search_trains,
    verify_travel_documents,
)


class TestIntegration(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.server = MCPServer()
        self.server.register_tool(search_flights)
        self.server.register_tool(book_flight)
        self.server.register_tool(search_hotels)
        self.server.register_tool(search_trains)
        self.server.register_tool(book_train)
        self.server.register_tool(rent_car)
        self.server.register_tool(get_forecast)
        self.server.register_tool(process_payment)
        self.server.register_tool(verify_travel_documents)

        self.mock_llm = AsyncMock()
        self.agent = AgentOrchestrator(self.mock_llm, self.server)

    async def test_flight_search_tool_returns_json_payload(self):
        with patch("travel_agent.services.flight_service.Config.refresh"), patch.object(
            Config, "FLIGHT_PROVIDER", "local"
        ):
            result = await self.server.call_tool(
                "search_flights",
                {"origin": "JFK", "destination": "LHR", "date": "2026-12-25"},
            )
        self.assertFalse(result.isError)

        payload = json.loads(result.content[0]["text"])
        self.assertEqual(payload["status"], "success")
        self.assertEqual(payload["search_criteria"]["origin"], "JFK")

    async def test_hotel_search_tool_returns_json_payload(self):
        with patch("travel_agent.services.hotel_service.Config.refresh"), patch.object(
            Config, "HOTEL_PROVIDER", "local"
        ):
            result = await self.server.call_tool(
                "search_hotels",
                {"destination": "Goa", "date": "2026-12-25", "nights": 2, "rooms": 1},
            )
        self.assertFalse(result.isError)

        payload = json.loads(result.content[0]["text"])
        self.assertEqual(payload["status"], "success")
        self.assertEqual(payload["search_type"], "hotel")

    async def test_full_flow(self):
        user_input = "Find flights from NYC to London on 2026-12-25"

        self.mock_llm.call_tool.side_effect = [
            {
                "content": "Searching for flights...",
                "tool_calls": [
                    {
                        "id": "call_1",
                        "name": "search_flights",
                        "arguments": {"origin": "NYC", "destination": "LON", "date": "2026-12-25"},
                    }
                ],
            },
            {
                "content": "I found several flights.",
                "tool_calls": None,
            },
        ]

        events = [event async for event in self.agent.run_generator(user_input)]

        self.assertEqual(self.mock_llm.call_tool.await_count, 2)
        self.assertTrue(any(event["type"] == "tool_result" for event in events))

        messages = self.agent.memory.get_messages()
        self.assertEqual(len(messages), 4)
        self.assertEqual(messages[2]["role"], "tool")

        tool_payload = json.loads(messages[2]["content"])
        self.assertEqual(tool_payload["search_criteria"]["requested_origin"], "NYC")
        self.assertEqual(tool_payload["search_criteria"]["origin"], "JFK")

    async def test_train_search_tool_returns_json_payload(self):
        with patch("travel_agent.services.train_service.Config.refresh"), patch.object(
            Config, "TRAIN_PROVIDER", "local"
        ):
            result = await self.server.call_tool(
                "search_trains",
                {"origin": "DEL", "destination": "LKO", "date": "2026-12-25"},
            )
        self.assertFalse(result.isError)

        payload = json.loads(result.content[0]["text"])
        self.assertEqual(payload["status"], "success")
        self.assertEqual(payload["search_criteria"]["requested_origin"], "DEL")
        self.assertEqual(payload["search_criteria"]["origin"], "NDLS")

    async def test_document_verification_requires_authorization(self):
        result = await self.server.call_tool(
            "verify_travel_documents",
            {
                "full_name": "Alex Traveler",
                "passport_number": "P1234567",
                "authorization_confirmed": False,
            },
        )
        self.assertFalse(result.isError)
        self.assertIn("authorization_required", result.content[0]["text"])


if __name__ == "__main__":
    unittest.main()
