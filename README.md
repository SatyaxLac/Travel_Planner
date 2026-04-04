# Agentic Travel Workflow

A production-ready, framework-free Agentic Workflow for travel planning built with Python and the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/).

## 🚀 Features

### Core Capabilities
- **Framework-Free**: Built from scratch using standard Python libraries, demonstrating a deep understanding of agentic architectures.
- **MCP Integration**: Implements a custom, lightweight MCP Client/Server architecture for standardized tool communication.
- **Multi-LLM Support**: Seamlessly switch between OpenAI, Anthropic, and Google Gemini models.
    - **Robust Stability**: Includes auto-retries, safety filter handling, and connection error recovery.
    - **Google Gemini 2.5**: Native support for multimodal inputs (Text + Files) and optimized instruction following.
    - **Flexible Configuration**: Case-insensitive `LLM_PROVIDER` (e.g., `GOOGLE` or `google` both work).
- **Integrated Tools**:
    - ✈️ **Flight Search & Booking**: Real-time flight search (Amadeus API) with round-trip support.
        - **Smart Round-Trip Workflow**: Automatically searches for return flights after outbound selection.
        - **🔍 Proactive Date Flexibility**: When no flights are found, automatically searches ±1-2 days and presents all options.
        - **🧠 Smart Date Inference**: Intelligently infers years for dates like "Jan 30" based on "today", handling typos and relative dates without nagging.
        - **✅ Flight Selection Validation**: Prevents hallucinated flight codes - only uses flights from actual search results.
        - **👥 Multi-Passenger Pricing**: Automatically calculates total price × number of passengers.
        - **📋 Passenger Details Confirmation**: Confirms name-passport pairings before booking to avoid mix-ups.
        - **Mock Mode**: Fallback to mock data when API keys are missing.
        - **Smart Booking**: Handles "book the first one" or flight codes.
    - 🚗 **Car Rental**: Reserve vehicles for your trip.
    - ☀️ **Weather Forecast**: Automatically fetched with flight searches.
    - 💳 **Payments**: Razorpay payment-link integration with automatic fallback to mock.
        - **Auto-Payment**: Automatically processes payment after booking.
        - **📧 Email Confirmation**: Uses the customer's email for Razorpay payment-link delivery and booking follow-up.
    - 📅 **Relative Date Handling**: Natural language date support ("tomorrow", "in 2 days", "next week").
- **Interactive CLI & Web UI**: Interact with the agent via a simple terminal interface or a modern, polished Web UI.
- **🌍 Multi-Language Support**: Agent responds in the same language you write in (Italian, Spanish, French, German, etc.).
- **📜 Search History**: Full conversation history with localStorage persistence, delete individual conversations, and quick access to previous queries.

### Production-Ready Features
- **📊 Structured Logging**: JSON-formatted logs with `request_id`, `timestamp`, and contextual metadata for observability.
- **🔭 Langfuse Observability**: Optional LLM tracing and analytics - monitor latency, token usage, and costs.
- **✅ Pydantic Validation**: Strict type validation for all tools using Pydantic models.
- **⚡ Async Architecture**: High-performance asynchronous execution using `asyncio` and `FastAPI`.
- **🔄 Error Handling & Retries**: Exponential backoff retry logic for resilient tool execution.
- **💾 State Management**: Abstract memory interface with in-memory implementation for conversation persistence.
- **🧪 Comprehensive Testing**: Integration tests covering protocol validation, orchestrator logic, and full workflows.
- **🐳 Docker Support**: Multi-stage Dockerfile with security best practices (non-root user).

