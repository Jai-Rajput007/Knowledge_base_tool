"""Activity log model."""

from datetime import datetime
from enum import Enum as PyEnum
from sqlalchemy import Column, Integer, String, DateTime, Enum, Text, ForeignKey

from app.db.database import Base


class ActivityType(str, PyEnum):
    """Activity type enumeration."""
    SUCCESS = "success"
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"


class Activity(Base):
    """Activity log model for tracking system events."""
    
    __tablename__ = "activities"
    
    id = Column(Integer, primary_key=True, index=True)
    action = Column(String(100), nullable=False)
    target = Column(String(255), nullable=True)
    target_type = Column(String(50), nullable=True)  # document, chat, etc.
    target_id = Column(Integer, ForeignKey("documents.id"), nullable=True)
    
    activity_type = Column(Enum(ActivityType), default=ActivityType.INFO)
    details = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        """Convert to dictionary."""
        return {
            "id": self.id,
            "action": self.action,
            "target": self.target or "-",
            "time": self._format_time(),
            "type": self.activity_type.value
        }
    
    def _format_time(self) -> str:
        """Format timestamp for display."""
        now = datetime.utcnow()
        diff = now - self.created_at
        
        if diff.days == 0:
            if diff.seconds < 60:
                return "Just now"
            elif diff.seconds < 3600:
                return f"{diff.seconds // 60} min ago"
            else:
                return f"{diff.seconds // 3600} hours ago"
        elif diff.days == 1:
            return "1 day ago"
        else:
            return f"{diff.days} days ago"
