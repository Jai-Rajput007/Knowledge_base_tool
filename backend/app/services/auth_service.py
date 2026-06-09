"""Authentication service for user management."""

from sqlalchemy.orm import Session
from app.models.user import User
from app.core.logging import logger


class AuthService:

    def __init__(self, db: Session):
        self.db = db

    def create_user(self, username: str, email: str, password: str, role: str = "user") -> User:
        try:
            user = User()
            user.username = username
            user.email = email
            user.role = role
            user.set_password(password)
            self.db.add(user)
            self.db.commit()
            self.db.refresh(user)
            logger.info(f"User created: {username} (role={role})")
            return user
        except Exception as e:
            self.db.rollback()
            raise e

    def authenticate_user(self, username: str, password: str):
        db_user = self.db.query(User).filter(User.username == username).first()
        if db_user and db_user.check_password(password):
            return db_user
        return None

    def get_user_by_username(self, username: str):
        return self.db.query(User).filter(User.username == username).first()

    def get_user_by_email(self, email: str):
        return self.db.query(User).filter(User.email == email).first()

    def get_user_by_id(self, user_id: int):
        return self.db.query(User).filter(User.id == user_id).first()

    def list_users(self):
        return self.db.query(User).filter(User.employee_id.is_(None)).order_by(User.created_at).all()

    def update_user(self, user_id: int, **fields) -> User:
        user = self.get_user_by_id(user_id)
        if not user:
            return None
        password = fields.pop("password", None)
        for k, v in fields.items():
            if v is not None:
                setattr(user, k, v)
        if password:
            user.set_password(password)
        self.db.commit()
        self.db.refresh(user)
        return user

    def delete_user(self, user_id: int) -> bool:
        user = self.get_user_by_id(user_id)
        if not user:
            return False
        self.db.delete(user)
        self.db.commit()
        return True

    def update_user_last_login(self, user_id: int):
        from datetime import datetime
        user = self.db.query(User).filter(User.id == user_id).first()
        if user:
            user.last_login = datetime.utcnow()
            self.db.commit()
