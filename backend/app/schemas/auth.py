"""Authentication schemas for request/response validation."""

from pydantic import BaseModel
from typing import Optional, Literal
from datetime import datetime


class UserBase(BaseModel):
    username: str
    email: str


class UserCreate(UserBase):
    password: str
    role: Literal["admin", "editor", "user", "viewer"] = "user"


class UserLogin(BaseModel):
    username: str
    password: str


class UserUpdate(BaseModel):
    email: Optional[str] = None
    role: Optional[Literal["admin", "editor", "user", "viewer"]] = None
    is_active: Optional[int] = None
    password: Optional[str] = None


class UserResponse(UserBase):
    id: int
    tenant_id: Optional[str] = None
    role: str
    is_active: int
    requires_password_change: int
    created_at: datetime
    last_login: Optional[datetime] = None

    class Config:
        from_attributes = True


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    email: str
    new_password: str
