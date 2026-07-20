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
        "temp_c": 0.0,
        "power_draw_w": 0.0,
        "fan_speed_pct": 0.0,
        "gpu_core_clock_mhz": 0.0,
        "gpu_mem_free_gb": 0.0,
        "gpu_mem_total_gb": 0.0,
        "uptime_hrs": 0.0,
        "net_sent_mb": 0.0,
        "net_recv_mb": 0.0,
        "disk_free_gb": 0.0,
        "cpu_freq_mhz": 0.0
    }
    
    # OS & Hardware Metrics (psutil)
    try:
        agx_data["uptime_hrs"] = round((time.time() - psutil.boot_time()) / 3600, 1)
        net = psutil.net_io_counters()
        agx_data["net_sent_mb"] = round(net.bytes_sent / (1024 * 1024), 1)
        agx_data["net_recv_mb"] = round(net.bytes_recv / (1024 * 1024), 1)
        agx_data["disk_free_gb"] = round(psutil.disk_usage("/").free / (1024**3), 1)
        freq = psutil.cpu_freq()
        if freq:
            agx_data["cpu_freq_mhz"] = round(freq.current, 1)
    except Exception:
        pass

    try:
        # Try to fetch from robot_sync (which runs on Thor)
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"http://{settings.ROBOT_SYNC_HOST}:{settings.ROBOT_SYNC_PORT}/telemetry", timeout=2.0)
            if resp.status_code == 200:
                data = resp.json()
                agx_data["cpu_usage_pct"] = data.get("cpu_percent", 0.0)
                agx_data["ram_used_gb"] = round(data.get("memory_percent", 0.0) * psutil.virtual_memory().total / 1e11, 1) 
    except Exception:
        agx_data["cpu_usage_pct"] = psutil.cpu_percent(interval=0.1)
        agx_data["ram_used_gb"] = round(psutil.virtual_memory().used / 1e9, 1)
        
    # GPU Metrics
    try:
        # Try jtop first for Jetson AGX
        from jtop import jtop
        with jtop() as jetson:
            if jetson.ok():
                stats = jetson.stats
                agx_data["gpu_usage_pct"] = float(stats.get('GPU', 0.0))
                
                temps = jetson.temperature
                if temps:
                    agx_data["temp_c"] = float(temps.get('GPU', {}).get('temp', temps.get('CPU', {}).get('temp', 0)))
                
                power = jetson.power
                if power and 'tot' in power:
                    agx_data["power_draw_w"] = round(float(power['tot'].get('power', 0)) / 1000.0, 1) # mW to W
                
                fan = jetson.fan
                if fan:
                    agx_data["fan_speed_pct"] = float(fan.get('speed', 0.0))
                    
                ram = jetson.memory
                if ram and 'RAM' in ram:
                    agx_data["gpu_mem_free_gb"] = round(float(ram['RAM'].get('free', 0)) / (1024**2), 1)
                    agx_data["gpu_mem_total_gb"] = round(float(ram['RAM'].get('tot', 0)) / (1024**2), 1)
                    
                # For Jetson, we often don't have separate VRAM, it's shared. 
                # We can use the core clock if available
                if hasattr(jetson, 'gpu') and jetson.gpu:
                    agx_data["gpu_core_clock_mhz"] = float(jetson.gpu.get('val', 0.0))
                    
    except Exception:
        # Fallback to nvidia-smi for desktop hosts
        try:
            cmd = ["nvidia-smi", "--query-gpu=utilization.gpu,temperature.gpu,power.draw,fan.speed,clocks.current.graphics,memory.free,memory.total", "--format=csv,noheader,nounits"]
            r = subprocess.run(cmd, capture_output=True, text=True, timeout=2)
            if r.returncode == 0:
                vals = [v.strip() for v in r.stdout.strip().split("\n")[0].split(",")]
                def parse_float(val):
                    try: return float(val.replace('[Not Supported]', '0').replace('N/A', '0'))
                    except: return 0.0
                
                agx_data["gpu_usage_pct"] = parse_float(vals[0])
                agx_data["temp_c"] = parse_float(vals[1])
                agx_data["power_draw_w"] = parse_float(vals[2])
                agx_data["fan_speed_pct"] = parse_float(vals[3])
                agx_data["gpu_core_clock_mhz"] = parse_float(vals[4])
                agx_data["gpu_mem_free_gb"] = round(parse_float(vals[5]) / 1024, 1)
                agx_data["gpu_mem_total_gb"] = round(parse_float(vals[6]) / 1024, 1)
        except Exception:
            pass
            
    # If temp_c is still 0, try to get CPU temp
    if agx_data["temp_c"] == 0.0:
        try:
            temps = psutil.sensors_temperatures()
            if temps:
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
