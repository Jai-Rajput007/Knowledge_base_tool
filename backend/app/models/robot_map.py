from sqlalchemy import Column, String, DateTime, Integer, JSON, ForeignKey
from sqlalchemy.sql import func
import uuid

from app.db.database import Base

class RobotMap(Base):
    __tablename__ = "robot_maps"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String, ForeignKey("Tenant.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, index=True, nullable=False)
    file_path = Column(String, nullable=False)
    size_bytes = Column(Integer, nullable=True)
    waypoints = Column(JSON, default=list) # e.g. [{"name": "Living Room", "x": 0.5, "y": 0.0}]
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())