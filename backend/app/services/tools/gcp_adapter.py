import importlib
import pkgutil
import inspect
from typing import List, Dict, Any
from app.services.tools.base import BaseToolAdapter
from app.core.logging import logger
import app.services.gcp_modules as gcp_modules

class GCPAdapter(BaseToolAdapter):
    """
    Adapter for direct Google Workspace integrations using the ya29.* token.
    Bypasses the MCP proxy layer completely. Dynamically loads 114 tools from gcp_modules/.
    """
    
    def __init__(self, access_token: str):
        self.access_token = access_token
        self.modules = {}
        self.tools_list = []
        self._load_modules()

    def _load_modules(self):
        """Dynamically load all tool modules from app.services.gcp_modules."""
        for _, module_name, _ in pkgutil.iter_modules(gcp_modules.__path__):
            try:
                full_module_name = f"app.services.gcp_modules.{module_name}"
                mod = importlib.import_module(full_module_name)
                
                # Check if module exposes TOOLS and execute_tool
                if hasattr(mod, 'TOOLS') and hasattr(mod, 'execute_tool'):
                    self.modules[module_name] = mod
                    self.tools_list.extend(mod.TOOLS)
                    logger.info(f"[GCPAdapter] Loaded {len(mod.TOOLS)} tools from {module_name}")
            except Exception as e:
                logger.error(f"[GCPAdapter] Failed to load module {module_name}: {e}")

    @property
    def provider_id(self) -> str:
        return "taylorwilsdon/google_workspace_mcp"

    async def get_tools(self, query: str = None) -> List[Dict[str, Any]]:
        return self.tools_list

    async def execute_tool(self, name: str, arguments: dict) -> str:
        logger.info(f"[GCPAdapter] Routing tool '{name}'")
        
        # Find which module owns this tool
        target_module = None
        for mod_name, mod in self.modules.items():
            for tool in mod.TOOLS:
                if tool.get("function", {}).get("name") == name:
                    target_module = mod
                    break
            if target_module:
                break
                
        if not target_module:
            return f"Unknown GCP tool: {name}. Make sure the module is implemented."

        try:
            # Route to the module's execute_tool
            return await target_module.execute_tool(name, arguments, self.access_token)
        except Exception as e:
            logger.error(f"[GCPAdapter] Tool execution failed in module {target_module.__name__}: {e}")
            return f"Error executing {name}: {str(e)}"
