import unittest
from unittest.mock import AsyncMock, MagicMock
from travel_agent.agent.orchestrator import AgentOrchestrator
from travel_agent.agent.memory import InMemoryMemory

class TestOrchestrator(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.mock_llm = MagicMock()
        self.mock_llm.call_tool = AsyncMock()
        self.mock_server = MagicMock()
        self.mock_server.call_tool = AsyncMock()
        self.memory = InMemoryMemory()
        self.agent = AgentOrchestrator(self.mock_llm, self.mock_server, self.memory)

    def test_initialization(self):
        self.assertIsInstance(self.agent.memory, InMemoryMemory)

    async def test_run_basic_flow(self):
        # Setup mocks
        self.mock_server.list_tools.return_value = []
        self.mock_llm.call_tool.return_value = {
            "content": "Hello",
            "tool_calls": None
        }
        
        events = [event async for event in self.agent.run_generator("Hi")]
        
        # Verify memory
        messages = self.memory.get_messages()
        self.assertEqual(len(messages), 2) # User + Assistant
        self.assertEqual(messages[0]["content"], "Hi")
        self.assertEqual(messages[1]["content"], "Hello")
        self.assertEqual(events[0]["type"], "message")

    async def test_tool_execution_retry(self):
        # Setup mocks for tool call
        self.mock_server.list_tools.return_value = []
        
        # First LLM call returns a tool call
        # Second LLM call returns final answer
        self.mock_llm.call_tool.side_effect = [
            {
                "content": None,
                "tool_calls": [{
                    "id": "call_1",
                    "name": "test_tool",
                    "arguments": {}
                }]
            },
            {
                "content": "Done",
                "tool_calls": None
            }
        ]
        
        # Mock server tool call to fail once then succeed
        mock_result = MagicMock()
        mock_result.content = [{"text": "Success"}]
        mock_result.isError = False
        
        self.mock_server.call_tool.side_effect = [
            Exception("Temporary failure"),
            mock_result
        ]
        
        events = [event async for event in self.agent.run_generator("Do something")]
        
        # Verify call_tool was called twice (retry)
        self.assertEqual(self.mock_server.call_tool.await_count, 2)
        self.assertTrue(any(event["type"] == "tool_result" for event in events))
        
        
        # Verify memory contains the assistant tool-call turn, the tool result, and the final answer.
        messages = self.memory.get_messages()
        self.assertEqual(len(messages), 4)
        self.assertEqual(messages[0]["role"], "user")
        self.assertEqual(messages[1]["role"], "assistant")
        self.assertIsNone(messages[1]["content"])
        self.assertEqual(messages[2]["role"], "tool")
        self.assertEqual(messages[2]["content"], "Success")
        self.assertEqual(messages[3]["role"], "assistant")
        self.assertEqual(messages[3]["content"], "Done")

if __name__ == "__main__":
    unittest.main()
