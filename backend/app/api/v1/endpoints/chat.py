"""Chat API endpoints with RAG using Ollama."""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.core.logging import logger
from app.core.security import get_current_user
from app.models.user import User
from app.services.chat_service import chat_service, ChatRequest as ChatServiceRequest

router = APIRouter()


class ChatMessage(BaseModel):
    """Chat message schema."""
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    """Chat request schema with query processing, hierarchy, and context building support."""
    message: str
    session_id: Optional[str] = None
    user_id: Optional[int] = None
    document_ids: Optional[List[str]] = None
    
    # Query processing
    enable_query_processing: bool = True  # Enable intent detection and filter extraction
    use_extracted_filters: bool = True  # Auto-apply filters from query
    
    # Hierarchy retrieval
    section_path: Optional[str] = None
    parent_section: Optional[str] = None
    heading_level: Optional[int] = None
    include_parent_context: bool = True
    
    # Content type filtering
    content_types: Optional[List[str]] = None  # "table", "list", "code", "heading"
    
    # Simple metadata filters (key-value pairs)
    metadata_filters: Optional[Dict[str, Any]] = None
    
    # Context building strategy
    context_strategy: str = "hierarchy"  # "standard", "hierarchy", "relevance", "chronological", "compress"
    include_metadata_in_context: bool = True
    include_hierarchy_in_context: bool = True
    
    model: Optional[str] = None
    stream: bool = False


class Source(BaseModel):
    """Source citation schema."""
    id: str
    document: str
    page: Optional[int] = None
    excerpt: str
    score: float


class ChatResponse(BaseModel):
    """Chat response schema."""
    message: ChatMessage
    sources: Optional[List[Source]] = None
    model: str = "ollama"


@router.post("/", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Send a chat message and get AI response with RAG."""
    
    logger.info(f"Chat message received: {request.message[:50]}...")
    
    try:
        # Create chat service request with query processing, hierarchy, and context options
        service_request = ChatServiceRequest(
            message=request.message,
            session_id=request.session_id,
            user_id=current_user.id,  # Always use authenticated user's ID
            document_ids=request.document_ids,
            metadata_filters=request.metadata_filters,
            enable_query_processing=request.enable_query_processing,
            use_extracted_filters=request.use_extracted_filters,
            section_path=request.section_path,
            parent_section=request.parent_section,
            heading_level=request.heading_level,
            include_parent_context=request.include_parent_context,
            content_types=request.content_types,
            context_strategy=request.context_strategy,
            include_metadata_in_context=request.include_metadata_in_context,
            include_hierarchy_in_context=request.include_hierarchy_in_context,
            stream=False,
        )
        
        # Process chat with RAG, hierarchy, prefiltering, and memory
        response = await chat_service.chat(service_request, db=db)
        
        # Format sources with hierarchy info
        sources = []
        for source in response.sources:
            meta = source.get("metadata", {})
            doc_name = meta.get("filename", "Unknown")
            
            # Add section info to document name if available
            section_path = source.get("section_path") or meta.get("section_path")
            if section_path:
                doc_name += f" ({section_path})"
            
            sources.append(Source(
                id=source.get("id", ""),
                document=doc_name,
                page=meta.get("page_number"),
                excerpt=source.get("text", "")[:200],
                score=source.get("score", 0.0),
            ))
        
        return ChatResponse(
            message=ChatMessage(
                role="assistant",
                content=response.response,
            ),
            sources=sources,
            model=response.model,
        )
        
    except Exception as e:
        logger.error(f"Chat error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Chat processing failed: {str(e)}")


@router.post("/stream")
async def chat_stream(
    request: ChatRequest,
    db: Session = Depends(get_db)
):
    """Stream chat response with RAG."""
    
    logger.info(f"Streaming chat message received: {request.message[:50]}...")
    
    async def generate():
        try:
            # Create chat service request with query processing, hierarchy, and context options
            service_request = ChatServiceRequest(
                message=request.message,
                session_id=request.session_id,
                user_id=request.user_id,
                document_ids=request.document_ids,
                metadata_filters=request.metadata_filters,
                enable_query_processing=request.enable_query_processing,
                use_extracted_filters=request.use_extracted_filters,
                section_path=request.section_path,
                parent_section=request.parent_section,
                heading_level=request.heading_level,
                include_parent_context=request.include_parent_context,
                content_types=request.content_types,
                context_strategy=request.context_strategy,
                include_metadata_in_context=request.include_metadata_in_context,
                include_hierarchy_in_context=request.include_hierarchy_in_context,
                top_k=5,
                stream=True,
            )
            
            # Stream response from Ollama
            async for chunk in chat_service.chat_stream(service_request, db=db):
                yield f"data: {chunk}\n\n"
            
            yield "data: [DONE]\n\n"
            
        except Exception as e:
            logger.error(f"Streaming chat error: {str(e)}")
            yield f"data: Error: {str(e)}\n\n"
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )


@router.get("/models")
async def list_models():
    """List available LLM models from Ollama."""
    try:
        models = await chat_service.get_available_models()
        return {
            "models": [
                {"id": m["id"], "name": m["name"], "provider": "ollama"}
                for m in models
            ]
        }
    except Exception as e:
        logger.error(f"Failed to list models: {str(e)}")
        # Return default models if Ollama is not available
        return {
            "models": [
                {"id": "llama3.2:latest", "name": "Llama 3.2", "provider": "ollama"},
                {"id": "mistral:latest", "name": "Mistral", "provider": "ollama"},
            ]
        }
