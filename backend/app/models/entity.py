from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Float
from sqlalchemy.orm import relationship

from app.db.database import Base

class SessionEntity(Base):
    """Entity tracking within a session."""
    
    __tablename__ = "session_entities"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(36), ForeignKey("sessions.id", ondelete="CASCADE"), index=True, nullable=False)
    entity_name = Column(String(255), nullable=False)
    entity_type = Column(String(50), nullable=True)
    mentions = Column(Text, nullable=True)  # JSON array of turn numbers or contexts
    first_turn = Column(Integer, nullable=False)
    last_turn = Column(Integer, nullable=False)
    salience_score = Column(Float, default=0.0)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    session = relationship("Session", back_populates="entities")
