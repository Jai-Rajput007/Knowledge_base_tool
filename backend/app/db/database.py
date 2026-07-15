"""Database connection and session management."""

from sqlalchemy import create_engine, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.core.logging import logger

# Create engine
if settings.DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        settings.DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
else:
    engine = create_engine(settings.DATABASE_URL)

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()


# Enable foreign key constraints for SQLite
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_conn, connection_record):
    if settings.DATABASE_URL.startswith("sqlite"):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.close()


def get_db() -> Session:
    """Get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initialize database tables."""
    from app.models import document, activity, setting, tool
    from app.models import user
    from app.models import session, message, memory_fact, session_summary, entity
    from app.models import wakeword_job
    from app.models import audit_log

    Base.metadata.create_all(bind=engine)
    _migrate_add_role_column()
    _migrate_add_employee_columns()
    logger.info("Database tables created")


def _migrate_add_employee_columns():
    """Add employee columns to users table if they don't exist."""
    if not settings.DATABASE_URL.startswith("sqlite"):
        return
    new_cols = {
        "employee_id": "VARCHAR(50)",
        "face_id":     "VARCHAR(100)",
        "department":  "VARCHAR(100)",
        "photo_count": "INTEGER DEFAULT 0",
    }
    with engine.connect() as conn:
        result = conn.execute(__import__("sqlalchemy").text("PRAGMA table_info(users)"))
        existing = [row[1] for row in result]
        for col, col_type in new_cols.items():
            if col not in existing:
                conn.execute(__import__("sqlalchemy").text(
                    f"ALTER TABLE users ADD COLUMN {col} {col_type}"
                ))
        conn.commit()


def _migrate_add_role_column():
    """Add role column to users table if it doesn't exist (one-time migration)."""
    if not settings.DATABASE_URL.startswith("sqlite"):
        return
    with engine.connect() as conn:
        result = conn.execute(
            __import__("sqlalchemy").text("PRAGMA table_info(users)")
        )
        columns = [row[1] for row in result]
        if "role" not in columns:
            conn.execute(__import__("sqlalchemy").text(
                "ALTER TABLE users ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'user'"
            ))
            conn.commit()
            logger.info("Migrated: added role column to users table")
