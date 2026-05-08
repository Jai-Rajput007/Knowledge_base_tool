"""Authentication endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.db.database import get_db
from app.services.auth_service import AuthService
from app.schemas.auth import UserCreate, UserLogin, UserResponse, UserUpdate, ResetPasswordRequest
from app.core.logging import logger
from app.core.security import create_access_token, get_current_user, require_admin
from app.models.user import User

router = APIRouter()


@router.post("/login")
async def login_user(user_data: UserLogin, db: Session = Depends(get_db)):
    auth_service = AuthService(db)
    user = auth_service.authenticate_user(user_data.username, user_data.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled")
    auth_service.update_user_last_login(user.id)
    access_token = create_access_token(subject=user.id, role=user.role)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": UserResponse.model_validate(user).model_dump()
    }


@router.get("/me", response_model=UserResponse)
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user


# ── Admin: user management ───────────────────────────────────────────────────

@router.get("/users", response_model=List[UserResponse])
async def list_users(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return AuthService(db).list_users()


@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(user_data: UserCreate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    svc = AuthService(db)
    if svc.get_user_by_username(user_data.username):
        raise HTTPException(status_code=400, detail="Username already exists")
    if svc.get_user_by_email(user_data.email):
        raise HTTPException(status_code=400, detail="Email already registered")
    return svc.create_user(user_data.username, user_data.email, user_data.password, user_data.role)


@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    svc = AuthService(db)
    user = svc.update_user(user_id, **user_data.model_dump(exclude_none=True))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    if not AuthService(db).delete_user(user_id):
        raise HTTPException(status_code=404, detail="User not found")


@router.post("/reset-password")
async def reset_password(request: ResetPasswordRequest, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    svc = AuthService(db)
    user = svc.get_user_by_email(request.email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.set_password(request.new_password)
    db.commit()
    return {"message": "Password reset successful"}
