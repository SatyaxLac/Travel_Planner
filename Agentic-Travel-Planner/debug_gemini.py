import asyncio
import sys
from pathlib import Path
import google.generativeai as genai

PROJECT_ROOT = Path(__file__).resolve().parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.append(str(PROJECT_ROOT))

from travel_agent.config import Config

api_key = Config.GOOGLE_API_KEY
print(f"Using .env from: {Config.ENV_PATH}")
print(f"API Key present: {bool(api_key)}")

if not api_key:
    raise SystemExit("No usable GOOGLE_API_KEY found in .env.")

genai.configure(api_key=api_key)

async def test_gemini():
    try:
        model = genai.GenerativeModel(Config.GOOGLE_MODEL)
        print("Model initialized")

        # Test 1: Simple text
        print("Testing text generation...")
        response = await model.generate_content_async("Hello, can you hear me?")
        print(f"Text Response: {response.text}")

        # Test 2: File (Mock PDF)
        print("Testing file input...")
        # Create a tiny dummy PDF (just a header)
        dummy_pdf_bytes = b"%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/MediaBox [0 0 595 842]\n>>\nendobj\ntrailer\n<<\n/Root 1 0 R\n>>\n%%EOF"
        
        parts = [
            genai.protos.Part(text="What is this file?"),
            genai.protos.Part(
                inline_data=genai.protos.Blob(
                    mime_type="application/pdf",
                    data=dummy_pdf_bytes
                )
            )
        ]
        
        
        # Define a tool
        tool_schema = genai.protos.Tool(
            function_declarations=[genai.protos.FunctionDeclaration(
                name="get_weather",
                description="Get weather",
                parameters=genai.protos.Schema(
                    type=genai.protos.Type.OBJECT,
                    properties={"location": genai.protos.Schema(type=genai.protos.Type.STRING)}
                )
            )]
        )

        print("Sending message with inline data AND tools...")
        content = genai.protos.Content(role="user", parts=parts)
        
        # Start chat emulation
        chat = model.start_chat()
        response_file = await chat.send_message_async(content, tools=[tool_schema])
        print(f"File Response: {response_file.text}")

    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_gemini())