## 🛠️ Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/yourusername/agentic-travel-workflow.git
    cd agentic-travel-workflow
    ```

2.  **Create and activate a virtual environment**:
    ```bash
    python -m venv venv
    source venv/bin/activate  # On Windows: venv\Scripts\activate
    ```

3.  **Install dependencies**:
    ```bash
    venv\Scripts\python.exe -m pip install -r requirements.txt  # Windows
    venv/bin/python -m pip install -r requirements.txt          # macOS/Linux
    ```

> [!TIP]
> If using VS Code, the included `.vscode/settings.json` will automatically hide `__pycache__` folders for a cleaner workspace.

## ⚙️ Configuration

1.  Copy the example environment file:
    ```bash
    cp .env.example .env
    ```

2.  Open `.env` and add your API keys:
    ```ini
    # LLM API Keys (At least one is required)
    LLM_PROVIDER=openai
    GOOGLE_MODEL=gemini-2.5-flash
    OPENAI_API_KEY=sk-...
    ANTHROPIC_API_KEY=sk-ant-...
    GOOGLE_API_KEY=AIza...

    # Optional Service Keys (Mocks used if missing)
    FLIGHT_API_KEY=...
    FLIGHT_API_SECRET=...
    
    # Payment Processing (Razorpay - Optional, uses mock if missing)
    RAZORPAY_KEY_ID=rzp_test_...
    RAZORPAY_KEY_SECRET=your_razorpay_key_secret_here
    ```

    > [!TIP]
    > **Razorpay Setup (Optional):**
    > 1. Create a free account at [razorpay.com](https://razorpay.com)
    > 2. Switch the dashboard to Test Mode and copy your Key ID and Key Secret
    > 3. Add them to your `.env` file
    > 4. The app creates a hosted Razorpay payment link for the booking amount
    > 5. The app falls back to mock payments if Razorpay keys are not configured
    > 
    > **Test your Razorpay configuration:**
    > ```bash
    > venv\Scripts\python.exe tests/test_razorpay_config.py  # Windows
    > venv/bin/python tests/test_razorpay_config.py          # macOS/Linux
    > ```
    > This will verify your API keys are working correctly.

    > [!TIP]
    > **Langfuse Observability (Optional):**
    > 1. Create a free account at [langfuse.com](https://langfuse.com)
    > 2. Get your API keys from the project settings
    > 3. Add them to your `.env` file:
    >    ```ini
    >    LANGFUSE_SECRET_KEY=sk-lf-...
    >    LANGFUSE_PUBLIC_KEY=pk-lf-...
    >    LANGFUSE_HOST=https://cloud.langfuse.com
    >    ```
    > 4. All LLM calls and agent turns will be traced automatically
    > 5. The app works normally if Langfuse keys are not configured (graceful degradation)
    >
    > **Troubleshooting:**
    > If you encounter issues with traces not appearing, ensure you are using `start_span` and `start_generation` (v3 API) if customizing the tracing logic, as decorators are incompatible with the async agent loop.

    > [!IMPORTANT]
    > The application automatically loads the repo-root `.env` file. Template values such as `your_openai_api_key_here` are treated as missing, so replace them with real keys before starting the app.
    > If you use Google Gemini, `GOOGLE_MODEL` defaults to `gemini-2.5-flash`. Only override it if you have a specific supported model you want to use.

## 🏃 Usage

### Web Interface (Recommended)
Start the FastAPI web server using Uvicorn:
```bash
venv\Scripts\python.exe -m uvicorn web_server:app --port 5000 --reload  # Windows
venv/bin/python -m uvicorn web_server:app --port 5000 --reload          # macOS/Linux
```
Open your browser and navigate to `http://localhost:5000`.

### Command Line Interface
Start the Async CLI agent:
```bash
venv\Scripts\python.exe travel_agent/cli.py  # Windows
venv/bin/python travel_agent/cli.py          # macOS/Linux
```
Type your travel requests and press Enter. Type `quit` to exit.
You: I want to plan a trip to Tokyo next month.
Agent: I'd love to help you plan your trip to Tokyo! When exactly are you thinking of going?
You: From December 10th to December 20th.
Agent: Great! Let me check flights and weather for you...

### Web UI Features

The web interface includes:
- **💬 Chat Interface**: Modern, responsive chat UI with message history
- **🎨 Gemini-Inspired Design**: 
  - Clean light theme with Google blue accents
  - Material Design 3 (MD3) styling guidelines
  - Smooth cubic-bezier animations
  - Pill-shaped buttons and inputs
  - Multi-color gradient hero text
  - Subtle shadows and hover effects
