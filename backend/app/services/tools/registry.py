from typing import List, Dict, Any, Optional
from app.services.tools.base import BaseToolAdapter
from app.services.tools.gcp_adapter import GCPAdapter
from app.services.tools.public_adapter import PublicToolsAdapter
from app.core.logging import logger

class ToolRegistryService:
    """
    Dynamically loads and routes tool executions based on tenant configurations.
    """
    
    def __init__(self):
        self.adapters: List[BaseToolAdapter] = []
        self._tool_map: Dict[str, BaseToolAdapter] = {}

    def load_adapters(self, credentials_map: Dict[str, str]):
        """
        Instantiates adapters based on the provided credentials map.
        credentials_map: { provider_id: token_or_api_key }
        """
        self.adapters = []
        self._tool_map = {}
        
        for provider, creds in credentials_map.items():
            if provider == "taylorwilsdon/google_workspace_mcp":
                logger.info("[ToolRegistry] Loading GCPAdapter")
                self.adapters.append(GCPAdapter(access_token=creds))
            elif provider == "public":
                logger.info("[ToolRegistry] Loading PublicToolsAdapter")
                # creds is either a JSON string with {"enabled": ["Weather", ...]} or legacy "enabled"
                try:
                    import json as _json
                    parsed = _json.loads(creds) if isinstance(creds, str) and creds.startswith("{") else {}
                    enabled_integrations = parsed.get("enabled", None)  # None means all
                except Exception:
                    enabled_integrations = None
                self.adapters.append(PublicToolsAdapter(enabled_integrations=enabled_integrations))
            elif provider == "composio":
                logger.info("[ToolRegistry] Loading ComposioAdapter")
                from app.services.tools.composio_adapter import ComposioAdapter
                
                # If creds is a dict, extract api_key and user_id
                try:
                    import json
                    parsed = json.loads(creds)
                    api_key = parsed.get("api_key")
                    user_id = parsed.get("user_id")
                    apps = parsed.get("apps", [])
                    if api_key and user_id:
                        self.adapters.append(ComposioAdapter(api_key=api_key, user_id=user_id, apps=apps))
                    else:
                        logger.error("[ToolRegistry] Missing api_key or user_id in Composio config")
                except Exception as e:
                    logger.error(f"[ToolRegistry] Failed to parse Composio config: {e}")
            elif provider == "withone":
                # To be implemented
                pass
            else:
                logger.warning(f"[ToolRegistry] Unknown provider configuration: {provider}")

    async def get_all_tools(self, query: str = None) -> List[Dict[str, Any]]:
        """
        Aggregates all tools from all loaded adapters and builds the internal routing map.
        Passes the query to adapters if they support filtering.
        """
        all_tools = []
        for adapter in self.adapters:
            tools = await adapter.get_tools(query=query)
            for tool in tools:
                tool_name = tool.get("function", {}).get("name")
                if not tool_name:
                    tool_name = tool.get("name")
                    if tool_name:
                        tool = {"type": "function", "function": tool}
                
                if tool_name:
                    self._tool_map[tool_name] = adapter
                    all_tools.append(tool)
                    
        # Apply Tool RAG Semantic Filtering if there are many tools
        if query and len(all_tools) > 10:
            try:
                from qdrant_client import QdrantClient
                from app.services.embedding_service import embedding_service
                
                logger.info(f"[ToolRegistry] Semantic filtering {len(all_tools)} tools for query: {query}")
                query_vector = embedding_service.embed_query(query)
                client = QdrantClient(path="./qdrant_db")
                
                try:
                    results = client.search(
                        collection_name="global_tools",
                        query_vector=query_vector,
                        limit=7,
                        with_payload=True
                    )
                except AttributeError:
                    results = client.query_points(
                        collection_name="global_tools",
                        query=query_vector,
                        limit=7,
                        with_payload=True
                    ).points
                    
                top_tool_names = [r.payload.get("tool_name") for r in results if r.payload]
                logger.info(f"[ToolRegistry] Selected top tools: {top_tool_names}")
                
                filtered_tools = []
                for t in all_tools:
                    name = t.get("function", {}).get("name")
                    if name in top_tool_names:
                        filtered_tools.append(t)
                
                if filtered_tools:
                    all_tools = filtered_tools
            except Exception as e:
                logger.error(f"[ToolRegistry] Tool RAG filtering failed: {e}")
                
        return all_tools

    async def execute_tool(self, name: str, arguments: dict) -> str:
        """
        Routes the tool execution to the correct adapter.
        """
        adapter = self._tool_map.get(name)
        if not adapter:
            logger.error(f"[ToolRegistry] No adapter found for tool: {name}")
            return f"Error: Tool '{name}' not found in any active integration."
        
        logger.info(f"[ToolRegistry] Routing tool '{name}' to {adapter.provider_id}")
        return await adapter.execute_tool(name, arguments)

# Singleton instance
tool_registry_service = ToolRegistryService()
