"""FastAPI application factory."""

import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from app.core.config import settings
from app.core.logging import logger
from app.api.v1.router import api_router
from app.db.database import init_db, SessionLocal
from app.core.seed import seed_all


def _seed_admin():
    """Create the default admin account if it doesn't exist."""
    from app.models.user import User
    db = SessionLocal()
    try:
        exists = db.query(User).filter(
            (User.username == settings.ADMIN_USERNAME) | (User.email == settings.ADMIN_EMAIL)
        ).first()
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

    import os
    allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:3001").split(",")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_origin_regex=r"http://(localhost|127\.0\.0\.1|0\.0\.0\.0|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+):300[0-9]",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    from app.api.middleware.audit_middleware import AuditLogMiddleware
    
    app.add_middleware(AuditLogMiddleware)

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
        seed_all()
        
        # Clean up old audit logs (older than 30 days)
        try:
            from app.models.audit_log import AuditLog
            from datetime import datetime, timedelta
            db = SessionLocal()
            cutoff = datetime.utcnow() - timedelta(days=30)
            deleted = db.query(AuditLog).filter(AuditLog.created_at < cutoff).delete()
            db.commit()
            logger.info(f"Cleaned up {deleted} old audit logs (older than 30 days)")
        except Exception as e:
            logger.error(f"Failed to cleanup old audit logs: {e}")
        finally:
            db.close()
            
        asyncio.create_task(_resume_wakeword_jobs())

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


async def _resume_wakeword_jobs():
    """On startup resume any in-progress wakeword jobs using the correct backend poller."""
    from app.models.wakeword_job import WakewordJob, WakewordJobStatus
    from app.db.database import SessionLocal
    from app.services.wakeword import kaggle_trainer as kaggle
    from app.services.wakeword import agx_trainer as agx

    await asyncio.sleep(3)
    with SessionLocal() as s:
        stuck = s.query(WakewordJob).filter(
            WakewordJob.status.in_([
                WakewordJobStatus.RUNNING,
                WakewordJobStatus.UPLOADING,
                WakewordJobStatus.DOWNLOADING,
            ])
        ).all()
        jobs = [(j.id, j.model_name, j.backend, j.robot_ip) for j in stuck]

    for job_id, model_name, backend, robot_ip in jobs:
        logger.info(f"Resuming wakeword job {job_id} ({model_name}, backend={backend})")

        if backend == "kaggle":
            output_dir = str(Path(settings.WAKEWORD_SAMPLES_DIR) / f"{model_name}_output")
            asyncio.create_task(kaggle.poll_until_done(job_id, model_name, output_dir))

        elif backend == "local_agx" and robot_ip:
            try:
                status = agx.get_training_status(robot_ip)
                agx_status = status.get("status", "unknown")
                if agx_status in ("complete", "error", "cancelled", "idle"):
                    with SessionLocal() as s:
                        job = s.query(WakewordJob).filter(WakewordJob.id == job_id).first()
                        if job:
                            job.status = (WakewordJobStatus.ERROR
                                          if agx_status in ("error", "idle")
                                          else WakewordJobStatus.CANCELLED)
                            job.error_message = f"Job interrupted — AGX reported: {agx_status}"
                            s.commit()
                else:
                    from app.api.v1.endpoints.wakeword import _run_local_training
                    asyncio.create_task(_run_local_training(
                        job_id, robot_ip, "", model_name, 0, 0, [], []
                    ))
            except Exception as e:
                logger.warning(f"Job {job_id}: cannot reach AGX on resume — {e}")
                with SessionLocal() as s:
                    job = s.query(WakewordJob).filter(WakewordJob.id == job_id).first()
                    if job:
                        job.status = WakewordJobStatus.ERROR
                        job.error_message = f"AGX unreachable on startup: {e}"
                        s.commit()


app = create_application()
