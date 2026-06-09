from typing import Annotated
from typing_extensions import TypedDict
from langchain_core.messages import AnyMessage
from langgraph.graph.message import add_messages

class AgentState(TypedDict):
    messages: Annotated[list[AnyMessage], add_messages]
    session_id: str
    user_id: str
    intent: str
    resolved_query: str
    retrieved_rag_context: str
    retrieved_memory_context: str
    requires_clarification: bool
    memory_action_required: bool
