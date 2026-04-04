import sys
import unittest
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.append(str(PROJECT_ROOT))

from travel_agent.agent.orchestrator import AgentOrchestrator


class CapturingLLM:
    provider_name = "google"
    model = "gemini-2.5-flash"

    def __init__(self):
        self.last_messages = None

    async def call_tool(self, messages, tools):
        self.last_messages = messages
        return {"content": "Stub planning reply", "tool_calls": None}


class DummyServer:
    def list_tools(self):
        return []


class TestPlanningPrompt(unittest.IsolatedAsyncioTestCase):
    async def test_prompt_prioritizes_planning_first_response_structure(self):
        llm = CapturingLLM()
        agent = AgentOrchestrator(llm, DummyServer())

        events = [event async for event in agent.run_generator("Plan a 5-day Goa trip for 2 in March under INR 40000.")]

        self.assertEqual(events[0]["type"], "message")
        prompt = llm.last_messages[0]["content"]

        self.assertIn("For open-ended trip-planning requests, give a useful travel plan immediately", prompt)
        self.assertIn("1. Trip Summary", prompt)
        self.assertIn("2. Best Area / Stay Recommendation", prompt)
        self.assertIn("6. Warnings / Data Source Notes", prompt)

    async def test_prompt_does_not_force_flight_search_for_every_request(self):
        llm = CapturingLLM()
        agent = AgentOrchestrator(llm, DummyServer())

        await agent.run_generator("Suggest a relaxed Tokyo itinerary").__anext__()
        prompt = llm.last_messages[0]["content"]

        self.assertNotIn("MANDATORY DATA CHECK (PERFORM THIS BEFORE ANYTHING ELSE)", prompt)
        self.assertNotIn("Do NOT call search_flights until you have the Departure Date.", prompt)
        self.assertIn("Do NOT force flight search for a general planning prompt.", prompt)

    async def test_prompt_preserves_booking_and_live_data_honesty_rules(self):
        llm = CapturingLLM()
        agent = AgentOrchestrator(llm, DummyServer())

        await agent.run_generator("Find me flights from Delhi to Goa next month").__anext__()
        prompt = llm.last_messages[0]["content"]

        self.assertIn("Never claim a booking is confirmed unless the booking tool succeeded", prompt)
        self.assertIn("Never claim prices are live unless they come from a tool result", prompt)
        self.assertIn("Only enter the detailed flight-search, train-search, booking, or payment workflow", prompt)

    async def test_prompt_supports_train_booking_and_document_authorization(self):
        llm = CapturingLLM()
        agent = AgentOrchestrator(llm, DummyServer())

        await agent.run_generator("I want to book a train and verify my passport").__anext__()
        prompt = llm.last_messages[0]["content"]

        self.assertIn("If they ask for trains, use search_trains.", prompt)
        self.assertIn("book_train", prompt)
        self.assertIn("Do NOT call book_train until the user clearly says they want to book", prompt)
        self.assertIn("Payment must be completed or explicitly confirmed before book_train can produce a confirmed booking", prompt)
        self.assertIn("call verify_travel_documents", prompt)
        self.assertIn("Only surface passport or visa expiry warnings for international flight bookings", prompt)
        self.assertIn("ask for explicit consent before using verify_travel_documents", prompt)

    async def test_prompt_requires_short_replies(self):
        llm = CapturingLLM()
        agent = AgentOrchestrator(llm, DummyServer())

        await agent.run_generator("Book me the first train option").__anext__()
        prompt = llm.last_messages[0]["content"]

        self.assertIn("Keep default replies short and to the point", prompt)
        self.assertIn("Do not repeat the same warning or status line more than once", prompt)


if __name__ == "__main__":
    unittest.main()
