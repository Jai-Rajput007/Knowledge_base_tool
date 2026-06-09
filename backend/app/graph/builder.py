from langgraph.graph import StateGraph, START, END
from app.graph.state import AgentState
from app.graph.nodes import (
    coreference_and_router_node,
    clarification_node,
    rag_retrieval_node,
    memory_manager_node,
    persona_generator_node,
    background_summarizer_node,
    entity_extractor_node
)

def create_graph_builder():
    builder = StateGraph(AgentState)
    
    # Add nodes
    builder.add_node("entity_extractor", entity_extractor_node)
    builder.add_node("router", coreference_and_router_node)
    builder.add_node("clarification", clarification_node)
    builder.add_node("rag_retrieval", rag_retrieval_node)
    builder.add_node("memory_manager", memory_manager_node)
    builder.add_node("persona", persona_generator_node)
    builder.add_node("summarizer", background_summarizer_node)
    
    # Define conditional routing functions
    def route_after_router(state: AgentState) -> str:
        if state.get("requires_clarification"):
            return "clarification"
        if state.get("intent") == "rag_search":
            return "rag_retrieval"
        return "memory_manager"
        
    def route_after_persona(state: AgentState) -> str:
        messages = state.get("messages", [])
        if len(messages) > 15:
            return "summarizer"
        return END

    # Connect edges
    builder.add_edge(START, "entity_extractor")
    builder.add_edge("entity_extractor", "router")
    
    builder.add_conditional_edges(
        "router",
        route_after_router,
        {
            "clarification": "clarification",
            "rag_retrieval": "rag_retrieval",
            "memory_manager": "memory_manager"
        }
    )
    
    builder.add_edge("clarification", END)
    builder.add_edge("rag_retrieval", "memory_manager")
    builder.add_edge("memory_manager", "persona")
    
    builder.add_conditional_edges(
        "persona",
        route_after_persona,
        {
            "summarizer": "summarizer",
            END: END
        }
    )
    
    builder.add_edge("summarizer", END)
    
    return builder
