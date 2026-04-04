import os
import sys
import json
import logging
import asyncio
from typing import AsyncGenerator
from pathlib import Path

import uvicorn
from fastapi import FastAPI, HTTPException, Request, Form, File, UploadFile
from fastapi.responses import StreamingResponse, FileResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Add project root to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

from travel_agent.config import Config
from travel_agent.agent.llm import get_llm_provider
from travel_agent.mcp.mcp_server import MCPServer
from travel_agent.agent.orchestrator import AgentOrchestrator
from travel_agent.tools import (
    search_flights, 
    book_flight, 
    search_hotels,
    search_trains,
    book_train,
    rent_car, 
    get_forecast, 
    process_payment,
    verify_travel_documents,
    get_current_datetime
)
from travel_agent.voice import (
    get_audio_media_type,
    get_voice_status,
    list_available_voices,
    synthesize_speech,
)

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Mount static files
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# Add CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Agent Global Variable
agent = None


class VoiceSynthesisRequest(BaseModel):
    text: str
    previous_text: str | None = None
    next_text: str | None = None
    voice_id: str | None = None


def build_mock_agent(reason: str = "API keys are missing or exhausted."):
    class MockAgent:
        async def run_generator(self, user_input, file_data=None, mime_type=None, request_id="mock"):
            visible_message = str(user_input).split("Structured planner payload:")[0].strip() or "Structured planner request received."
            yield {
                "type": "message",
                "content": (
                    "All configured AI providers are unavailable right now, so the website is using demo mode. "
                    "The responses below are simulated."
                ),
            }
            yield {"type": "message", "content": f"I received your message: '{visible_message}'. (Mock Agent)"}
            if file_data:
                yield {"type": "message", "content": f"I also received a file: {len(file_data)} bytes."}
            yield {"type": "tool_call", "name": "mock_tool", "arguments": {"query": "test"}}
            await asyncio.sleep(1)
            yield {"type": "tool_result", "name": "mock_tool", "content": "Mock result", "is_error": False}
            yield {
                "type": "message",
                "content": (
                    "This is a simulated response because live providers are unavailable. "
                    f"Latest provider issue: {reason}"
                ),
            }

    return MockAgent()


def should_switch_to_mock(event: dict) -> bool:
    if event.get("type") != "error":
        return False

    content = str(event.get("content", "")).lower()
    return any(
        pattern in content
        for pattern in (
            "no remaining quota",
            "set llm_provider",
            "model is unavailable or retired",
            "update google_model",
            "api key was rejected",
            "temporarily unavailable",
            "rate-limiting requests",
        )
    )

async def initialize_agent():
    global agent
    
    if not Config.validate(): 
        logger.error("Config validation failed.")
        return False

    resolution = Config.resolve_llm_provider()
    provider_name = resolution["provider_name"]
    api_key = resolution["api_key"]

    if resolution["warning"]:
        logger.warning(resolution["warning"])
    if resolution["used_fallback"]:
        logger.info(f"Using fallback LLM provider: {provider_name.upper()}")

    if not api_key:
        logger.error("No valid LLM API key found.")
        return False

    try:
        # LLM Provider is now Async
        llm = get_llm_provider(provider_name, api_key)
    except ImportError as e:
        logger.error(f"Error initializing LLM: {e}")
        return False

    # MCP Server (now supports async tools)
    server = MCPServer()
    server.register_tool(search_flights)
    server.register_tool(book_flight)
    server.register_tool(search_hotels)
    server.register_tool(search_trains)
    server.register_tool(book_train)
    server.register_tool(rent_car)
    server.register_tool(get_forecast)
    server.register_tool(process_payment)
    server.register_tool(verify_travel_documents)
    server.register_tool(get_current_datetime)

    agent = AgentOrchestrator(llm, server)
    logger.info(f"Agent initialized successfully with: {provider_name.upper()}")
    return True

@app.on_event("startup")
async def startup_event():
    success = await initialize_agent()
    if not success:
        logger.warning("Agent initialization failed. Using Mock Agent for UI testing.")

        global agent
        agent = build_mock_agent("Agent initialization failed.")

@app.get("/")
async def index():
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/api/voice/config")
async def voice_config():
    return get_voice_status()


@app.get("/api/voice/voices")
async def voice_voices():
    try:
        return await list_available_voices()
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        logger.error(f"ElevenLabs voice listing failed: {exc}")
        raise HTTPException(status_code=502, detail="Voice list could not be loaded.")


@app.post("/api/voice/speak")
async def voice_speak(payload: VoiceSynthesisRequest):
    try:
        audio_bytes = await synthesize_speech(
            payload.text,
            previous_text=payload.previous_text,
            next_text=payload.next_text,
            voice_id=payload.voice_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        logger.error(f"ElevenLabs synthesis failed: {exc}")
        raise HTTPException(status_code=502, detail="Voice synthesis failed.")

    return Response(
        content=audio_bytes,
        media_type=get_audio_media_type(Config.ELEVENLABS_OUTPUT_FORMAT),
        headers={"Cache-Control": "no-store"},
    )

@app.post("/api/chat")
async def chat(
    message: str = Form(""),
    planner_payload: str = Form(None),
    file: UploadFile = File(None)
):
    """
    Main Chat Endpoint with File Upload Support.
    Accepts multipart/form-data.
    """
    if not agent:
        raise HTTPException(status_code=500, detail="Agent not initialized")
    
    file_data = None
    mime_type = None
    
    if file:
        content = await file.read()
        file_data = content
        mime_type = file.content_type
        logger.info(f"Received file: {file.filename} ({mime_type}, {len(content)} bytes)")

    effective_message = (message or "").strip()
    if planner_payload:
        try:
            parsed_payload = json.loads(planner_payload)
            payload_text = json.dumps(parsed_payload, indent=2)
        except json.JSONDecodeError:
            payload_text = planner_payload

        preface = effective_message or (
            "Create a personalized travel plan using the booking-style planner details below."
        )
        effective_message = (
            f"{preface}\n\n"
            "Structured planner payload:\n"
            f"{payload_text}"
        )

    if not effective_message and not file_data:
        raise HTTPException(status_code=400, detail="A message, planner payload, or file is required.")

    # Define an async generator to stream events to the client
    # This allows the UI to update in real-time as the agent thinks and acts
    async def event_generator() -> AsyncGenerator[str, None]:
        global agent
        current_agent = agent

        # Pass file data to run_generator (requires orchestrator update)
        async for event in current_agent.run_generator(effective_message, file_data=file_data, mime_type=mime_type):
            if should_switch_to_mock(event):
                reason = event.get("content", "Unknown provider failure.")
                logger.warning(f"Switching website to mock mode after provider failure: {reason}")

                agent = build_mock_agent(reason)

                async for mock_event in agent.run_generator(
                    effective_message,
                    file_data=file_data,
                    mime_type=mime_type,
                    request_id="mock-fallback",
                ):
                    yield json.dumps(mock_event) + "\n"
                return

            # We explicitly format as NDJSON (Newline Delimited JSON)
            yield json.dumps(event) + "\n"

    # Return a StreamingResponse to keep the connection open
    return StreamingResponse(event_generator(), media_type="application/x-ndjson")

if __name__ == "__main__":
    uvicorn.run("web_server:app", host="0.0.0.0", port=5000, reload=True)
