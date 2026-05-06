"""Document schemas."""

from typing import Optional
from pydantic import BaseModel
from datetime import datetime


class DocumentBase(BaseModel):
    """Base document schema."""
    name: str


class DocumentCreate(DocumentBase):
    """Document creation schema."""
    file_path: str
    file_type: str
    file_size: int


class DocumentResponse(DocumentBase):
    """Document response schema."""
    id: int
    name: str
    size: str
    type: str
    status: str
    uploadedAt: str
    chunks: Optional[int] = None
    error: Optional[str] = None
    
    class Config:
        from_attributes = True


class DocumentStats(BaseModel):
    """Document statistics schema."""
    total: int
    indexed: int
    processing: int
    error: int
    totalSize: int
