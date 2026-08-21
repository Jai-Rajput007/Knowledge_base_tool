"""Health check endpoints."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
import time
import httpx
import psutil

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
    """
    Comprehensive Thor + G1 telemetry.

    Both halves are sourced from robot_sync (the AGX-side service — see
    g1-nlp/robot_sync.py), which is where the real hardware reads live:
    tegrastats for Thor's CPU/thermal/power, and a persistent bridge to
    robot_agent's :7790 DDS-derived status feed for the G1's battery/motor/
    IMU data. This endpoint is a thin merge, not a second telemetry
    implementation — the previous version duplicated (and had a broken
    version of) that logic locally via jtop/nvidia-smi, which return no
    usable data on Thor's unified-memory GPU, and unconditionally reported
    G1 as OFFLINE regardless of the robot's real state.
    """
    thor: dict = {"reachable": False}
    robot: dict = {"available": False, "stale": True, "last_seen_s_ago": None, "data": None}

    base = f"http://{settings.ROBOT_SYNC_HOST}:{settings.ROBOT_SYNC_PORT}"
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(f"{base}/telemetry", timeout=4.0)
            resp.raise_for_status()
            data = resp.json()
            thor = {
                "reachable":       True,
                "cpu_percent":     data.get("cpu_percent"),
                "memory_percent":  data.get("memory_percent"),
                "disk_free_gb":    data.get("disk_free_gb"),
                "power_mode":      data.get("power_mode"),
                "gpu_util_pct":    data.get("gpu_util_pct"),
                "gpu_clock_pct":   data.get("gpu_clock_pct"),
                "gpu_memory":      data.get("gpu_info", {}),
                "thermal_c":       data.get("thermal_c", {}),
                "power_mw":        data.get("power_mw", {}),
                "cpu_cores":       data.get("cpu_cores", []),
            }
        except Exception:
            # robot_sync unreachable — fall back to this process's own
            # psutil reads, since it also runs on the Thor. No GPU/thermal/
            # power data without robot_sync; that's read via tegrastats only.
            thor = {
                "reachable":      False,
                "cpu_percent":    psutil.cpu_percent(interval=0.1),
                "memory_percent": psutil.virtual_memory().percent,
                "disk_free_gb":   round(psutil.disk_usage("/").free / 1e9, 1),
                "power_mode": None, "gpu_util_pct": None, "gpu_clock_pct": None,
                "gpu_memory": {}, "thermal_c": {}, "power_mw": {}, "cpu_cores": [],
            }

        try:
            resp = await client.get(f"{base}/robot/telemetry", timeout=4.0)
            resp.raise_for_status()
            robot = resp.json()
        except Exception:
            pass  # robot block already defaults to unavailable above

    try:
        thor["uptime_hrs"] = round((time.time() - psutil.boot_time()) / 3600, 1)
        net = psutil.net_io_counters()
        thor["net_sent_mb"] = round(net.bytes_sent / (1024 * 1024), 1)
        thor["net_recv_mb"] = round(net.bytes_recv / (1024 * 1024), 1)
    except Exception:
        pass

    return {
        "timestamp": int(time.time()),
        "thor": thor,
        "robot": robot,
    }
