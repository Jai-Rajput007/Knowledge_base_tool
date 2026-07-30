from datetime import datetime
import uuid
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Text
from sqlalchemy.orm import relationship

from app.db.database import Base

class Tenant(Base):
    __tablename__ = "Tenant"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    host = Column(String(255), nullable=True)
    hostEmail = Column(String(255), nullable=True)
    companyDescription = Column(Text, nullable=True)
    companyLogo = Column(Text, nullable=True)
    companyType = Column(String(100), nullable=True)
    features = Column(Text, default="{}")
    
    createdAt = Column(DateTime, default=datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    notifications = relationship("Notification", back_populates="tenant", cascade="all, delete-orphan")

class McpIntegration(Base):
    __tablename__ = "McpIntegration"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    category = Column(String(100), nullable=False)
    description = Column(Text, nullable=False)
    iconUrl = Column(String(500), nullable=True)
    tier = Column(String(50), default="BASIC")
    
    provider = Column(String(100), nullable=False)
    providerConfig = Column(Text, default="{}")
    requiredFields = Column(Text, default="[]")

class TenantMcpConfig(Base):
    __tablename__ = "TenantMcpConfig"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenantId = Column(String(36), ForeignKey("Tenant.id", ondelete="CASCADE"), nullable=False)
    mcpId = Column(String(36), ForeignKey("McpIntegration.id", ondelete="CASCADE"), nullable=False)
    
    isUnlocked = Column(Boolean, default=False)
    isEnabled = Column(Boolean, default=False)
    credentials = Column(Text, default="{}")
    composioUserId = Column(String(255), nullable=True)
