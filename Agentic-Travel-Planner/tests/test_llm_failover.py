import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.append(str(PROJECT_ROOT))

from travel_agent.agent.memory import InMemoryMemory
from travel_agent.agent.orchestrator import AgentOrchestrator
from travel_agent.config import Config


QUOTA_ERROR = (
    "Error code: 429 - {'error': {'message': 'You exceeded your current quota, "
    "please check your plan and billing details.', 'type': 'insufficient_quota', "
    "'param': None, 'code': 'insufficient_quota'}}"
)


class QuotaExhaustedLLM:
    provider_name = "openai"
    model = "gpt-4o"

    async def call_tool(self, messages, tools):
        raise Exception(QUOTA_ERROR)


class BackupLLM:
    provider_name = "google"
    model = "gemini-2.5-flash"

    async def call_tool(self, messages, tools):
        return {"content": "Backup provider reply", "tool_calls": None}


class TestLLMFailover(unittest.IsolatedAsyncioTestCase):
    async def test_fails_over_to_backup_provider_on_quota_error(self):
        mock_server = MagicMock()
        mock_server.list_tools.return_value = []
        agent = AgentOrchestrator(QuotaExhaustedLLM(), mock_server, InMemoryMemory())
        backup_llm = BackupLLM()

        with patch.object(
            Config,
            "get_provider_key_map",
            return_value={"openai": "openai-key", "anthropic": None, "google": "google-key"},
        ), patch("travel_agent.agent.orchestrator.get_llm_provider", return_value=backup_llm) as mock_factory:
            events = [event async for event in agent.run_generator("Plan a trip to Tokyo")]

        mock_factory.assert_called_once_with("google", "google-key")
        self.assertEqual(agent.llm.provider_name, "google")

        messages = [event["content"] for event in events if event["type"] == "message"]
        self.assertTrue(any("switched to GOOGLE" in message for message in messages))
        self.assertIn("Backup provider reply", messages)
        self.assertFalse(any(event["type"] == "error" for event in events))

    async def test_returns_clear_quota_message_when_no_backup_exists(self):
        mock_server = MagicMock()
        mock_server.list_tools.return_value = []
        agent = AgentOrchestrator(QuotaExhaustedLLM(), mock_server, InMemoryMemory())

        with patch.object(
            Config,
            "get_provider_key_map",
            return_value={"openai": "openai-key", "anthropic": None, "google": None},
        ), patch("travel_agent.agent.orchestrator.get_llm_provider") as mock_factory:
            events = [event async for event in agent.run_generator("Plan a trip to Tokyo")]

        mock_factory.assert_not_called()

        error_events = [event for event in events if event["type"] == "error"]
        self.assertEqual(len(error_events), 1)
        self.assertIn("no remaining quota", error_events[0]["content"].lower())
        self.assertIn("set llm_provider", error_events[0]["content"].lower())


if __name__ == "__main__":
    unittest.main()
