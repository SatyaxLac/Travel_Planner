import re
from typing import Any, Dict, List, Optional

import httpx

from .config import Config

ELEVENLABS_API_BASE_URL = "https://api.elevenlabs.io/v1"
_MARKDOWN_LINK_PATTERN = re.compile(r"\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)")
_URL_PATTERN = re.compile(r"https?://\S+")
_CODE_FENCE_PATTERN = re.compile(r"```.*?```", re.DOTALL)


def has_voice_api_key() -> bool:
    Config.refresh()
    return bool(Config.ELEVENLABS_API_KEY)


def is_voice_configured() -> bool:
    return has_voice_api_key()


def get_default_voice_id() -> Optional[str]:
    Config.refresh()
    return Config.ELEVENLABS_VOICE_ID


def _get_elevenlabs_headers(accept: str = "application/json") -> Dict[str, str]:
    return {
        "xi-api-key": Config.ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
        "Accept": accept,
    }


def _get_elevenlabs_error_message(response: httpx.Response, fallback_message: str) -> str:
    try:
        payload = response.json()
    except ValueError:
        payload = None

    if isinstance(payload, dict):
        detail = payload.get("detail")
        if isinstance(detail, dict):
            status = str(detail.get("status") or "").strip()
            message = str(detail.get("message") or "").strip()
            if status == "detected_unusual_activity":
                return (
                    "ElevenLabs blocked text-to-speech for this account's Free tier due to "
                    "unusual activity. Use a paid ElevenLabs plan or a different account."
                )
            if message:
                return message
            if status:
                return status
        if isinstance(detail, str) and detail.strip():
            return detail.strip()

        for key in ("message", "error"):
            value = payload.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()

    response_text = (response.text or "").strip()
    return response_text or fallback_message


def get_voice_status() -> Dict[str, Any]:
    Config.refresh()
    return {
        "enabled": is_voice_configured(),
        "provider": "elevenlabs",
        "model_id": Config.ELEVENLABS_MODEL_ID,
        "output_format": Config.ELEVENLABS_OUTPUT_FORMAT,
        "autoplay_supported": True,
        "default_voice_id": Config.ELEVENLABS_VOICE_ID,
        "voice_selection_required": not bool(Config.ELEVENLABS_VOICE_ID),
    }


async def list_available_voices() -> List[Dict[str, Any]]:
    Config.refresh()
    if not has_voice_api_key():
        raise RuntimeError("ElevenLabs is not configured. Add ELEVENLABS_API_KEY first.")

    params = {
        "page_size": 100,
        "sort": "name",
        "sort_direction": "asc",
        "include_total_count": "false",
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                "https://api.elevenlabs.io/v2/voices",
                headers=_get_elevenlabs_headers(),
                params=params,
                timeout=20.0,
            )
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise RuntimeError(
                _get_elevenlabs_error_message(
                    exc.response,
                    "ElevenLabs voice list could not be loaded.",
                )
            ) from exc
        except httpx.HTTPError as exc:
            raise RuntimeError(
                "Could not reach ElevenLabs to load voices. Check your network and try again."
            ) from exc

        payload = response.json()

    voices = []
    for voice in payload.get("voices", []):
        labels = voice.get("labels") or {}
        voices.append({
            "voice_id": voice.get("voice_id"),
            "name": voice.get("name") or "Unnamed voice",
            "category": voice.get("category"),
            "description": voice.get("description"),
            "preview_url": voice.get("preview_url"),
            "labels": labels,
            "accent": labels.get("accent"),
            "gender": labels.get("gender"),
            "age": labels.get("age"),
            "is_default": voice.get("voice_id") == Config.ELEVENLABS_VOICE_ID,
        })

    voices.sort(key=lambda item: (str(item.get("name") or "").lower(), str(item.get("voice_id") or "")))
    return voices


def _normalize_voice_text(text: str) -> str:
    cleaned = text or ""
    cleaned = _CODE_FENCE_PATTERN.sub(" ", cleaned)
    cleaned = _MARKDOWN_LINK_PATTERN.sub(r"\1", cleaned)
    cleaned = _URL_PATTERN.sub(" ", cleaned)
    cleaned = cleaned.replace("â€¢", ", ")
    cleaned = cleaned.replace("->", " to ")
    cleaned = cleaned.replace("•", ", ")
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def prepare_text_for_voice(text: str, max_chars: int = 2500) -> str:
    normalized = _normalize_voice_text(text)
    if not normalized:
        raise ValueError("No speakable text was provided.")
    if len(normalized) > max_chars:
        normalized = normalized[: max_chars - 1].rstrip() + "…"
    return normalized


def get_audio_media_type(output_format: str) -> str:
    normalized = (output_format or "").lower()
    if normalized.startswith("mp3"):
        return "audio/mpeg"
    if normalized.startswith("pcm"):
        return "audio/pcm"
    if normalized.startswith("wav"):
        return "audio/wav"
    return "application/octet-stream"


async def synthesize_speech(
    text: str,
    previous_text: Optional[str] = None,
    next_text: Optional[str] = None,
    voice_id: Optional[str] = None,
) -> bytes:
    Config.refresh()
    if not has_voice_api_key():
        raise RuntimeError("ElevenLabs voice is not configured. Add ELEVENLABS_API_KEY.")

    resolved_voice_id = (voice_id or Config.ELEVENLABS_VOICE_ID or "").strip()
    if not resolved_voice_id:
        raise RuntimeError("Choose an ElevenLabs voice before playback.")

    payload: Dict[str, Any] = {
        "text": prepare_text_for_voice(text),
        "model_id": Config.ELEVENLABS_MODEL_ID,
        "voice_settings": {
            "stability": Config.ELEVENLABS_STABILITY,
            "similarity_boost": Config.ELEVENLABS_SIMILARITY_BOOST,
            "style": Config.ELEVENLABS_STYLE,
            "speed": Config.ELEVENLABS_SPEED,
            "use_speaker_boost": Config.ELEVENLABS_USE_SPEAKER_BOOST,
        },
    }

    if previous_text:
        payload["previous_text"] = prepare_text_for_voice(previous_text, max_chars=600)
    if next_text:
        payload["next_text"] = prepare_text_for_voice(next_text, max_chars=600)

    headers = _get_elevenlabs_headers(accept="audio/mpeg")
    params = {
        "output_format": Config.ELEVENLABS_OUTPUT_FORMAT,
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                f"{ELEVENLABS_API_BASE_URL}/text-to-speech/{resolved_voice_id}",
                headers=headers,
                params=params,
                json=payload,
                timeout=30.0,
            )
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise RuntimeError(
                _get_elevenlabs_error_message(
                    exc.response,
                    "ElevenLabs voice synthesis failed.",
                )
            ) from exc
        except httpx.HTTPError as exc:
            raise RuntimeError(
                "Could not reach ElevenLabs for voice synthesis. Check your network and try again."
            ) from exc

        return response.content
