"""Chat schemas."""

from typing import List, Optional
from pydantic import BaseModel


class Source(BaseModel):
    """Source citation schema."""
    id: str
    document: str
    page: Optional[int] = None
    excerpt: str
    score: float


class ChatMessage(BaseModel):
    """Chat message schema."""
    role: str
    content: str
    sources: Optional[List[Source]] = None


class ChatRequest(BaseModel):
    """Chat request schema."""
    message: str
    model: Optional[str] = None
    stream: bool = True


class ChatResponse(BaseModel):
    """Chat response schema."""
    message: ChatMessage
    sources: Optional[List[Source]] = None


class ModelInfo(BaseModel):
    """Model information schema."""
    id: str
    name: str
    provider: str
