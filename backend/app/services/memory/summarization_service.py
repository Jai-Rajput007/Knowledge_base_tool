from typing import List, Optional, Dict, Any
import json
from sqlalchemy.orm import Session
from datetime import datetime

from app.models.session_summary import SessionSummary
from app.models.message import Message
from app.services.embedding_service_optimized import embedding_service_optimized
from app.services.llm_service import llm_service
from app.core.logging import logger

class SummarizationService:
    """Service for hierarchical session summarization."""
    
    def __init__(self, db: Session):
        self.db = db
        self.embedding_service = embedding_service_optimized
        self.collection_name = "session_summaries"

    async def summarize_recent_turns(self, session_id: str, last_n_messages: int = 10) -> Optional[SessionSummary]:
        """Generate a Level 1 summary for the most recent messages."""
        try:
            # 1. Get messages
            messages = (
                self.db.query(Message)
                .filter(Message.session_id == session_id)
                .order_by(Message.turn_number.desc())
                .limit(last_n_messages)
                .all()
            )
            messages.reverse() # Order by turn number asc
            
            if not messages:
                return None
                
            turn_start = messages[0].turn_number
            turn_end = messages[-1].turn_number
            
            # 2. Format for LLM
            history_text = "\n".join([f"{msg.role.capitalize()}: {msg.content}" for msg in messages])
            
            prompt = f"""
            Summarize the following conversation snippet concisely. 
            Highlight key points, decisions, and any specific tasks or questions discussed.
            
            Conversation:
            {history_text}
            
            Summary (max 3-4 sentences):
            """
            
            summary_text = llm_service.chat(
                user_message=prompt,
                system_prompt="You are an expert at summarizing conversations concisely."
            )
            
            # 3. Save to SQLite
            new_summary = SessionSummary(
                session_id=session_id,
                summary_level=1,
                turn_range_start=turn_start,
                turn_range_end=turn_end,
                summary_text=summary_text.strip()
            )
            self.db.add(new_summary)
            self.db.commit()
            self.db.refresh(new_summary)
            
            return new_summary
            
        except Exception as e:
            logger.error(f"Failed to summarize recent turns: {e}")
            self.db.rollback()
            return None

    async def get_latest_summary(self, session_id: str) -> Optional[str]:
        """Get the most recent summary for a session."""
        summary = (
            self.db.query(SessionSummary)
            .filter(SessionSummary.session_id == session_id)
            .order_by(SessionSummary.created_at.desc())
            .first()
        )
        return summary.summary_text if summary else None

    async def archive_session_summary(self, session_id: str, user_id: int):
        """Generate a Level 3 archival summary and store in ChromaDB."""
        try:
            # 1. Get all messages for the session
            messages = (
                self.db.query(Message)
                .filter(Message.session_id == session_id)
                .order_by(Message.turn_number.asc())
                .all()
            )
            
            if not messages:
                return
                
            # 2. Generate overall summary
            history_text = "\n".join([f"{msg.role.capitalize()}: {msg.content}" for msg in messages])
            
            prompt = f"""
            Provide a comprehensive archival summary of this entire chat session.
            Include the main topics discussed, any conclusions reached, and important context.
            
            Full Conversation:
            {history_text}
            
            Archive Summary:
            """
            
            archive_text = llm_service.chat(
                user_message=prompt,
                system_prompt="You are an expert archivist. Summarize the whole session for future reference."
            )
            
            # 3. Save to SQLite as Level 3
            summary = SessionSummary(
                session_id=session_id,
                summary_level=3,
                turn_range_start=messages[0].turn_number,
                turn_range_end=messages[-1].turn_number,
                summary_text=archive_text.strip()
            )
            self.db.add(summary)
            self.db.commit()
            self.db.refresh(summary)
            
            
            logger.info(f"Archived summary for session {session_id}")
            
        except Exception as e:
            logger.error(f"Failed to archive session summary: {e}")
            self.db.rollback()
