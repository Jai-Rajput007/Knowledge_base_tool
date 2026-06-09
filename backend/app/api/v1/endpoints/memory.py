"""Memory management endpoints."""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.memory_fact import MemoryFact
from app.models.session import Session as ChatSession
from app.models.session_summary import SessionSummary
from app.models.message import Message
from app.services.memory.ltm_service import LTMService

router = APIRouter()

import traceback
import logging
from fastapi import APIRouter, Depends, HTTPException, Request

logger = logging.getLogger(__name__)

from app.models.entity import SessionEntity

@router.delete("/wipe")
async def wipe_all_memory(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Wipe ALL chat sessions, messages, summaries, and memory facts for the user."""
    try:
        # 1. Get all user facts
        db.query(MemoryFact).filter(MemoryFact.user_id == current_user.id).delete()

        # 2. Get all user sessions
        sessions = db.query(ChatSession).filter(ChatSession.user_id == current_user.id).all()
        for s in sessions:
            db.query(Message).filter(Message.session_id == s.id).delete()
            db.query(SessionSummary).filter(SessionSummary.session_id == s.id).delete()
            db.query(SessionEntity).filter(SessionEntity.session_id == s.id).delete()
            
        # 3. Wipe LangGraph Native Store for User and Sessions
        try:
            if hasattr(request.app.state, "store"):
                store = request.app.state.store
                
                # Delete all facts for this user
                facts_namespace = ("facts", str(current_user.id))
                items = await store.asearch(facts_namespace, limit=1000)
                for item in items:
                    await store.adelete(facts_namespace, item.key)
                
                # Delete profiles for all sessions
                for s in sessions:
                    session_namespace = ("sessions", str(s.id))
                    await store.adelete(session_namespace, "profile")
                    
                logger.info(f"Wiped LangGraph Native Store for user {current_user.id}")
        except Exception as e:
            logger.error(f"Failed to wipe LangGraph Native Store: {e}")

        # 4. Delete Chat Sessions from Relational DB
        db.query(ChatSession).filter(ChatSession.user_id == current_user.id).delete()
        
        # 5. Commit changes
        db.commit()
        logger.info(f"Successfully wiped all relational and native memory for user {current_user.id}")
        return {"message": "All data wiped successfully"}
    except Exception as e:
        db.rollback()
        error_msg = f"Failed to wipe data: {str(e)}\n{traceback.format_exc()}"
        logger.error(error_msg)
        raise HTTPException(status_code=500, detail=f"Failed to wipe data: {str(e)}")

@router.get("/")
async def list_memories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    fact_type: Optional[str] = None
):
    """List all stored facts for the current user."""
    query = db.query(MemoryFact).filter(MemoryFact.user_id == current_user.id)
    if fact_type:
        query = query.filter(MemoryFact.fact_type == fact_type)
    
    memories = query.order_by(MemoryFact.created_at.desc()).all()
    
    # Format the output into standard dicts to avoid FastAPI crashing 
    # when attempting to serialize the pgvector Vector column.
    result = []
    for m in memories:
        result.append({
            "id": m.id,
            "fact_text": m.fact_text,
            "fact_type": m.fact_type,
            "confidence": m.confidence,
            "source_session_id": m.source_session_id,
            "created_at": m.created_at.isoformat() if m.created_at else None,
            "is_active": m.is_active
        })
        
    return result

@router.delete("/{fact_id}")
async def delete_memory(
    fact_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a specific memory fact."""
    fact = db.query(MemoryFact).filter(
        MemoryFact.id == fact_id,
        MemoryFact.user_id == current_user.id
    ).first()
    
    if not fact:
        raise HTTPException(status_code=404, detail="Memory fact not found")
    
    # We could also delete from ChromaDB here, but marking as inactive might be safer
    fact.is_active = False
    db.commit()
    return {"message": "Memory fact deleted"}

@router.get("/search")
async def search_memories(
    q: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Search for relevant memories using semantic search."""
    ltm_service = LTMService(db)
    facts = await ltm_service.retrieve_relevant_facts(
        user_id=current_user.id,
        query=q,
        top_k=5
    )
    return facts
