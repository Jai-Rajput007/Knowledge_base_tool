from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional

class BaseToolAdapter(ABC):
    """
    Base interface for all tool adapters (GCP, Composio, Withone, etc.).
    """
    
    @property
    @abstractmethod
    def provider_id(self) -> str:
        """Returns the provider identifier (e.g., 'taylorwilsdon/google_workspace_mcp', 'composio')"""
        pass

    @abstractmethod
    async def get_tools(self) -> List[dict]:
        """
        Returns a list of OpenAI-compatible tool schemas.
        """
        pass
    @abstractmethod
    async def execute_tool(self, name: str, arguments: dict) -> str:
        """
        Executes a specific tool by name with the given arguments.
        Returns a string result.
        """
        pass
