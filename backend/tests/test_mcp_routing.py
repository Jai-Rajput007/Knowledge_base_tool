import asyncio
import sys
import os
from unittest.mock import MagicMock

# Mock psycopg2 to prevent SQLAlchemy import crashes when testing outside the venv
sys.modules['psycopg2'] = MagicMock()
sys.modules['psycopg2.extensions'] = MagicMock()
sys.modules['psycopg2.pool'] = MagicMock()

# Ensure the backend directory is in the python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.tools.public_adapter import PublicToolsAdapter
from app.services.chat_service import ChatService

async def run_tests():
    print("=== STARTING TESTS ===")
    
    # 1. Test Nominatim Geocoding via PublicToolsAdapter
    print("\n--- Testing PublicToolsAdapter (Nominatim Geocoding) ---")
    adapter = PublicToolsAdapter()
    print("Testing city: 'Pachmarhi'")
    weather_result = await adapter._get_weather("Pachmarhi")
    print(f"Result: {weather_result}")
    
    if "Error" in weather_result or "Could not find" in weather_result:
        print("❌ Geocoding test failed!")
    else:
        print("✅ Geocoding test passed!")

    # 2. Test State Router in ChatService
    print("\n--- Testing ChatService State Router ---")
    chat_service = ChatService()
    
    queries = {
        "what is the weather in indore?": "PUBLIC_TOOLS",
        "convert 500 usd to inr": "PUBLIC_TOOLS",
        "what does the employee handbook say about vacation days?": "RAG",
        "send an email to john@example.com": "GCP",
        "hi there, how are you?": "GENERAL"
    }
    
    all_passed = True
    for query, expected_state in queries.items():
        print(f"Query: '{query}'")
        state = await chat_service._route_query(query)
        print(f"Routed State: {state} | Expected: {expected_state}")
        if state != expected_state:
            print("❌ Router test failed for this query!")
            all_passed = False
        else:
            print("✅ Router test passed!")
            
    if all_passed:
        print("\n🎉 ALL TESTS PASSED! 🎉")
    else:
        print("\n⚠️ SOME TESTS FAILED!")

if __name__ == "__main__":
    asyncio.run(run_tests())
