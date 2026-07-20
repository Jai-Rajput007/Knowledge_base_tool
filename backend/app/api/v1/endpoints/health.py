"""Health check endpoints."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
import random
import time

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

@router.get("/telemetry")
async def robot_telemetry():
    """Simulated telemetry data from Unitree G1 and AGX Orin via DDS/jtop."""
    return {
        "timestamp": int(time.time()),
        "g1_chassis": {
            "battery_soc": round(random.uniform(75.0, 95.0), 1),
            "battery_voltage": round(random.uniform(50.0, 54.0), 1),
            "max_motor_temp": round(random.uniform(35.0, 50.0), 1),
            "status": "NORMAL"
        },
        "agx_orin": {
            "cpu_usage_pct": round(random.uniform(10.0, 30.0), 1),
            "gpu_usage_pct": round(random.uniform(30.0, 60.0), 1),
            "ram_used_gb": round(random.uniform(14.0, 18.0), 1),
            "temp_c": round(random.uniform(45.0, 60.0), 1)
        }
    }
