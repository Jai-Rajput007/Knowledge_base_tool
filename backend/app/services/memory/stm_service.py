"""Short-term memory service using LangChain and SQLAlchemy."""

from typing import List, Optional
import datetime

from langchain_core.chat_history import BaseChatMessageHistory
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage
from sqlalchemy.orm import Session

from app.models.message import Message
from app.models.session import Session as ChatSession
from app.core.logging import logger

class SQLAlchemyChatMessageHistory(BaseChatMessageHistory):
    """LangChain chat history backed by SQLAlchemy."""

    def __init__(self, session_id: str, db: Session):
        self.session_id = session_id
        self.db = db

    @property
    def messages(self) -> List[BaseMessage]:
        """Retrieve all messages for this session from the database."""
        try:
            db_messages = (
                self.db.query(Message)
                .filter(Message.session_id == self.session_id)
                .order_by(Message.turn_number.asc())
                .all()
            )
            
            langchain_messages = []
            for msg in db_messages:
                if msg.role == "user":
                    langchain_messages.append(HumanMessage(content=msg.content))
                elif msg.role == "assistant":
                    langchain_messages.append(AIMessage(content=msg.content))
            return langchain_messages
        except Exception as e:
            logger.error(f"Failed to retrieve messages for session {self.session_id}: {e}")
            return []

    def add_message(self, message: BaseMessage) -> None:
        """Add a new message to the database."""
        try:
            # Get next turn number
            last_msg = (
                self.db.query(Message)
                .filter(Message.session_id == self.session_id)
                .order_by(Message.turn_number.desc())
                .first()
            )
            turn_number = (last_msg.turn_number + 1) if last_msg else 1
            
            # Determine role
            if isinstance(message, HumanMessage):
                role = "user"
            elif isinstance(message, AIMessage):
                role = "assistant"
            else:
                role = "other"
            
            new_msg = Message(
                session_id=self.session_id,
                turn_number=turn_number,
                role=role,
                content=message.content
            )
            self.db.add(new_msg)
            
            # Update session's updated_at timestamp
            session_obj = self.db.query(ChatSession).filter(ChatSession.id == self.session_id).first()
            if session_obj:
                session_obj.updated_at = datetime.datetime.utcnow()
            
            self.db.commit()
                
        except Exception as e:
            logger.error(f"Failed to add message to session {self.session_id}: {e}")
            self.db.rollback()

    def clear(self) -> None:
        """Clear all messages for this session."""
        try:
            self.db.query(Message).filter(Message.session_id == self.session_id).delete()
            self.db.commit()
        except Exception as e:
            logger.error(f"Failed to clear messages for session {self.session_id}: {e}")
            self.db.rollback()


class STMManager:
    """Manager for short-term memory (sliding window)."""
    
    def __init__(self, db: Session):
        self.db = db

    def get_history(self, session_id: str) -> SQLAlchemyChatMessageHistory:
        """Get the chat history object for a session."""
        return SQLAlchemyChatMessageHistory(session_id, self.db)

    def get_context(self, session_id: str, k: int = 15) -> List[BaseMessage]:
        """
        Get the last k messages for the LLM prompt.
        """
        history = self.get_history(session_id)
        all_messages = history.messages
        # We need to return the last k messages (k turns, usually 1 turn = 1 user + 1 assistant)
        # 15 turns would be 30 messages.
        # The instruction says "8-15 turns", so I'll assume k is turns.
        return all_messages[-(k*2):] if all_messages else []
