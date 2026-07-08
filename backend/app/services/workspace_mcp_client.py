import asyncio
import json
import httpx
from typing import Dict, Any, List, Optional

class WorkspaceMCPClient:
    """
    Client for interacting with the centralized Google Workspace MCP Server.
    Connects via Server-Sent Events (SSE) and executes tools using the 
    tenant's Bearer token.
    """
    def __init__(self, mcp_url: str = "http://localhost:8001/mcp"):
        self.mcp_url = mcp_url.rstrip("/")
        self.client = httpx.AsyncClient(timeout=30.0)
        self.session_id: Optional[str] = None
        self._message_id_counter = 1
        
    async def get_tools(self, bearer_token: str) -> List[Dict[str, Any]]:
        """
        Fetches the list of available tools from the MCP server.
        """
        # For HTTP-based MCP, the standard endpoint might be /tools or via JSON-RPC.
        # We will format a JSON-RPC request to tools/list.
        payload = {
            "jsonrpc": "2.0",
            "id": self._message_id_counter,
            "method": "tools/list",
            "params": {}
        }
        self._message_id_counter += 1
        
        headers = {
            "Authorization": f"Bearer {bearer_token}",
            "Content-Type": "application/json"
        }
        
        try:
            # Assuming the MCP server exposes a /message or /rpc endpoint for stateless HTTP POST requests.
            # If it strictly requires SSE, a more complex SSE client loop is needed. 
            # We'll use a direct POST for simplicity assuming a REST/JSON-RPC bridge.
            response = await self.client.post(self.mcp_url, json=payload, headers=headers)
            if response.status_code == 200:
                data = response.json()
                if "result" in data and "tools" in data["result"]:
                    return data["result"]["tools"]
            return []
        except Exception as e:
            print(f"[WorkspaceMCP] Error fetching tools: {e}")
            return []

    async def call_tool(self, tool_name: str, arguments: dict, bearer_token: str) -> str:
        """
        Executes a specific tool on the MCP server.
        """
        payload = {
            "jsonrpc": "2.0",
            "id": self._message_id_counter,
            "method": "tools/call",
            "params": {
                "name": tool_name,
                "arguments": arguments
            }
        }
        self._message_id_counter += 1
        
        headers = {
            "Authorization": f"Bearer {bearer_token}",
            "Content-Type": "application/json"
        }
        
        print(f"[WorkspaceMCP] Calling tool: {tool_name}")
        
        try:
            response = await self.client.post(self.mcp_url, json=payload, headers=headers)
            if response.status_code == 200:
                data = response.json()
                if "result" in data and "content" in data["result"]:
                    # MCP tool responses are typically a list of content objects (e.g. {"type": "text", "text": "..."})
                    content_list = data["result"]["content"]
                    return "\n".join([item.get("text", "") for item in content_list if item.get("type") == "text"])
                if "error" in data:
                    return f"Error: {data['error'].get('message', 'Unknown error')}"
            
            return f"Error: HTTP {response.status_code}"
        except Exception as e:
            print(f"[WorkspaceMCP] Error calling tool: {e}")
            return f"Error executing {tool_name}: {str(e)}"
