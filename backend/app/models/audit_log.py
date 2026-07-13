from sqlalchemy import Column, String, DateTime, JSON, Text
import uuid
from datetime import datetime
from app.db.database import Base

class AuditLog(Base):
    """Audit log model for tracking tenant actions."""
    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String, index=True, nullable=True) # Scope to tenant
    action = Column(String, index=True, nullable=False)
    endpoint = Column(String, nullable=False)
    method = Column(String, nullable=False)
    status_code = Column(String, nullable=False)
    details = Column(JSON, nullable=True)  # Stores request/response payload or params
    user_id = Column(String, index=True, nullable=True)  # The actor
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
