from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship

from app.db.database import Base

class SessionSummary(Base):
    """Hierarchical session summary model."""
    
    __tablename__ = "session_summaries"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(36), ForeignKey("sessions.id", ondelete="CASCADE"), index=True, nullable=False)
    summary_level = Column(Integer, default=1)  # 1: recent, 2: session, 3: archive
    turn_range_start = Column(Integer, nullable=False)
    turn_range_end = Column(Integer, nullable=False)
    summary_text = Column(Text, nullable=False)
    key_facts = Column(Text, nullable=True)  # JSON string of extracted facts
    tokens_saved = Column(Integer, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    session = relationship("Session", back_populates="summaries")
