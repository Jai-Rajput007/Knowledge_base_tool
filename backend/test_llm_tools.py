import asyncio
import sys
import aiohttp
import json

sys.path.append('.')

from app.services.tools.registry import tool_registry_service

async def run_test():
    print("Testing LLM Tool Selection with 130+ Tools...")
    
    # 1. Load all adapters (GCP + Public)
    # We pass a fake token for GCP just to load the schemas
    creds_map = {
        "taylorwilsdon/google_workspace_mcp": "fake_token_for_testing",
        "public": "enabled"
    }
    tool_registry_service.load_adapters(creds_map)
    
    # Tools are fetched per query now
    
    # 2. Test LLM execution
    queries = [
        "What is the weather in Indore?",
        "Draft an email to test@example.com saying hello.",
        "List my upcoming events on Google Calendar."
    ]
    
    model = "qwen2.5:7b"  # or whatever model is used locally
    
    async with aiohttp.ClientSession() as session:
        for query in queries:
            print(f"\n--- Testing Query: '{query}' ---")
            tools_list = await tool_registry_service.get_all_tools(query=query)
            print(f"Tools retrieved via RAG for query: {len(tools_list)}")
            
            payload = {
                "model": model,
                "messages": [{"role": "user", "content": query}],
                "tools": tools_list,
                "stream": False,
                "options": {"temperature": 0.0}
            }
            try:
                async with session.post("http://localhost:11434/api/chat", json=payload) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        msg = data.get("message", {})
                        if "tool_calls" in msg:
                            print("Success! LLM called tools:")
                            for tc in msg["tool_calls"]:
                                print(f"  -> {tc['function']['name']}({tc['function']['arguments']})")
                        else:
                            print("Failure! LLM did not call any tools. It replied with:")
                            print("  ->", msg.get("content", ""))
                    else:
                        print(f"Ollama API Error: {resp.status} - {await resp.text()}")
            except Exception as e:
                print(f"Request failed: {e}")

if __name__ == "__main__":
    asyncio.run(run_test())
