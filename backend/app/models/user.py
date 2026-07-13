"""User model for authentication."""

from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Text
from sqlalchemy.orm import relationship
import hashlib
import secrets

from app.db.database import Base

_BCRYPT_SENTINEL = "__bcrypt__"  # stored in `salt` to flag bcrypt-hashed passwords



class User(Base):
    """User model for authentication."""

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String(50), nullable=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    salt = Column(String(32), nullable=False)
    role = Column(String(20), nullable=False, default="user")  # "admin" or "user"
    requires_password_change = Column(Integer, default=0) # SQLite/SQLAlchemy Boolean compatibility (0/1)
    is_active = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)

    # Employee fields
    employee_id = Column(String(50), unique=True, nullable=True, index=True)
    face_id = Column(String(100), unique=True, nullable=True, index=True)
    department = Column(String(100), nullable=True)
    photo_count = Column(Integer, default=0)

    memory_facts = relationship("MemoryFact", back_populates="user", cascade="all, delete-orphan")
    sessions = relationship("Session", back_populates="user", cascade="all, delete-orphan")

    def set_password(self, password: str):
        """Hash a plaintext password with sha256+salt (local users)."""
        self.salt = secrets.token_hex(16)
        self.hashed_password = hashlib.sha256((password + self.salt).encode()).hexdigest()

    def set_bcrypt_password(self, bcrypt_hash: str):
        """Store a bcrypt hash received from the Super Admin as-is."""
        self.salt = _BCRYPT_SENTINEL
        self.hashed_password = bcrypt_hash

    def check_password(self, password: str) -> bool:
        if self.salt == _BCRYPT_SENTINEL:
            # Password was synced from Super Admin — use bcrypt to verify
            try:
                import bcrypt
                return bcrypt.checkpw(password.encode(), self.hashed_password.encode())
            except Exception:
                return False
        # Local sha256+salt verification
        hashed = hashlib.sha256((password + self.salt).encode()).hexdigest()
        return hashed == self.hashed_password

    def to_dict(self):
        return {
            "id": self.id,
            "tenant_id": self.tenant_id,
            "username": self.username,
            "email": self.email,
            "role": self.role,
            "is_active": self.is_active,
            "requires_password_change": self.requires_password_change,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "last_login": self.last_login.isoformat() if self.last_login else None
        }
