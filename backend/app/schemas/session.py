from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

class SessionBase(BaseModel):
    title: str = "New Conversation"

class SessionCreate(SessionBase):
    pass

class SessionUpdate(BaseModel):
    title: Optional[str] = None
    status: Optional[str] = None
    is_pinned: Optional[bool] = None

class Session(SessionBase):
    id: str
    user_id: int
    status: str
    is_pinned: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class MessageBase(BaseModel):
    role: str
    content: str

class Message(MessageBase):
    id: int
    session_id: str
    turn_number: int
    created_at: datetime

    class Config:
        from_attributes = True
