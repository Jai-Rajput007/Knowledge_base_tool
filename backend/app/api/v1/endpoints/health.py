"""Health check endpoints."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.db.database import get_db
from app.core.config import settings

router = APIRouter()


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    version: str
    debug: bool
    database: str


class SystemStatus(BaseModel):
    """System status response."""
    status: str
    services: dict


@router.get("/", response_model=HealthResponse)
async def health_check(db: Session = Depends(get_db)):
    """Basic health check."""
    # Test database connection
    try:
        db.execute("SELECT 1")
        db_status = "connected"
    except Exception:
        db_status = "disconnected"
    
    return HealthResponse(
        status="healthy",
        version=settings.APP_VERSION,
        debug=settings.DEBUG,
        database=db_status
    )


@router.get("/detailed", response_model=SystemStatus)
async def detailed_health(db: Session = Depends(get_db)):
    """Detailed system health check."""
    
    services = {
        "database": "connected",
        "vector_db": "unknown",  # TODO: Check vector DB
        "llm_service": "unknown",  # TODO: Check LLM
    }
    
    # Test database
    try:
        db.execute("SELECT 1")
    except Exception as e:
        services["database"] = f"error: {str(e)}"
    
    # Overall status
    all_healthy = all(
        s == "connected" or s == "unknown" 
        for s in services.values()
    )
    
    return SystemStatus(
        status="healthy" if all_healthy else "degraded",
        services=services
    )
