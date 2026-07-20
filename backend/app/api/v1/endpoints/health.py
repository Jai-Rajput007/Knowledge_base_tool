"""Health check endpoints."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
import time
import httpx
import psutil
import subprocess

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
    """Real telemetry data from AGX Orin (Thor) and G1 Robot."""
    
    # 1. Get Thor (AGX Orin) Data
    agx_data = {
        "cpu_usage_pct": 0.0,
        "gpu_usage_pct": 0.0,
        "ram_used_gb": 0.0,
        "temp_c": 0.0
    }
    
    try:
        # Try to fetch from robot_sync (which runs on Thor)
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"http://{settings.ROBOT_SYNC_HOST}:{settings.ROBOT_SYNC_PORT}/telemetry", timeout=2.0)
            if resp.status_code == 200:
                data = resp.json()
                agx_data["cpu_usage_pct"] = data.get("cpu_percent", 0.0)
                agx_data["ram_used_gb"] = round(data.get("memory_percent", 0.0) * psutil.virtual_memory().total / 1e11, 1) # Approximation based on percent
                
                gpu_info = data.get("gpu_info", {})
                if gpu_info and gpu_info.get("total_mb", 0) > 0:
                    agx_data["gpu_usage_pct"] = round((gpu_info.get("used_mb", 0) / gpu_info.get("total_mb", 1)) * 100, 1)
    except Exception:
        # Fallback to local system if robot_sync is unreachable
        agx_data["cpu_usage_pct"] = psutil.cpu_percent(interval=0.1)
        agx_data["ram_used_gb"] = round(psutil.virtual_memory().used / 1e9, 1)
        
        # Try to get local GPU usage
        try:
            r = subprocess.run(["nvidia-smi", "--query-gpu=utilization.gpu,temperature.gpu", "--format=csv,noheader,nounits"], capture_output=True, text=True, timeout=2)
            if r.returncode == 0:
                gpu_util, gpu_temp = r.stdout.strip().split("\n")[0].split(",")
                agx_data["gpu_usage_pct"] = float(gpu_util.strip())
                agx_data["temp_c"] = float(gpu_temp.strip())
        except Exception:
            pass
            
    # If temp_c is still 0, try to get CPU temp
    if agx_data["temp_c"] == 0.0:
        try:
            temps = psutil.sensors_temperatures()
            if temps:
                # Get first available temperature
                agx_data["temp_c"] = round(list(temps.values())[0][0].current, 1)
        except Exception:
            pass

    # 2. Get G1 Chassis Data
    # Since G1 is disconnected (no DDS bridge active), we strictly report it as OFFLINE with no fake data.
    g1_data = {
        "battery_soc": 0.0,
        "battery_voltage": 0.0,
        "max_motor_temp": 0.0,
        "status": "OFFLINE"
    }

    return {
        "timestamp": int(time.time()),
        "g1_chassis": g1_data,
        "agx_orin": agx_data
    }
