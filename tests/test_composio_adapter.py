import sys
import os

# Append backend path so imports work
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))
from app.services.tools.composio_adapter import ComposioAdapter

async def main():
    adapter = ComposioAdapter(api_key="ak_HlT2qEnTnTXF1OGcHMEG", user_id="f33cdc1a-4b20-4212-a47d-09c7fec4b169", apps=["github"])
    tools = await adapter.get_tools()
    print(f"Total tools available for user: {len(tools)}")
    if len(tools) == 0:
        print("No tools available. User probably needs to connect an account.")

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
