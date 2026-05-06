"""FastAPI application factory."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from app.core.config import settings
from app.core.logging import logger
from app.api.v1.router import api_router
from app.db.database import init_db


def create_application() -> FastAPI:
    """Create and configure FastAPI application."""
    
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description="RAG System API for document processing and AI-powered chat",
        debug=settings.DEBUG
    )
    
    # Configure CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Create upload directory
    upload_dir = Path(settings.UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    # Mount static files for uploads
    app.mount("/uploads", StaticFiles(directory=str(upload_dir)), name="uploads")
    
    # Include API routers
    app.include_router(api_router, prefix="/api/v1")
    
    @app.on_event("startup")
    async def startup_event():
        """Initialize application on startup."""
        logger.info("Application starting up...")
        init_db()
        logger.info("Database initialized")
    
    @app.on_event("shutdown")
    async def shutdown_event():
        """Cleanup on shutdown."""
        logger.info("Application shutting down...")
    
    @app.get("/health")
    async def health_check():
        """Health check endpoint."""
        return {
            "status": "healthy",
            "version": settings.APP_VERSION,
            "debug": settings.DEBUG
        }
    
    @app.get("/")
    async def root():
        """Root endpoint."""
        return {
            "name": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "docs": "/docs"
        }
    
    return app


# Create application instance
app = create_application()
