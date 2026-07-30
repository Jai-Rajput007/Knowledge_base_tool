"""User model for authentication."""

from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Text
from sqlalchemy.orm import relationship
import hashlib
import secrets
import bcrypt

from app.db.database import Base

# Sentinel stored in `salt` column to indicate the password is bcrypt-hashed.
# Legacy SHA-256 rows have a 32-char hex salt; this sentinel is longer and distinctive.
_BCRYPT_SENTINEL = "__bcrypt__"
_SHA256_SENTINEL = "__sha256__"  # explicitly marks legacy rows (optional, for clarity)



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
        """
        Hash a plaintext password with bcrypt (work factor 12).
        Replaces the old SHA-256+salt scheme.
        bcrypt is intentionally slow, making brute-force attacks computationally expensive.
        """
        salt = bcrypt.gensalt(rounds=12)
        self.hashed_password = bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")
        self.salt = _BCRYPT_SENTINEL  # mark this row as bcrypt-hashed

    def set_bcrypt_password(self, bcrypt_hash: str):
        """
        Store a pre-computed bcrypt hash (e.g., synced from Super Admin).
        Used when the Super Admin pushes password updates via MQTT.
        """
        self.salt = _BCRYPT_SENTINEL
        self.hashed_password = bcrypt_hash

    def check_password(self, password: str) -> bool:
        """
        Verify a plaintext password against the stored hash.
        Supports both bcrypt (new) and SHA-256+salt (legacy) rows transparently.
        Legacy users are automatically upgraded to bcrypt on next successful login
        via the auth_service.authenticate_user() method.
        """
        if self.salt == _BCRYPT_SENTINEL:
            # bcrypt-hashed password (new default, and synced-from-SA passwords)
            try:
                return bcrypt.checkpw(
                    password.encode("utf-8"),
                    self.hashed_password.encode("utf-8")
                )
            except Exception:
                return False

        # Legacy SHA-256+salt verification (backward compatibility)
        legacy_hash = hashlib.sha256((password + self.salt).encode()).hexdigest()
        return legacy_hash == self.hashed_password

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
