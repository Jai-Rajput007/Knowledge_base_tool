from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Float, Boolean
from sqlalchemy.orm import relationship

from app.db.database import Base

class MemoryFact(Base):
    """Long-term memory structured fact model."""

    __tablename__ = "memory_facts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    fact_text = Column(Text, nullable=False)
    embedding = Column(Text, nullable=True)  # JSON-serialised float list
    fact_type = Column(String(50), nullable=False)  # 'preference', 'biographical', 'project', etc.
    confidence = Column(Float, default=1.0)
    source_session_id = Column(String(36), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=True)
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    last_accessed = Column(DateTime, default=datetime.utcnow)
    access_count = Column(Integer, default=0)

    # Relationships
    user = relationship("User", back_populates="memory_facts")
    session = relationship("Session", back_populates="memory_facts")
