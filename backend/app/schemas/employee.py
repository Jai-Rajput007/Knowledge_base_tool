"""Employee schemas."""

from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


class EmployeeCreate(BaseModel):
    employee_id: str
    name: str
    email: str
    department: Optional[str] = None
    password: str = "changeme123"


class EmployeeResponse(BaseModel):
    id: int
    employee_id: Optional[str]
    username: str
    email: str
    department: Optional[str]
    face_id: Optional[str]
    photo_count: int
    is_enrolled: bool
    is_active: int
    created_at: datetime

    class Config:
        from_attributes = True

    @classmethod
    def from_user(cls, user) -> "EmployeeResponse":
        return cls(
            id=user.id,
            employee_id=user.employee_id,
            username=user.username,
            email=user.email,
            department=user.department,
            face_id=user.face_id,
            photo_count=user.photo_count or 0,
            is_enrolled=user.face_id is not None,
            is_active=user.is_active,
            created_at=user.created_at,
        )


class BulkEnrollResult(BaseModel):
    total: int
    enrolled: int
    failed: int
    errors: list[dict]


class ContextResponse(BaseModel):
    face_id: str
    employee_id: Optional[str]
    name: str
    department: Optional[str]
    memory_facts: list[str]
    last_session_summary: Optional[str]
    last_seen: Optional[datetime]
