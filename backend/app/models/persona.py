from datetime import datetime
import uuid
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Text

from app.db.database import Base

class Persona(Base):
    __tablename__ = "Persona"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False, default="Main Robot Persona")
    version = Column(Integer, default=1)
    isActive = Column(Boolean, default=True)
    isTemplate = Column(Boolean, default=False)
    
    robotName = Column(String(255), default="Jarvis")
    robotCompany = Column(String(255), default="Jindal Steel")
    robotLocation = Column(String(255), default="Delhi")
    robotRole = Column(String(255), default="Office assistant robot")
    robotVoice = Column(String(50), default="Male")
    
    systemPrompt = Column(Text, default="")
    conversationRules = Column(Text, default="[]")
    
    wakeWord = Column(String(100), default="hey_jarvis")
    llmMode = Column(String(50), default="local")
    asrMode = Column(String(50), default="parakeet")
    ttsMode = Column(String(50), default="g1_direct")
    
    syncStatus = Column(String(50), default="not_synced")
    lastSyncedAt = Column(DateTime, nullable=True)
    
    createdById = Column(String(36), nullable=True)
    
    createdAt = Column(DateTime, default=datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class PersonaVersion(Base):
    __tablename__ = "PersonaVersion"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    personaId = Column(String(36), ForeignKey("Persona.id", ondelete="CASCADE"))
    
    version = Column(Integer, nullable=False)
    snapshot = Column(Text, nullable=False)
    changeSummary = Column(Text, nullable=True)
    
    syncedToRobot = Column(Boolean, default=False)
    syncedAt = Column(DateTime, nullable=True)
    
    createdById = Column(String(36), nullable=True)
    
    createdAt = Column(DateTime, default=datetime.utcnow)

class PersonaTemplate(Base):
    __tablename__ = "PersonaTemplate"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(100), nullable=True)
    tags = Column(Text, default="[]")
    
    isSystem = Column(Boolean, default=False)
    templateData = Column(Text, default="{}")
    useCount = Column(Integer, default=0)
    
    createdAt = Column(DateTime, default=datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
