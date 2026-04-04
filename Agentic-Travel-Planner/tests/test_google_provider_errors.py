import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.append(str(PROJECT_ROOT))

from travel_agent.agent.llm import GoogleProvider, classify_llm_error, format_llm_error_for_user


class FakeSchema:
    def __init__(self, **kwargs):
        self.kwargs = kwargs


class FakeTool:
    def __init__(self, **kwargs):
        self.kwargs = kwargs


class FakeFunctionDeclaration:
    def __init__(self, **kwargs):
        self.kwargs = kwargs


class FakePart:
    def __init__(self, text=None, inline_data=None, function_response=None, function_call=None):
        self.text = text
        self.inline_data = inline_data
        self.function_response = function_response
        self.function_call = function_call


class FakeContent:
    def __init__(self, role, parts):
        self.role = role
        self.parts = parts


class FakeChat:
    async def send_message_async(self, current_message, tools=None, safety_settings=None):
        raise Exception(
            "429 You exceeded your current quota. "
            "Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests"
        )


class FakeGenerativeModel:
    def __init__(self, model_name, system_instruction=None, safety_settings=None):
        self.model_name = model_name
        self.system_instruction = system_instruction
        self.safety_settings = safety_settings

    def start_chat(self, history=None):
        return FakeChat()


class FakeGenAI:
    protos = SimpleNamespace(
        Schema=FakeSchema,
        Tool=FakeTool,
        FunctionDeclaration=FakeFunctionDeclaration,
        Content=FakeContent,
        Part=FakePart,
        Blob=FakeSchema,
        FunctionResponse=FakeSchema,
        FunctionCall=FakeSchema,
        Type=SimpleNamespace(OBJECT="OBJECT"),
    )
    GenerativeModel = FakeGenerativeModel

    @staticmethod
    def configure(api_key=None):
        return None


class FakeStruct:
    def update(self, payload):
        self.payload = payload


class FakeStructModule:
    Struct = FakeStruct


class TestGoogleProviderErrors(unittest.IsolatedAsyncioTestCase):
    async def test_quota_errors_are_raised_for_orchestrator_handling(self):
        with patch("travel_agent.agent.llm._load_google_sdk", return_value=(FakeGenAI, FakeStructModule)):
            provider = GoogleProvider(api_key="google-key")
            with self.assertRaises(Exception) as exc_info:
                await provider.call_tool(
                    messages=[{"role": "user", "content": "hello"}],
                    tools=[],
                )

        self.assertIn("429", str(exc_info.exception))
        self.assertIn("quota", str(exc_info.exception).lower())

    def test_deprecated_google_model_errors_are_marked_for_failover(self):
        error = Exception(
            "404 This model models/gemini-2.0-flash is no longer available to new users. "
            "Please update your code to use a newer model."
        )

        details = classify_llm_error(error)

        self.assertEqual(details["category"], "invalid_model")
        self.assertTrue(details["should_failover"])

        user_message = format_llm_error_for_user(error, "google")
        self.assertIn("GOOGLE_MODEL", user_message)
        self.assertIn("unavailable or retired", user_message)


if __name__ == "__main__":
    unittest.main()
