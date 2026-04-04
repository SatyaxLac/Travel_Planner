import sys
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import httpx

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.append(str(PROJECT_ROOT))

from travel_agent.config import Config
from travel_agent.voice import (
    get_audio_media_type,
    list_available_voices,
    prepare_text_for_voice,
    synthesize_speech,
)


class TestVoice(unittest.IsolatedAsyncioTestCase):
    def test_prepare_text_for_voice_strips_links_and_urls(self):
        text = "See [booking link](https://example.com) and https://foo.test now."
        prepared = prepare_text_for_voice(text)

        self.assertIn("booking link", prepared)
        self.assertNotIn("https://", prepared)

    def test_get_audio_media_type_returns_mp3_type(self):
        self.assertEqual(get_audio_media_type("mp3_44100_128"), "audio/mpeg")

    async def test_list_available_voices_returns_sorted_simplified_payload(self):
        mock_response = MagicMock()
        mock_response.raise_for_status.return_value = None
        mock_response.json.return_value = {
            "voices": [
                {
                    "voice_id": "voice-b",
                    "name": "Zara",
                    "category": "generated",
                    "description": "Bright and energetic",
                    "preview_url": "https://example.com/zara.mp3",
                    "labels": {"accent": "British", "gender": "female", "age": "young"},
                },
                {
                    "voice_id": "voice-a",
                    "name": "Alex",
                    "category": "professional",
                    "description": "Warm and steady",
                    "preview_url": "https://example.com/alex.mp3",
                    "labels": {"accent": "American", "gender": "male", "age": "adult"},
                },
            ]
        }

        mock_client = AsyncMock()
        mock_client.get.return_value = mock_response
        mock_async_client = AsyncMock()
        mock_async_client.__aenter__.return_value = mock_client

        with patch("travel_agent.voice.Config.refresh"), patch.object(
            Config, "ELEVENLABS_API_KEY", "test-key"
        ), patch.object(
            Config, "ELEVENLABS_VOICE_ID", "voice-b"
        ), patch("travel_agent.voice.httpx.AsyncClient", return_value=mock_async_client):
            voices = await list_available_voices()

        self.assertEqual([voice["voice_id"] for voice in voices], ["voice-a", "voice-b"])
        self.assertEqual(voices[0]["name"], "Alex")
        self.assertEqual(voices[1]["accent"], "British")
        self.assertTrue(voices[1]["is_default"])
        mock_client.get.assert_awaited_once()

    async def test_synthesize_speech_posts_to_elevenlabs(self):
        mock_response = MagicMock()
        mock_response.content = b"audio-bytes"
        mock_response.raise_for_status.return_value = None

        mock_client = AsyncMock()
        mock_client.post.return_value = mock_response
        mock_async_client = AsyncMock()
        mock_async_client.__aenter__.return_value = mock_client

        with patch("travel_agent.voice.Config.refresh"), patch.object(
            Config, "ELEVENLABS_API_KEY", "test-key"
        ), patch.object(
            Config, "ELEVENLABS_VOICE_ID", "voice-123"
        ), patch.object(
            Config, "ELEVENLABS_MODEL_ID", "eleven_multilingual_v2"
        ), patch.object(
            Config, "ELEVENLABS_OUTPUT_FORMAT", "mp3_44100_128"
        ), patch.object(
            Config, "ELEVENLABS_STABILITY", 0.4
        ), patch.object(
            Config, "ELEVENLABS_SIMILARITY_BOOST", 0.8
        ), patch.object(
            Config, "ELEVENLABS_STYLE", 0.3
        ), patch.object(
            Config, "ELEVENLABS_SPEED", 1.0
        ), patch.object(
            Config, "ELEVENLABS_USE_SPEAKER_BOOST", True
        ), patch("travel_agent.voice.httpx.AsyncClient", return_value=mock_async_client):
            audio = await synthesize_speech(
                "Hello there",
                previous_text="Previous line",
                next_text="Next line",
            )

        self.assertEqual(audio, b"audio-bytes")
        mock_client.post.assert_awaited_once()
        called_kwargs = mock_client.post.await_args.kwargs
        self.assertIn("/text-to-speech/voice-123", mock_client.post.await_args.args[0])
        self.assertEqual(called_kwargs["params"]["output_format"], "mp3_44100_128")
        self.assertEqual(called_kwargs["json"]["previous_text"], "Previous line")
        self.assertEqual(called_kwargs["json"]["next_text"], "Next line")

    async def test_synthesize_speech_uses_selected_voice_override(self):
        mock_response = MagicMock()
        mock_response.content = b"override-audio"
        mock_response.raise_for_status.return_value = None

        mock_client = AsyncMock()
        mock_client.post.return_value = mock_response
        mock_async_client = AsyncMock()
        mock_async_client.__aenter__.return_value = mock_client

        with patch("travel_agent.voice.Config.refresh"), patch.object(
            Config, "ELEVENLABS_API_KEY", "test-key"
        ), patch.object(
            Config, "ELEVENLABS_VOICE_ID", "voice-default"
        ), patch.object(
            Config, "ELEVENLABS_MODEL_ID", "eleven_multilingual_v2"
        ), patch.object(
            Config, "ELEVENLABS_OUTPUT_FORMAT", "mp3_44100_128"
        ), patch.object(
            Config, "ELEVENLABS_STABILITY", 0.4
        ), patch.object(
            Config, "ELEVENLABS_SIMILARITY_BOOST", 0.8
        ), patch.object(
            Config, "ELEVENLABS_STYLE", 0.3
        ), patch.object(
            Config, "ELEVENLABS_SPEED", 1.0
        ), patch.object(
            Config, "ELEVENLABS_USE_SPEAKER_BOOST", True
        ), patch("travel_agent.voice.httpx.AsyncClient", return_value=mock_async_client):
            audio = await synthesize_speech("Hello there", voice_id="voice-selected")

        self.assertEqual(audio, b"override-audio")
        self.assertIn("/text-to-speech/voice-selected", mock_client.post.await_args.args[0])

    async def test_synthesize_speech_surfaces_unusual_activity_error(self):
        request = httpx.Request("POST", "https://api.elevenlabs.io/v1/text-to-speech/test-voice")
        response = httpx.Response(
            401,
            request=request,
            json={
                "detail": {
                    "status": "detected_unusual_activity",
                    "message": "Unusual activity detected. Free Tier usage disabled.",
                }
            },
        )

        mock_client = AsyncMock()
        mock_client.post.side_effect = httpx.HTTPStatusError(
            "401 Unauthorized",
            request=request,
            response=response,
        )
        mock_async_client = AsyncMock()
        mock_async_client.__aenter__.return_value = mock_client

        with patch("travel_agent.voice.Config.refresh"), patch.object(
            Config, "ELEVENLABS_API_KEY", "test-key"
        ), patch.object(
            Config, "ELEVENLABS_VOICE_ID", "voice-default"
        ), patch.object(
            Config, "ELEVENLABS_MODEL_ID", "eleven_multilingual_v2"
        ), patch.object(
            Config, "ELEVENLABS_OUTPUT_FORMAT", "mp3_44100_128"
        ), patch.object(
            Config, "ELEVENLABS_STABILITY", 0.4
        ), patch.object(
            Config, "ELEVENLABS_SIMILARITY_BOOST", 0.8
        ), patch.object(
            Config, "ELEVENLABS_STYLE", 0.3
        ), patch.object(
            Config, "ELEVENLABS_SPEED", 1.0
        ), patch.object(
            Config, "ELEVENLABS_USE_SPEAKER_BOOST", True
        ), patch("travel_agent.voice.httpx.AsyncClient", return_value=mock_async_client):
            with self.assertRaises(RuntimeError) as context:
                await synthesize_speech("Hello there")

        self.assertIn("Free tier", str(context.exception))


if __name__ == "__main__":
    unittest.main()
