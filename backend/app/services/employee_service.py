"""Employee management service — handles enrollment, FRS calls, context retrieval."""

import httpx
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional

from app.models.user import User
from app.models.memory_fact import MemoryFact
from app.models.session import Session as ChatSession
from app.models.session_summary import SessionSummary
from app.core.config import settings
from app.core.logging import logger


class EmployeeService:

    def __init__(self, db: Session):
        self.db = db

    # ── CRUD ──────────────────────────────────────────────────────────────────

    def list_employees(self) -> list[User]:
        return (
            self.db.query(User)
            .filter(User.employee_id.isnot(None))
            .order_by(User.created_at)
            .all()
        )

    def get_by_employee_id(self, employee_id: str) -> Optional[User]:
        return self.db.query(User).filter(User.employee_id == employee_id).first()

    def get_by_face_id(self, face_id: str) -> Optional[User]:
        return self.db.query(User).filter(User.face_id == face_id).first()

    def create_employee(
        self,
        employee_id: str,
        name: str,
        email: str,
        password: str,
        department: Optional[str] = None,
    ) -> User:
        username = name.lower().replace(" ", "_")
        # ensure unique username
        base, n = username, 1
        while self.db.query(User).filter(User.username == username).first():
            username = f"{base}_{n}"
            n += 1

        user = User()
        user.username = username
        user.email = email
        user.employee_id = employee_id
        user.department = department
        user.role = "user"
        user.photo_count = 0
        user.set_password(password)

        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def delete_employee(self, user_id: int) -> bool:
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            return False
        # Unenroll from FRS if enrolled
        if user.face_id:
            self._frs_unenroll(user.face_id)
        self.db.delete(user)
        self.db.commit()
        return True

    # ── FRS integration ───────────────────────────────────────────────────────

    def enroll_photos(self, user: User, photo_bytes_list: list[bytes], filenames: list[str]) -> str:
        """Send photos to FRS, update user with returned face_id."""
        files = [
            ("photos", (filenames[i], photo_bytes_list[i], "image/jpeg"))
            for i in range(len(photo_bytes_list))
        ]
        data = {"name": user.username}

        try:
            resp = httpx.post(
                f"{settings.FRS_URL}/enroll",
                data=data,
                files=files,
                timeout=30.0,
            )
            resp.raise_for_status()
            result = resp.json()
            face_id = result["face_id"]

            user.face_id = face_id
            user.photo_count = (user.photo_count or 0) + len(photo_bytes_list)
            self.db.commit()
            self.db.refresh(user)
            return face_id

        except httpx.HTTPError as e:
            logger.error(f"FRS enroll failed for {user.username}: {e}")
            raise RuntimeError(f"FRS service error: {e}")

    def _frs_unenroll(self, face_id: str) -> None:
        try:
            httpx.delete(f"{settings.FRS_URL}/enroll/{face_id}", timeout=10.0)
        except Exception as e:
            logger.warning(f"FRS unenroll failed for {face_id}: {e}")

    # ── Context for NLP pipeline ──────────────────────────────────────────────

    def get_context(self, face_id: str) -> Optional[dict]:
        user = self.get_by_face_id(face_id)
        if not user:
            return None

        # Memory facts — most recently accessed, top 5
        facts = (
            self.db.query(MemoryFact)
            .filter(MemoryFact.user_id == user.id, MemoryFact.is_active == True)
            .order_by(desc(MemoryFact.last_accessed))
            .limit(5)
            .all()
        )

        # Last session summary
        last_summary = (
            self.db.query(SessionSummary)
            .join(ChatSession, ChatSession.id == SessionSummary.session_id)
            .filter(ChatSession.user_id == user.id)
            .order_by(desc(SessionSummary.created_at))
            .first()
        )

        return {
            "face_id": face_id,
            "employee_id": user.employee_id,
            "name": user.username.replace("_", " ").title(),
            "department": user.department,
            "memory_facts": [f.fact_text for f in facts],
            "last_session_summary": last_summary.summary_text if last_summary else None,
            "last_seen": user.last_login.isoformat() if user.last_login else None,
        }
