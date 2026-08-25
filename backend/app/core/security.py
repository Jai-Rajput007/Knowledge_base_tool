"""Security utilities for authentication."""

import secrets as secrets_module
from datetime import datetime, timedelta
from typing import Any, Union, Optional
import jwt
from fastapi import Depends, Header, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.user import User
from app.core.config import settings

SECRET_KEY = settings.SECRET_KEY
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login" if hasattr(settings, "API_V1_STR") else "/api/v1/auth/login"
)


def create_access_token(subject: Union[str, Any], role: str = "user", expires_delta: Optional[timedelta] = None) -> str:
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode = {"exp": expire, "sub": str(subject), "role": role}
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise credentials_exception
    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


class RequireRole:
    """Dependency generator for Role-Based Access Control."""
    def __init__(self, allowed_roles: list[str]):
        self.allowed_roles = allowed_roles

    def __call__(self, current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Requires one of: {', '.join(self.allowed_roles)}"
            )
        return current_user


def RequireServiceKey(x_robot_key: Optional[str] = Header(default=None)) -> None:
    """
    Auth dependency for machine-to-machine calls from the robot (g1-nlp's
    WorkspaceMCPClient), deliberately separate from the human RBAC/role system
    above. No DB lookup, no session, no expiry — just a constant-time compare
    against a static shared secret, so there's nothing to refresh or silently
    go stale on a robot that may run for weeks unattended.

    Kept intentionally orthogonal to RequireRole/get_current_user: when a
    fuller RBAC system is built out later, this doesn't need to be revisited —
    service credentials for machine callers are conventionally a separate
    concern from human roles (e.g. AWS IAM users vs. service roles).
    """
    if not x_robot_key or not secrets_module.compare_digest(x_robot_key, settings.ROBOT_SERVICE_KEY):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid X-Robot-Key",
        )
