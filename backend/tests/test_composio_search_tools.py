"""
Tests the 4 Composio-backed search tools in PublicToolsAdapter directly —
search_web, search_news, search_local_places, search_local_events.

Calls PublicToolsAdapter.execute_tool() the same way the chat pipeline and the
robot's MCP endpoint do, but bypasses ToolRegistryService and the Postgres
tenant-config lookup entirely — this only needs network access to Composio's
API (COMPOSIO_API_KEY, hardcoded fallback in public_adapter.py unless
overridden via .env), not a working DB. Run this on the Thor, where the DB
container situation doesn't matter for this specific test.

Usage:
    cd knowledge_base_tool/backend
    python3 tests/test_composio_search_tools.py
"""

import asyncio
import sys
import os
from unittest.mock import MagicMock

# Mock psycopg2 so importing app.* doesn't crash outside the full venv —
# this test never touches the DB, same defensive pattern as test_mcp_routing.py
sys.modules['psycopg2'] = MagicMock()
sys.modules['psycopg2.extensions'] = MagicMock()
sys.modules['psycopg2.pool'] = MagicMock()

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.tools.public_adapter import PublicToolsAdapter

# The same 4 example questions used to design this feature — kept as the test
# cases so a pass here is a direct answer to "does this solve the real question".
CASES = [
    (
        "search_local_places",
        {"query": "south indian restaurant", "location": "Vijaynagar, Indore"},
        "best south Indian restaurant near Vijaynagar, Indore",
    ),
    (
        "search_local_events",
        {"query": "music event", "location": "Indore", "date": "2026-08-22"},
        "which music event is happening in Indore on 22 Aug",
    ),
    (
        "search_news",
        {"query": "Madhya Pradesh"},
        "hot news from MP",
    ),
    (
        "search_web",
        {"query": "who won the last cricket world cup"},
        "a general web question",
    ),
]


async def run_tests() -> None:
    print("=== Composio Search Tools — Live Test ===")
    print(f"COMPOSIO_API_KEY set via env: {'yes' if os.environ.get('COMPOSIO_API_KEY') else 'no (using hardcoded fallback in source)'}\n")

    adapter = PublicToolsAdapter()
    all_passed = True

    for tool_name, arguments, human_question in CASES:
        print(f"--- {tool_name} ---")
        print(f"Simulating: \"{human_question}\"")
        print(f"Arguments: {arguments}")

        try:
            result = await adapter.execute_tool(tool_name, arguments)
        except Exception as e:
            result = f"Error executing {tool_name}: raised {type(e).__name__}: {e}"

        preview = result if len(result) <= 800 else result[:800] + "... [truncated]"
        print(f"Result:\n{preview}\n")

        failed = result.startswith(f"Error executing {tool_name}")
        if failed:
            print("❌ FAILED — see error above (paste this back for a fix)\n")
            all_passed = False
        else:
            print("✅ Returned a response (sanity-check the content above manually — this only confirms no error)\n")

    print("=== SUMMARY ===")
    if all_passed:
        print("🎉 All 4 tools returned a response without erroring.")
    else:
        print("⚠️ At least one tool errored — see ❌ entries above.")


if __name__ == "__main__":
    asyncio.run(run_tests())
