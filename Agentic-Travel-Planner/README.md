# Agentic Travel Planner

Agentic Travel Planner is an AI-powered travel assistant for itinerary planning and flight-first booking workflows. It combines a FastAPI backend, a custom MCP-style tool layer, multi-LLM support, a booking-style web planner, and optional voice features.

Current scope in this version:
- Flight search and booking
- Hotel search
- Car rental
- Weather lookup
- Razorpay payment links
- Travel document pre-checks
- Web UI, CLI, file uploads, and voice playback

Train workflows are not part of the current project version.

## Overview

This project is built around a custom agent loop that can:
- plan trips from open-ended prompts
- search flights and hotels through configurable providers
- collect passenger details and guide booking flows
- create Razorpay payment links with mock fallback support
- verify passport and visa details for international flight bookings
- stream responses live to a browser UI or run in the terminal

## Key Features

### Planning and booking

- Multi-LLM support with OpenAI, Anthropic, and Google Gemini
- Planning-first responses for itinerary requests before pushing users into booking flows
- Flight search and booking with round-trip handling, date flexibility, passenger validation, and booking confirmation rules
- Hotel search with local dataset and SerpApi-backed options
- Car rental tool for simple reservation flows
- Weather lookup using Open-Meteo with fallback behavior
- Razorpay payment-link integration with automatic mock fallback when credentials are missing or invalid
- Travel document pre-checks for international flight bookings after explicit user authorization
- Relative date handling such as "tomorrow", "next week", and missing year inference

### Web experience

- FastAPI web app with streaming chat responses
- Booking-style trip planner form with multi-step itinerary input
- File uploads for PDF, DOCX, TXT, and image-based workflows
- Search history with localStorage persistence, pinning, renaming, sharing, and deletion
- Live tool status cards while the agent is working
- Voice playback with ElevenLabs and browser-voice fallback
- Browser microphone input in supported browsers
- Save-draft planner experience and structured planner payload submission

### Engineering

- Async Python architecture with FastAPI and asyncio
- Custom MCP-style protocol layer for tool registration and execution
- Structured logging and optional Langfuse tracing
- Provider failover for LLM errors such as quota, retired models, or temporary outages
- Local dataset and mock fallbacks for demo continuity
- Unit and integration tests across orchestrator, protocol, payments, voice, and provider behavior
- Docker support for containerized deployment

## Tech Stack

- Backend: Python, FastAPI, Uvicorn
- Frontend: HTML, CSS, vanilla JavaScript
- LLMs: OpenAI, Anthropic, Google Gemini
- Validation: Pydantic
- Networking: httpx
- Config: python-dotenv
- Document parsing: pypdf, python-docx, python-multipart
- Observability: Langfuse
- Voice: ElevenLabs plus browser speech APIs
- Payments: Razorpay
- Testing: unittest
- Deployment: Docker

## Installation

1. Clone the repository:

```bash
git clone https://github.com/SatyaxLac/Travel_Planner.git
cd Travel_Planner
```

2. Create and activate a virtual environment:

```bash
python -m venv venv
```

Windows:

```bash
venv\Scripts\activate
```

macOS or Linux:

```bash
source venv/bin/activate
```

3. Install dependencies:

```bash
pip install -r requirements.txt
```

## Configuration

1. Copy the example environment file:

Windows:

```bash
copy .env.example .env
```

macOS or Linux:

```bash
cp .env.example .env
```

2. Update `.env` with the providers you want to use.

Example:

```ini
# LLM
LLM_PROVIDER=google
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=AIza...
GOOGLE_MODEL=gemini-2.5-flash

# Flight and hotel providers
FLIGHT_PROVIDER=local
HOTEL_PROVIDER=local
FLIGHT_API_KEY=...
FLIGHT_API_SECRET=...
DUFFEL_API_TOKEN=...
SERPAPI_API_KEY=...

# Voice
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=...

# Payments
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...

# Observability
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_HOST=https://cloud.langfuse.com
```

Notes:
- At least one valid LLM API key is required for live responses.
- `LLM_PROVIDER` supports `openai`, `anthropic`, or `google`.
- `FLIGHT_PROVIDER` supports `local`, `serpapi`, `amadeus`, `duffel`, or `mock`.
- `HOTEL_PROVIDER` supports `local` or `serpapi`.
- Placeholder values in `.env.example` are treated as missing.
- If live providers are unavailable, parts of the app fall back to local datasets or mock mode.
- Voice playback works best with ElevenLabs configured, but the browser can act as a fallback in supported environments.

### Optional integrations

Razorpay:
- Add `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` to create real payment links.
- If Razorpay is unavailable or misconfigured, the app falls back to mock payments.
- You can validate your setup with:

```bash
python tests/test_razorpay_config.py
```

Langfuse:
- Add `LANGFUSE_SECRET_KEY`, `LANGFUSE_PUBLIC_KEY`, and optionally `LANGFUSE_HOST`.
- Langfuse is optional. The app still runs if tracing is not configured.

## Usage

### Web app

Start the server:

```bash
python -m uvicorn web_server:app --port 5000 --reload
```

Open:

```text
http://localhost:5000
```

### CLI

Run the terminal assistant:

```bash
python travel_agent/cli.py
```

Example:

```text
You: Plan a 4-day trip to Goa under INR 40000
Agent: Here is an estimated 4-day Goa plan with stay, transport, budget, and day-wise suggestions.
```

## Web UI Highlights

- Multi-step travel planner form
- Streaming assistant messages and tool progress
- Search history with local persistence
- File attachments for travel-related documents
- Voice playback per assistant message
- Browser microphone capture in supported browsers
- Custom modal and toast feedback
- Planner review and summary panels before generation

## Testing

Run the full test suite:

```bash
python -m unittest discover tests -v
```

Coverage includes:
- MCP protocol validation
- agent orchestration
- LLM failover behavior
- flight and hotel search flows
- document verification rules
- payment fallback behavior
- voice synthesis behavior
- web and integration paths

## Project Structure

```text
.
|-- web_server.py
|-- static/
|   |-- index.html
|   |-- css/
|   `-- js/
|-- tests/
|-- travel_agent/
|   |-- cli.py
|   |-- config.py
|   |-- voice.py
|   |-- agent/
|   |   |-- llm.py
|   |   |-- memory.py
|   |   |-- orchestrator.py
|   |   `-- cache.py
|   |-- data/
|   |   |-- flights.json
|   |   `-- hotels.json
|   |-- mcp/
|   |   |-- mcp_server.py
|   |   `-- protocol.py
|   |-- services/
|   |   |-- base_service.py
|   |   |-- flight_service.py
|   |   `-- hotel_service.py
|   `-- tools/
|       |-- flights.py
|       |-- hotels.py
|       |-- cars.py
|       |-- weather.py
|       |-- payment.py
|       |-- documents.py
|       `-- datetime_tool.py
`-- annotated/
```

## Deployment

Build the Docker image:

```bash
docker build -t travel-planner .
```

Run the container:

```bash
docker run -p 5000:5000 --env-file .env travel-planner
```

## Educational Resources

The `annotated/` directory contains commented versions of the main project files for learning and walkthrough purposes.

Useful entry points:
- `annotated/web_server.py`
- `annotated/travel_agent/agent/orchestrator.py`
- `annotated/travel_agent/agent/llm.py`
- `annotated/travel_agent/mcp/mcp_server.py`

## External Services

This project can integrate with:
- OpenAI
- Google Gemini
- SerpApi
- Open-Meteo
- ElevenLabs
- Razorpay
- Langfuse


## Contributing

Pull requests and improvements are welcome.


