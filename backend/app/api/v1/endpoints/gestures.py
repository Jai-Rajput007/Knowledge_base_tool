"""
Gestures API — Proxies custom gesture recording/playback requests to robot_sync.py
(FastAPI server running on AGX port 9000).

All endpoints accept an optional `robot_ip` query parameter that overrides the
default ROBOT_SYNC_HOST from settings, allowing the dashboard UI to target a
specific robot when multiple units are present.

Environment variables (set in .env):
  ROBOT_SYNC_HOST  — IP of the AGX running robot_sync.py (default: 192.168.1.61)
  ROBOT_SYNC_PORT  — HTTP port of robot_sync.py (default: 9000)

Protocol summary (from Dashboard → AGX):
  GET    /gestures/custom                    → list all recorded gestures + metadata
  POST   /gestures/custom/record/start       → enter compliant mode and start recording
  POST   /gestures/custom/record/stop        → stop recording and save .npy file
  POST   /gestures/custom/{name}/play        → replay a saved gesture
  DELETE /gestures/custom/{name}             → delete a saved gesture file
  GET    /gestures/health                    → connectivity check
"""

from fastapi import APIRouter, HTTPException, Form
import httpx
import logging
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()


def _robot_sync_url(host: Optional[str] = None) -> str:
    """Build the base URL for robot_sync.py.
    
    If `host` (i.e. robot_ip from query param) is provided, use that IP.
    Otherwise fall back to settings.ROBOT_SYNC_HOST and settings.ROBOT_SYNC_PORT.
    """
    h = host or settings.ROBOT_SYNC_HOST
    p = settings.ROBOT_SYNC_PORT
    return f"http://{h}:{p}"


@router.get("/custom")
async def list_gestures(robot_ip: Optional[str] = None):
    """List all custom gestures saved on the robot (name, sample count, duration, modified)."""
    url = f"{_robot_sync_url(robot_ip)}/gestures/custom"
    logger.debug(f"[Gestures] GET list → {url}")
    async with httpx.AsyncClient() as client:
        try:
            r = await client.get(url, timeout=5.0)
            r.raise_for_status()
            logger.debug(f"[Gestures] List response: {r.status_code}")
            return r.json()
        except httpx.ConnectError:
            logger.error(f"[Gestures] Cannot connect to robot_sync at {url}")
            raise HTTPException(status_code=502, detail=f"Cannot reach robot_sync at {_robot_sync_url(robot_ip)}. Is the AGX reachable?")
        except httpx.HTTPStatusError as e:
            logger.error(f"[Gestures] HTTP error from robot_sync: {e.response.status_code}")
            raise HTTPException(status_code=e.response.status_code, detail=e.response.text)
        except Exception as e:
            logger.error(f"[Gestures] Unexpected error listing gestures: {e}")
            raise HTTPException(status_code=502, detail=str(e))


@router.post("/custom/record/start")
async def start_record(name: str = Form(...), robot_ip: Optional[str] = None):
    """Start gesture recording — puts robot arm in compliant (zero-torque) mode and begins capturing joint angles."""
    url = f"{_robot_sync_url(robot_ip)}/gestures/custom/record/start"
    logger.info(f"[Gestures] START RECORDING '{name}' → {url}")
    async with httpx.AsyncClient() as client:
        try:
            r = await client.post(url, data={"name": name}, timeout=10.0)
            r.raise_for_status()
            logger.info(f"[Gestures] Recording started for '{name}'")
            return r.json()
        except httpx.ConnectError:
            raise HTTPException(status_code=502, detail=f"Cannot reach robot_sync at {_robot_sync_url(robot_ip)}.")
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=e.response.status_code, detail=e.response.text)
        except Exception as e:
            logger.error(f"[Gestures] Error starting recording: {e}")
            raise HTTPException(status_code=502, detail=str(e))


@router.post("/custom/record/stop")
async def stop_record(robot_ip: Optional[str] = None):
    """Stop gesture recording — exits compliant mode and saves the captured trajectory as a .npy file."""
    url = f"{_robot_sync_url(robot_ip)}/gestures/custom/record/stop"
    logger.info(f"[Gestures] STOP RECORDING → {url}")
    async with httpx.AsyncClient() as client:
        try:
            r = await client.post(url, timeout=10.0)
            r.raise_for_status()
            logger.info("[Gestures] Recording stopped and saved.")
            return r.json()
        except httpx.ConnectError:
            raise HTTPException(status_code=502, detail=f"Cannot reach robot_sync at {_robot_sync_url(robot_ip)}.")
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=e.response.status_code, detail=e.response.text)
        except Exception as e:
            logger.error(f"[Gestures] Error stopping recording: {e}")
            raise HTTPException(status_code=502, detail=str(e))


@router.post("/custom/{name}/play")
async def play_gesture(name: str, robot_ip: Optional[str] = None):
    """Replay a previously recorded gesture by name."""
    url = f"{_robot_sync_url(robot_ip)}/gestures/custom/{name}/play"
    logger.info(f"[Gestures] PLAY '{name}' → {url}")
    async with httpx.AsyncClient() as client:
        try:
            r = await client.post(url, timeout=30.0)  # gestures can take time to play
            r.raise_for_status()
            logger.info(f"[Gestures] Played '{name}' successfully.")
            return r.json()
        except httpx.ConnectError:
            raise HTTPException(status_code=502, detail=f"Cannot reach robot_sync at {_robot_sync_url(robot_ip)}.")
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=e.response.status_code, detail=e.response.text)
        except Exception as e:
            logger.error(f"[Gestures] Error playing gesture '{name}': {e}")
            raise HTTPException(status_code=502, detail=str(e))


@router.delete("/custom/{name}")
async def delete_gesture(name: str, robot_ip: Optional[str] = None):
    """Delete a saved gesture file from the robot."""
    url = f"{_robot_sync_url(robot_ip)}/gestures/custom/{name}"
    logger.info(f"[Gestures] DELETE '{name}' → {url}")
    async with httpx.AsyncClient() as client:
        try:
            r = await client.delete(url, timeout=5.0)
            r.raise_for_status()
            logger.info(f"[Gestures] Deleted '{name}'.")
            return r.json()
        except httpx.ConnectError:
            raise HTTPException(status_code=502, detail=f"Cannot reach robot_sync at {_robot_sync_url(robot_ip)}.")
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=e.response.status_code, detail=e.response.text)
        except Exception as e:
            logger.error(f"[Gestures] Error deleting gesture '{name}': {e}")
            raise HTTPException(status_code=502, detail=str(e))


@router.get("/health")
async def get_health(robot_ip: Optional[str] = None):
    """Check if robot_sync.py is reachable on the AGX."""
    url = f"{_robot_sync_url(robot_ip)}/health"
    logger.debug(f"[Gestures] Health check → {url}")
    async with httpx.AsyncClient() as client:
        try:
            r = await client.get(url, timeout=2.0)
            r.raise_for_status()
            return r.json()
        except Exception as e:
            logger.warning(f"[Gestures] Health check failed: {e}")
            raise HTTPException(status_code=502, detail=str(e))
