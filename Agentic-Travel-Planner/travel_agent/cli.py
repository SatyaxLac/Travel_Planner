import os
import sys
import asyncio

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from travel_agent.config import Config
from travel_agent.agent.llm import get_llm_provider
from travel_agent.mcp.mcp_server import MCPServer
from travel_agent.agent.orchestrator import AgentOrchestrator
from travel_agent.tools import (
    search_flights, 
    book_flight, 
    search_trains,
    book_train,
    rent_car, 
    get_forecast, 
    process_payment,
    verify_travel_documents,
    get_current_datetime
)

async def main():
    # 1. Validate Config
    if not Config.validate():
        return

    # 2. Select LLM Provider
    resolution = Config.resolve_llm_provider()
    provider_name = resolution["provider_name"]
    api_key = resolution["api_key"]

    if resolution["warning"]:
        print(f"Warning: {resolution['warning']}")
    if resolution["used_fallback"]:
        print(f"Using fallback LLM provider: {provider_name}")
    if not api_key:
        print(f"Error: API Key for {provider_name} is missing or still set to a template placeholder.")
        return

    try:
        # LLM Provider is now Async
        llm = get_llm_provider(provider_name, api_key)
    except ImportError as e:
        print(f"Error initializing LLM: {e}")
        return

    # 3. Setup MCP Server and Register Tools
    server = MCPServer()
    server.register_tool(search_flights)
    server.register_tool(book_flight)
    server.register_tool(search_trains)
    server.register_tool(book_train)
    server.register_tool(rent_car)
    server.register_tool(get_forecast)
    server.register_tool(process_payment)
    server.register_tool(verify_travel_documents)
    server.register_tool(get_current_datetime)

    # 4. Initialize Agent
    agent = AgentOrchestrator(llm, server)

    print(f"Travel Agent initialized with {provider_name}. Ready to help!")
    print("Type 'quit' to exit.")

    # 5. Interaction Loop
    while True:
        try:
            # Note: input() is blocking but acceptable for CLI demo
            # For true non-blocking CLI, one would use aioconsole
            user_input = input("\nYou: ")
            if user_input.lower() in ["quit", "exit"]:
                break
                
            # Run async agent
            await agent.run(user_input)
            
        except KeyboardInterrupt:
            break
        except Exception as e:
            print(f"An error occurred: {e}")

if __name__ == "__main__":
    asyncio.run(main())
