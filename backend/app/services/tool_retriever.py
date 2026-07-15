from typing import List, Dict, Any
from app.db.database import SessionLocal
from app.models.tool import ToolEmbedding
from app.services.embedding_service import embedding_service
from app.core.logging import logger

class ToolRetrieverService:
    """
    Handles semantic retrieval of tools using PostgreSQL and pgvector.
    """
    
    def retrieve_tools(self, query: str, top_k: int = 7) -> List[str]:
        """
        Embeds the query and fetches the top_k most relevant tool names from Postgres.
        """
        try:
            logger.info(f"[ToolRetriever] Semantically filtering tools for query: {query}")
            query_vector = embedding_service.embed_query(query)
            
            with SessionLocal() as db:
                # Use cosine distance operator (<=>) provided by pgvector
                results = db.query(ToolEmbedding.name).order_by(
                    ToolEmbedding.embedding.cosine_distance(query_vector)
                ).limit(top_k).all()
                
                # results is a list of tuples like [('get_events',), ('list_calendars',)]
                top_tool_names = [r[0] for r in results]
                
            logger.info(f"[ToolRetriever] Selected top tools: {top_tool_names}")
            return top_tool_names
            
        except Exception as e:
            logger.error(f"[ToolRetriever] Tool RAG filtering failed: {e}")
            return []

# Singleton instance
tool_retriever_service = ToolRetrieverService()
