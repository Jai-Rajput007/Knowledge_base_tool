from datetime import datetime
import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Text

from app.db.database import Base

class SupportTicket(Base):
    __tablename__ = "SupportTicket"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenantId = Column(String(36), ForeignKey("Tenant.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False)
    subject = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    status = Column(String(50), default="OPEN")
    
    createdAt = Column(DateTime, default=datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
