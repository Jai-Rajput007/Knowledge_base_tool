"""Retrieve endpoint for the robot NLP pipeline (no LLM call)."""

from typing import List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.config import settings
from app.core.logging import logger
from app.services.retrieval_service import _rerank
from app.services.vector_db_service import vector_db_service
from app.services.embedding_service_optimized import embedding_service_optimized

router = APIRouter()


class RetrieveRequest(BaseModel):
    query: str
    top_k: int = 3
    document_ids: Optional[List[str]] = None


class RetrieveResult(BaseModel):
    id: str
    text: str
    score: float
    document: str
    section: Optional[str] = None


class RetrieveResponse(BaseModel):
    results: List[RetrieveResult]
    query: str


@router.post("/", response_model=RetrieveResponse)
async def retrieve(request: RetrieveRequest):
    """
    Return reranked relevant chunks for a query without calling the LLM.
    Used by the robot NLP pipeline to inject knowledge into its system prompt.
    Mirrors the chat pipeline: fetch reranker_candidates, cross-encode, return top_k.
    """
    try:
        query_embedding = await embedding_service_optimized.embed_query_async(request.query)

        filter_dict = None
        if request.document_ids and len(request.document_ids) == 1:
            filter_dict = {"document_id": request.document_ids[0]}

        # Fetch more candidates than needed so the reranker has room to work
        candidates = max(settings.RERANKER_CANDIDATES, request.top_k * 3)
        raw = vector_db_service.search(
            query_embedding=query_embedding,
            top_k=candidates,
            filter_dict=filter_dict,
        )

        # Post-filter when multiple document IDs given
        if request.document_ids and len(request.document_ids) > 1:
            raw = [r for r in raw if r["metadata"].get("document_id") in request.document_ids]

        # Cross-encoder rerank — same as chat pipeline
        reranked = await _rerank_async(request.query, raw, request.top_k)

        results = []
        for r in reranked:
            meta = r.get("metadata", {})
            results.append(RetrieveResult(
                id=r["id"],
                text=r["text"],
                score=r["score"],
                document=meta.get("filename", "Unknown"),
                section=meta.get("section_path"),
            ))

        logger.info(f"Retrieve '{request.query[:50]}' → {len(results)} results (reranked from {len(raw)})")
        return RetrieveResponse(results=results, query=request.query)

    except Exception as e:
        logger.error(f"Retrieve failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def _rerank_async(query: str, results: list, top_k: int) -> list:
    """Run cross-encoder rerank in a thread so we don't block the event loop."""
    import asyncio
    return await asyncio.get_event_loop().run_in_executor(
        None, _rerank, query, results, top_k
    )
