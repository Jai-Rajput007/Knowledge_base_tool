"""FastAPI application factory."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from app.core.config import settings
from app.core.logging import logger
from app.api.v1.router import api_router
from app.db.database import init_db, SessionLocal


def _seed_admin():
    """Create the default admin account if it doesn't exist."""
    from app.models.user import User
    db = SessionLocal()
    try:
        exists = db.query(User).filter(User.username == settings.ADMIN_USERNAME).first()
        if not exists:
            admin = User()
            admin.username = settings.ADMIN_USERNAME
            admin.email = settings.ADMIN_EMAIL
            admin.role = "admin"
            admin.set_password(settings.ADMIN_PASSWORD)
            db.add(admin)
            db.commit()
            logger.info(f"Admin account created: {settings.ADMIN_USERNAME}")
        else:
            # Ensure existing admin has role set (migration guard)
            if exists.role != "admin":
                exists.role = "admin"
                db.commit()
    finally:
        db.close()


def create_application() -> FastAPI:
    """Create and configure FastAPI application."""

    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description="RAG System API for document processing and AI-powered chat",
        debug=settings.DEBUG
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    upload_dir = Path(settings.UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=str(upload_dir)), name="uploads")

    app.include_router(api_router, prefix="/api/v1")

    @app.on_event("startup")
    async def startup_event():
        logger.info("Application starting up...")
        init_db()
        logger.info("Database initialized")
        _seed_admin()

    @app.on_event("shutdown")
    async def shutdown_event():
        logger.info("Application shutting down...")

    @app.get("/health")
    async def health_check():
        return {"status": "healthy", "version": settings.APP_VERSION, "debug": settings.DEBUG}

    @app.get("/")
    async def root():
        return {"name": settings.APP_NAME, "version": settings.APP_VERSION, "docs": "/docs"}

    return app


app = create_application()
