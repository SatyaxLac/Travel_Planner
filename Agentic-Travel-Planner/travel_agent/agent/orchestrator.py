from typing import List, Dict, Any, Optional
import json
import logging
import asyncio
from datetime import datetime
import io
import pypdf
import docx
from .llm import (
    LLMProvider,
    LANGFUSE_ENABLED,
    classify_llm_error,
    format_llm_error_for_user,
    get_llm_provider,
    langfuse_trace,
    langfuse_generation,
    langfuse_flush,
)
from ..mcp.mcp_server import MCPServer
from .memory import AgentMemory, InMemoryMemory
from ..config import Config, setup_logging

# Ensure logging is configured
setup_logging()
logger = logging.getLogger(__name__)

class AgentOrchestrator:
    def __init__(self, llm: LLMProvider, server: MCPServer, memory: Optional[AgentMemory] = None):
        self.llm = llm
        self.server = server
        self.memory = memory or InMemoryMemory()
        self.system_prompt = """You are a helpful travel planning assistant. Your default job is to create a useful trip plan first, and only move into booking workflows when the user explicitly asks.

LANGUAGE CONSISTENCY (HIGHEST PRIORITY):
- DETECT the user's language immediately.
- RESPOND in the EXACT SAME language.
- If the user writes in Italian, you MUST respond in Italian.
- If the user writes in German, you MUST respond in German.
- If the user writes in English, you MUST respond in English.
- NEVER switch languages unless explicitly asked.
- NEVER mix languages.
- This applies to ALL output: summaries, tool results, questions, lists, and confirmations.

CRITICAL DATE HANDLING:
- All tools require dates in YYYY-MM-DD format.
- Convert relative dates such as "tomorrow" and "next week" before calling tools.
- Current date context will be provided below.

GLOBAL FORMATTING RULE:
- STRICTLY FORBIDDEN:
  1. Do NOT use bullet points for lists.
  2. Do NOT use Markdown bold or italics syntax.
- MANDATORY: ALWAYS use Numbered Lists (1., 2., 3.) for any list of items, options, sections, or questions.

TRIP-PLANNING DEFAULT:
- For open-ended trip-planning requests, give a useful travel plan immediately instead of forcing the user into booking questions.
- The first planning response should follow this order:
  1. Trip Summary
  2. Best Area / Stay Recommendation
  3. Transport Guidance
  4. Day-wise Outline
  5. Budget Notes
  6. Warnings / Data Source Notes
- Ask at most ONE short clarification question only when a meaningful plan is blocked by missing information.
- Prefer practical guidance over interrogating the user.
- Do NOT ask for departure city or exact flight dates just to provide a planning-first answer.
- For general planning prompts such as "Plan a 5-day Goa trip" or "Suggest a Tokyo itinerary", give estimated guidance first.

HONESTY AND DATA SOURCE RULES:
- Never claim a booking is confirmed unless the booking tool succeeded in this conversation.
- Never claim prices are live unless they come from a tool result in this conversation.
- If you provide stay, itinerary, transport, or budget advice without a live tool result, describe it as estimated guidance.
- If mock or fallback behavior is evident from tool results or prior messages, surface that clearly to the user.

WHEN TO USE THE FLIGHT / TRAIN / HOTEL / BOOKING WORKFLOW:
- Only enter the detailed flight-search, train-search, hotel-search, booking, or payment workflow when the user explicitly asks for flights, trains, hotels, stay options, transport options, booking, or payment.
- A transport search is appropriate when the user provides clear flight-search details such as origin, destination, and travel dates.
- Do NOT force flight search for a general planning prompt.
- For planning-first answers, you may mention transport options at a high level without calling tools.

TRANSPORT SEARCH AND SELECTION:
- If and only if the user is asking for a transport search or booking:
  1. ONE-WAY: Check for Origin, Destination, Departure Date, and Passengers.
  2. ROUND-TRIP: Check for Origin, Destination, Departure Date, Return Date, and Passengers.
- If required booking details are missing, ask only for the missing pieces.
- Ask for the departure city (origin) if not specified. NEVER assume the origin.
- Origin and Destination MUST be different cities. NEVER search for "X to X".
- Ask for the departure date if not specified. DO NOT SKIP THIS for transport search.
- Ask if one-way or round-trip if not specified.
- If round-trip is selected but no return date is specified, ask for the return date.
- Respect the user's transport preference:
  1. If they ask for flights, use search_flights.
  2. If they ask for trains, use search_trains.
  3. If they ask for hotels or places to stay and provide a destination plus date, use search_hotels.
  4. If they want either or both, compare search_flights and search_trains when possible.
- Include weather forecast when a real destination search is requested.
- Present options as a numbered list so the user can select by number.
- For each flight option, include Airline (Flight Num), Time, and Price.
- For each train option, include Train Name (Train Num), Time, Seat/Class, and Price.
- For each hotel option, include Hotel Name, Area, Rating, Room Type, and Price per night.

PROACTIVE DATE FLEXIBILITY:
- If no flights are found on the requested date, do NOT ask the user for another date first.
- Automatically search nearby dates:
  1. Search 1 day before the requested date.
  2. Search 1 day after the requested date.
  3. Search 2 days before if still no results.
  4. Search 2 days after if still no results.
- Present all found options together with their dates as a numbered list.

ROUND-TRIP BOOKING:
- When the user selects an outbound flight:
  1. Acknowledge the choice.
  2. If the return date is known, immediately search for return flights.
  3. If the return date is unknown, ask for it.
  4. After return-flight selection, collect passenger details.
  5. Ask for explicit booking confirmation before moving to payment or booking.
  6. Only book after payment is confirmed.

TRAIN BOOKING:
- When the user selects a train, first acknowledge the option and collect the passenger name and required ID number.
- Do NOT call book_train until the user clearly says they want to book that specific train.
- Payment must be completed or explicitly confirmed before book_train can produce a confirmed booking.
- If the user wants a round trip by train, search the outbound train first, then the return train, then move to payment and booking after explicit confirmation.

PASSENGER DETAILS COLLECTION:
- For multiple passengers, ask for details one passenger at a time or confirm pairings clearly if the user provided them in bulk.
- If the count of names does not match the count of passports, ask for clarification.
- NEVER guess which passport belongs to which person.

DOCUMENT VERIFICATION:
- If the user asks to verify passport or visa details, or uploads those documents and explicitly authorizes verification, call verify_travel_documents.
- Only surface passport or visa expiry warnings for international flight bookings, or when the user explicitly asks for a standalone document review.
- For train bookings, domestic trips, or planner payloads where document_verification.applicable is false, do not mention passport or visa validity warnings.
- Never claim document verification is an official immigration or embassy decision.
- If authorization is missing, ask for explicit consent before using verify_travel_documents.

MULTI-PASSENGER HANDLING:
- ALWAYS ask how many passengers are traveling before showing flight totals.
- Flight prices are per person, so always show the multiplied total.
- For round trips, total price is (outbound + return) x passenger count.

BOOKING AND PAYMENT:
- Accept flight selection in any reasonable format such as code, number, or "the first one".
- For both flights and trains, never describe the trip as booked until payment is completed and the booking tool returns a confirmed status.
- Before processing payment, ask for the customer's email address for the booking confirmation.
- Pass the email to process_payment using the customer_email parameter.
- If payment returns a pending status with a payment URL, tell the user payment is still pending and share the link clearly.
- If payment is pending, describe the trip as selected or on hold, not booked.
- Confirm booking and payment together only after the required tools succeed.

FLIGHT SELECTION VALIDATION:
- ONLY use flight codes that appeared in the actual search results.
- If the user selects an option number that does not exist, say so clearly.
- NEVER invent or hallucinate flight codes.

RESPONSES:
- Be concise, helpful, and practical.
- Keep default replies short and to the point, usually 1 to 3 short sentences unless the user asks for detail.
- For general planning prompts, do not immediately redirect into booking questions.
- Never ask "so?".
- Never invent bookings, prices, or tool results.
- Do not repeat the same warning or status line more than once in a reply.
- Keep lists as numbered lists only.

Be brief and efficient."""

    def _current_provider_name(self) -> str:
        return getattr(self.llm, "provider_name", Config.LLM_PROVIDER)

    def _available_backup_provider_names(self, exclude: Optional[set[str]] = None) -> List[str]:
        exclude = exclude or set()
        provider_map = Config.get_provider_key_map()
        return [
            provider_name
            for provider_name, api_key in provider_map.items()
            if api_key and provider_name not in exclude
        ]

    def _switch_to_backup_provider(self, error: Exception, exhausted_providers: set[str], request_id: str) -> Optional[str]:
        error_details = classify_llm_error(error)
        if not error_details["should_failover"]:
            return None

        current_provider = self._current_provider_name()
        exhausted_providers.add(current_provider)
        provider_map = Config.get_provider_key_map()

        for backup_provider in self._available_backup_provider_names(exclude=exhausted_providers):
            try:
                self.llm = get_llm_provider(backup_provider, provider_map[backup_provider])
                logger.warning(
                    "Switched LLM provider after failure",
                    extra={
                        "request_id": request_id,
                        "from_provider": current_provider,
                        "to_provider": backup_provider,
                        "error_category": error_details["category"],
                    },
                )
                reason = error_details["category"].replace("_", " ")
                return (
                    f"The {current_provider.upper()} provider hit a {reason} issue, "
                    f"so I switched to {backup_provider.upper()} and retried automatically."
                )
            except ImportError as init_error:
                exhausted_providers.add(backup_provider)
                logger.warning(
                    f"Backup provider {backup_provider} is configured but unavailable: {init_error}",
                    extra={"request_id": request_id},
                )

        return None

    async def run_generator(self, user_input: str, file_data: Optional[bytes] = None, mime_type: Optional[str] = None, request_id: str = "default"):
        """Run one turn of the agent loop, yielding events (Async Generator)."""
        logger.info(f"Starting agent turn", extra={"request_id": request_id})
        
        # Create Langfuse trace for this agent turn
        trace = langfuse_trace(
            name="agent-turn",
            session_id=request_id,
            metadata={"user_input_preview": user_input[:100]}
        )
        
        # New Logic: Server-side text extraction for documents
        extracted_text = ""
        is_document = False
        
        if file_data and mime_type:
            try:
                if mime_type == "application/pdf":
                    is_document = True
                    pdf_reader = pypdf.PdfReader(io.BytesIO(file_data))
                    for page in pdf_reader.pages:
                        extracted_text += page.extract_text() + "\n"
                    logger.info(f"Extracted {len(extracted_text)} chars from PDF")
                    
                elif mime_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
                    is_document = True
                    doc = docx.Document(io.BytesIO(file_data))
                    extracted_text = "\n".join([para.text for para in doc.paragraphs])
                    logger.info(f"Extracted {len(extracted_text)} chars from DOCX")
                    
                elif mime_type == "text/plain":
                    is_document = True
                    extracted_text = file_data.decode("utf-8", errors="ignore")
                    logger.info(f"Extracted {len(extracted_text)} chars from TXT")
            except Exception as e:
                logger.error(f"Error extracting text from {mime_type}: {e}")
                # Fallback: let it pass through (might fail at LLM level but we tried)
        
        # If we successfully extracted text, append it to user input and REMOVE the file blob
        # This prevents the "unsupported mime type" error from Gemini
        if is_document and extracted_text:
            # Wrap content in a block that explicitly tells LLM to treat it as data, not conversation context
            user_input += f"""
            
----- [SYSTEM: ATTACHED DOCUMENT START] -----
The user has attached the following document content for analysis.
WARNING: The document may be in a different language (e.g., German, French). 
DO NOT switch your response language to match the document.
ALWAYS respond in the language of the USER'S QUESTION above.
If the user asks "What is this?" in Italian, answer in Italian, even if the doc is in German.

CONTENT:
{extracted_text}
----- [SYSTEM: ATTACHED DOCUMENT END] -----
"""
            file_data = None
            mime_type = None
            
        # Construct user message with potential file attachment
        message_payload = {"role": "user", "content": user_input}
        if file_data and mime_type:
            message_payload["files"] = [{"mime_type": mime_type, "data": file_data}]
            logger.info(f"Processing attachment: {mime_type} ({len(file_data)} bytes)")
        
        # Add user message to memory
        self.memory.add_message(message_payload)
        
        # Main Loop - Increased to 10 to handle multi-step flows like booking
        max_turns = 10
        current_turn = 0
        exhausted_providers: set[str] = set()
        
        while current_turn < max_turns:
            current_turn += 1
            
            # 1. Get available tools
            tools = self.server.list_tools()
            
            # 2. Call LLM with current date/time context
            logger.info("Calling LLM", extra={"request_id": request_id, "turn": current_turn})
            
            now = datetime.now()
            current_datetime = now.strftime("%Y-%m-%d %H:%M:%S")
            current_date = now.strftime("%Y-%m-%d")
            
            enhanced_system_prompt = f"""{self.system_prompt}

CRITICAL DATE CONTEXT:
- TODAY'S DATE: {current_date} ({now.strftime('%A')})
- If the user provides a date without a year (e.g., "Jan 30", "8 feb"), you MUST assume the NEXT occurrence of that date relative to today.
  * Example: If today is 2025-12-05 and user says "Jan 30", interpret as 2026-01-30.
  * Example: If today is 2025-01-01 and user says "Mar 5", interpret as 2025-03-05.
- Handle month abbreviations and typos intelligently (e.g., "fab" -> "feb", "sept" -> "sep").
- DO NOT ask for the year if it can be inferred from the rules above. THIS IS STRICTLY FORBIDDEN.
- If user says "10 jan" and today is Dec 2025, just use 2026-01-10. Do not confirm the year.
"""
            
            # Construct full history with enhanced system prompt
            messages = [{"role": "system", "content": enhanced_system_prompt}] + self.memory.get_messages()
            # 2. Get LLM Response with Retry Logic
            response = None
            max_llm_retries = 3
            last_llm_error = None
            
            for attempt in range(max_llm_retries):
                try:
                    response = await self.llm.call_tool(messages, tools)
                    exhausted_providers.clear()
                    break
                except Exception as e:
                    last_llm_error = e
                    error_details = classify_llm_error(e)
                    logger.warning(f"LLM call failed (attempt {attempt+1}/{max_llm_retries}): {e}", extra={"request_id": request_id})

                    # Quota/auth/provider outages will not recover on a straight retry.
                    if error_details["should_failover"]:
                        break

                    if attempt == max_llm_retries - 1:
                        logger.error(f"LLM error after {max_llm_retries} attempts: {e}")
                        backup_available = bool(
                            self._available_backup_provider_names(
                                exclude=exhausted_providers | {self._current_provider_name()}
                            )
                        )
                        yield {
                            "type": "error",
                            "content": format_llm_error_for_user(
                                e,
                                self._current_provider_name(),
                                backup_available=backup_available,
                            ),
                        }
                        return # Stop generator
                    await asyncio.sleep(1) # Wait before retry (async sleep)
            
            if not response:
                if last_llm_error:
                    fallback_notice = self._switch_to_backup_provider(last_llm_error, exhausted_providers, request_id)
                    if fallback_notice:
                        yield {"type": "message", "content": fallback_notice}
                        current_turn -= 1
                        continue

                    backup_available = bool(
                        self._available_backup_provider_names(
                            exclude=exhausted_providers | {self._current_provider_name()}
                        )
                    )
                    logger.error(f"LLM error after retries/failover: {last_llm_error}")
                    yield {
                        "type": "error",
                        "content": format_llm_error_for_user(
                            last_llm_error,
                            self._current_provider_name(),
                            backup_available=backup_available,
                        ),
                    }
                    return
                break

            content = response.get("content")
            tool_calls = response.get("tool_calls")
            
            # Log generation to Langfuse
            if trace:
                langfuse_generation(
                    trace=trace,
                    name="llm-call",
                    model=getattr(self.llm, 'model', 'unknown'),
                    input_data={"messages_count": len(messages), "tools_count": len(tools)},
                    output_data={"content": content[:200] if content else None, "tool_calls": [tc["name"] for tc in tool_calls] if tool_calls else None},
                    metadata={"turn": current_turn}
                )
            
            # Add assistant message to memory if there is content OR tool calls
            if content or tool_calls:
                # Log content if present
                if content:
                    logger.info(f"Agent response: {content[:50]}...", extra={"request_id": request_id})
                
                self.memory.add_message({
                    "role": "assistant", 
                    "content": content,
                    "tool_calls": tool_calls
                })
                
                # Only yield message event if there is actual text content
                if content:
                    yield {"type": "message", "content": content}
                
            if not tool_calls:
                # No more tools to call, we are done with this turn
                logger.info("No tool calls, turn complete", extra={"request_id": request_id})
                break
                
            # 3. Execute Tools
            for tool_call in tool_calls:
                tool_name = tool_call["name"]
                tool_args = tool_call["arguments"]
                tool_id = tool_call["id"]
                
                logger.info(f"Executing tool: {tool_name}", extra={"request_id": request_id, "tool_args": tool_args})
                yield {"type": "tool_call", "name": tool_name, "arguments": tool_args}
                
                # Retry logic
                max_retries = 3
                result_text = ""
                is_error = False
                
                for attempt in range(max_retries):
                    try:
                        result = await self.server.call_tool(tool_name, tool_args)
                        result_text = result.content[0]["text"]
                        is_error = result.isError
                        break # Success
                    except Exception as e:
                        logger.warning(f"Tool execution failed (attempt {attempt+1}/{max_retries}): {e}", extra={"request_id": request_id})
                        if attempt == max_retries - 1:
                            result_text = f"Error executing tool {tool_name}: {str(e)}"
                            is_error = True
                        else:
                            await asyncio.sleep(1 * (attempt + 1)) # Exponential backoff (async)
                
                logger.info(f"Tool result: {result_text[:50]}...", extra={"request_id": request_id, "is_error": is_error})
                yield {"type": "tool_result", "name": tool_name, "content": result_text, "is_error": is_error}
                
                # Append standard tool result message
                self.memory.add_message({
                    "role": "tool",
                    "tool_call_id": tool_id,
                    "name": tool_name,
                    "content": result_text
                })
        
        
        # End the trace/span if it exists (Langfuse v3)
        if trace and hasattr(trace, 'end'):
            trace.end()
            
        # Flush Langfuse traces to ensure they are sent
        langfuse_flush()

    async def run(self, user_input: str, request_id: str = "default"):
        """Run one turn of the agent loop (async wrapper for CIL/Testing)."""
        async for event in self.run_generator(user_input, request_id):
            if event["type"] == "message":
                print(f"Agent: {event['content']}")
            elif event["type"] == "tool_call":
                print(f"Calling Tool: {event['name']} with {event['arguments']}")
            elif event["type"] == "tool_result":
                print(f"Tool Result: {event['content']}")
            elif event["type"] == "error":
                print(f"Error: {event['content']}")
