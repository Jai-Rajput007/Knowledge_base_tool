"""Session endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import List
import uuid

from app.db.database import get_db
from app.models.user import User
from app.models.session import Session as ChatSession
from app.models.message import Message
from app.models.memory_fact import MemoryFact
from app.schemas.session import Session as SessionSchema, SessionCreate, SessionUpdate, Message as MessageSchema
from app.core.security import get_current_user
from app.core.logging import logger

router = APIRouter()

@router.post("/", response_model=SessionSchema, status_code=status.HTTP_201_CREATED)
async def create_session(
    session_data: SessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new chat session."""
    try:
        new_session = ChatSession(
            id=str(uuid.uuid4()),
            user_id=current_user.id,
            title=session_data.title
        )
        db.add(new_session)
        db.commit()
        db.refresh(new_session)
        return new_session
    except Exception as e:
        logger.error(f"Failed to create session: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create session")

@router.get("/", response_model=List[SessionSchema])
async def list_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all chat sessions for the current user."""
    return db.query(ChatSession).filter(ChatSession.user_id == current_user.id).order_by(ChatSession.updated_at.desc()).all()

@router.get("/{session_id}", response_model=SessionSchema)
async def get_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific session."""
    session = db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session

@router.get("/{session_id}/messages", response_model=List[MessageSchema])
async def get_session_messages(
    session_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all messages for a specific session from LangGraph checkpointer."""
    session = db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    graph = request.app.state.graph
    state = await graph.aget_state({"configurable": {"thread_id": session_id}})
    
    formatted_messages = []
    if state and hasattr(state, "values") and "messages" in state.values:
        for i, msg in enumerate(state.values["messages"]):
            role = "user" if msg.type == "human" else "assistant"
            # Using current time as fallback for created_at
            from datetime import datetime
            formatted_messages.append({
                "id": i,
                "session_id": session_id,
                "role": role,
                "content": msg.content,
                "turn_number": i,
                "created_at": datetime.utcnow()
            })
            
    return formatted_messages

@router.put("/{session_id}", response_model=SessionSchema)
async def update_session(
    session_id: str,
    session_data: SessionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update session metadata."""
    session = db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    for key, value in session_data.model_dump(exclude_none=True).items():
        setattr(session, key, value)
    
    db.commit()
    db.refresh(session)
    return session

@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a chat session and all associated memory facts and vectors."""
    session = db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # 1. Delete associated MemoryFacts from SQLite/Postgres
    db.query(MemoryFact).filter(MemoryFact.source_session_id == session_id).delete()
        
    # 2. Archival summary vectors are now natively stored in Postgres (if implemented),
    # but since session_summaries is a table, we can just delete from it natively.
        
    # 3. Manually delete all child records to prevent SQLite foreign key constraint errors
    from app.models.session_summary import SessionSummary
    from app.models.entity import SessionEntity
    
    db.query(Message).filter(Message.session_id == session_id).delete()
    db.query(SessionSummary).filter(SessionSummary.session_id == session_id).delete()
    db.query(SessionEntity).filter(SessionEntity.session_id == session_id).delete()
        
    # 4. Delete session
    db.delete(session)
    db.commit()
    return None

@router.put("/{session_id}/pin", response_model=SessionSchema)
async def toggle_pin(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Toggle pin status of a session."""
    session = db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session.is_pinned = not session.is_pinned
    db.commit()
    db.refresh(session)
    return session
