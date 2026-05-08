"""User model for authentication."""

from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.orm import relationship
import hashlib
import secrets

from app.db.database import Base


class User(Base):
    """User model for authentication."""

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    salt = Column(String(32), nullable=False)
    role = Column(String(20), nullable=False, default="user")  # "admin" or "user"
    is_active = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)

    def set_password(self, password: str):
        self.salt = secrets.token_hex(16)
        self.hashed_password = hashlib.sha256((password + self.salt).encode()).hexdigest()

    def check_password(self, password: str) -> bool:
        hashed = hashlib.sha256((password + self.salt).encode()).hexdigest()
        return hashed == self.hashed_password

    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "role": self.role,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "last_login": self.last_login.isoformat() if self.last_login else None
        }