- **🔗 Clickable Links**: Flight booking links rendered as clickable elements
- **🫧 Live Thinking Indicator**: Animated "Thinking..." text with bouncing dots
- **📱 Adaptive Chat Layout**: Smooth transition from welcome screen to a clean, pill-based conversation view
- **📎 Multi-Format File Uploads**: Upload documents (PDFs, DOCX, TXT, images) directly for analysis. Text documents are parsed server-side for maximum compatibility.
- **📜 Collapsible Search History Sidebar**: 
  - Starts collapsed for a cleaner initial view
  - Animated chevron icon rotates on toggle
  - **Context Menu (3-dot)**: Share, Pin, Rename, and Delete conversations
  - **Pin conversations** to keep them at the top of the list
  - Smart timestamps (e.g., "5m ago", "2h ago", "3d ago")
  - Clear all history with confirmation
  - Persistent storage using localStorage (up to 50 conversations)
- **✨ Custom Styled Modals**: 
  - Elegant confirmation dialogs for destructive actions
  - Input modals for renaming (replaces browser prompts)
  - Toast notifications for feedback (replaces browser alerts)
- **✈️ Flexible Flight Booking**:
  - Accept multiple selection formats (flight codes, numbers, or natural language)
  - Clear confirmation messages with booking reference and details
- **📊 Real-time Status**: Live updates as the agent processes tools via server-sent events

## 🧪 Testing

Run the comprehensive test suite:
```bash
venv\Scripts\python.exe -m unittest discover tests -v  # Windows
venv/bin/python -m unittest discover tests -v          # macOS/Linux
```

**Test Coverage**:
- Protocol validation (Pydantic models)
- Orchestrator logic (error handling, retries, memory)
- Full integration workflows

## 📂 Project Structure

```
├── web_server.py           # FastAPI Web Server (Entry Point)
├── static/                 # Frontend Assets
│   ├── index.html
│   ├── css/
│   └── js/
├── travel_agent/
│   ├── cli.py              # CLI Entry point
│   ├── config.py           # Configuration management
│   ├── agent/
│   │   ├── llm.py          # Async LLM Provider wrappers
│   │   ├── orchestrator.py # Core Async Agent logic
│   │   ├── memory.py       # Conversation memory
│   │   └── cache.py        # Performance caching
│   ├── mcp/
│   │   ├── protocol.py     # MCP JSON-RPC definitions
│   │   └── mcp_server.py   # Async MCP Server implementation
│   └── tools/              # Async Tool implementations
│       ├── flights.py
│       ├── cars.py
│       ├── weather.py
│       └── payment.py
```

## 🐳 Deployment

Build and run with Docker:
```bash
# Build the image
docker build -t travel-agent .

# Run the container
docker run -p 5000:5000 --env-file .env travel-agent
```

The Docker image uses a multi-stage build and runs as a non-root user for security.

## 📚 Educational Resources

For those learning about agentic workflows, I have included a fully **annotated version of the codebase** in the `annotated/` directory. Every file is commented to explain its purpose and functionality.

**Key Annotated Files:**
- [Annotated Web Server](annotated/web_server.py) - FastAPI app with streaming responses
- [Annotated Agent Orchestrator](annotated/travel_agent/agent/orchestrator.py) - Core agentic loop
- [Annotated LLM Providers](annotated/travel_agent/agent/llm.py) - Multi-provider abstraction
- [Annotated MCP Server](annotated/travel_agent/mcp/mcp_server.py) - Tool registration and execution

📖 **[View all annotated files →](annotated/README.md)**

## 📜 API Attribution

This application uses the following third-party APIs:

- **[Open-Meteo](https://open-meteo.com/)** - Weather forecast data (Licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/))
- **[Amadeus for Developers](https://developers.amadeus.com/)** - Flight search and booking data (Test environment)

For detailed license information and attribution requirements, please see [LICENSES.md](LICENSES.md).

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[MIT](LICENSE)
