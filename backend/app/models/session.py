from datetime import datetime
import uuid
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship

from app.db.database import Base

class Session(Base):
    """Chat session model."""
    
    __tablename__ = "sessions"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False, default="New Conversation")
    status = Column(String(20), default="active")  # 'active', 'archived'
    is_pinned = Column(Boolean, default=False)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="sessions")
    messages = relationship("Message", back_populates="session", cascade="all, delete-orphan")
    summaries = relationship("SessionSummary", back_populates="session", cascade="all, delete-orphan")
    memory_facts = relationship("MemoryFact", back_populates="session")
    entities = relationship("SessionEntity", back_populates="session", cascade="all, delete-orphan")
