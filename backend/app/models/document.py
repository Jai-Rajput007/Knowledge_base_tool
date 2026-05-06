"""Document model."""

from datetime import datetime
from enum import Enum as PyEnum
from sqlalchemy import Column, Integer, String, DateTime, Enum, Text, Float
from sqlalchemy.orm import relationship

from app.db.database import Base


class DocumentStatus(str, PyEnum):
    """Document processing status."""
    UPLOADED = "uploaded"
    PROCESSING = "processing"
    INDEXED = "indexed"
    ERROR = "error"


class Document(Base):
    """Document model for storing uploaded files."""
    
    __tablename__ = "documents"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_type = Column(String(50), nullable=False)
    file_size = Column(Integer, nullable=False)  # in bytes
    status = Column(Enum(DocumentStatus), default=DocumentStatus.UPLOADED)
    
    # Processing info
    chunks_count = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    indexed_at = Column(DateTime, nullable=True)
    
    def to_dict(self):
        """Convert to dictionary."""
        return {
            "id": self.id,
            "name": self.name,
            "size": self._format_size(),
            "type": self.file_type.upper(),
            "status": self.status.value,
            "uploadedAt": self._format_date(),
            "chunks": self.chunks_count if self.chunks_count > 0 else None,
            "error": self.error_message
        }
    
    def _format_size(self) -> str:
        """Format file size for display."""
        size = self.file_size
        for unit in ["B", "KB", "MB", "GB"]:
            if size < 1024:
                return f"{size:.1f} {unit}"
            size /= 1024
        return f"{size:.1f} TB"
    
    def _format_date(self) -> str:
        """Format date for display."""
        now = datetime.utcnow()
        diff = now - self.created_at
        
        if diff.days == 0:
            if diff.seconds < 60:
                return "Just now"
            elif diff.seconds < 3600:
                return f"{diff.seconds // 60} minutes ago"
            else:
                return f"{diff.seconds // 3600} hours ago"
        elif diff.days == 1:
            return "Yesterday"
        elif diff.days < 7:
            return f"{diff.days} days ago"
        else:
            return self.created_at.strftime("%Y-%m-%d")
