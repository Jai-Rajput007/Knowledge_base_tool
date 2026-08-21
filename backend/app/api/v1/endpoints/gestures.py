"""
Gestures API — Postgres is the source of truth for custom gestures; the Thor
filesystem (data/gestures/*.gesture) is a cache robot_agent reads from.

Tenant scoping: one robot per tenant (see GESTURE_SYSTEM_PLAN.md §9) — gestures
are keyed by tenant_id alone, never robot_id. The `robot_ip` query parameter
below is purely a transport detail (which AGX to talk to) and must never be
used to scope data ownership.

On-disk names are namespaced `{tenant_id}__{name}.gesture` because the Thor
filesystem is flat and shared across tenants — this stops one tenant's
gesture from colliding with another's on the same disk.

Flow:
  record start/stop → proxy to robot_agent (via robot_sync) → on stop, pull the
    raw waypoints back from robot_sync and INSERT into custom_gestures
  play              → look up the DB row scoped to tenant_id (enforces
    isolation), push the file to the Thor if it's missing (survives a reflash),
    then trigger playback
  list              → Postgres only — works with the robot powered off
  delete            → removes the DB row; the on-disk file delete is best-effort

Environment variables (set in .env):
  ROBOT_SYNC_HOST  — IP of the AGX running robot_sync.py (default: 192.168.1.61)
  ROBOT_SYNC_PORT  — HTTP port of robot_sync.py (default: 9000)
"""

from fastapi import APIRouter, HTTPException, Form, Depends
from sqlalchemy.orm import Session
import httpx
import logging
from typing import Optional

from app.core.config import settings
from app.core.security import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.models.custom_gesture import CustomGesture

logger = logging.getLogger(__name__)
router = APIRouter()


def _robot_sync_url(host: Optional[str] = None) -> str:
    h = host or settings.ROBOT_SYNC_HOST
    p = settings.ROBOT_SYNC_PORT
    return f"http://{h}:{p}"


def _disk_name(tenant_id: str, name: str) -> str:
    """Namespaced on-disk filename — see module docstring."""
    return f"{tenant_id}__{name}"


@router.get("/custom")
def list_gestures(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """List this tenant's custom gestures from Postgres. Works with the robot powered off."""
    rows = (
        db.query(CustomGesture)
        .filter(CustomGesture.tenant_id == current_user.tenant_id)
        .order_by(CustomGesture.created_at.desc())
        .all()
    )
    return {"gestures": [r.to_dict() for r in rows]}


@router.post("/custom/record/start")
async def start_record(
    name: str = Form(...),
    robot_ip: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Reserve `name` for this tenant (409 if already taken — checked before the
    robot ever moves, so a take is never lost to a naming collision after the
    fact), then proxy to robot_sync to put the arms in compliant mode.
    """
    existing = (
        db.query(CustomGesture)
        .filter(CustomGesture.tenant_id == current_user.tenant_id, CustomGesture.name == name)
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail=f"Gesture '{name}' already exists")

    disk_name = _disk_name(current_user.tenant_id, name)
    url = f"{_robot_sync_url(robot_ip)}/gestures/custom/record/start"
    logger.info(f"[Gestures] START RECORDING '{name}' (tenant={current_user.tenant_id}) → {url}")
    async with httpx.AsyncClient() as client:
        try:
            r = await client.post(url, data={"name": disk_name}, timeout=10.0)
            r.raise_for_status()
            return {"status": "recording", "name": name}
        except httpx.ConnectError:
            raise HTTPException(status_code=502, detail=f"Cannot reach robot_sync at {_robot_sync_url(robot_ip)}.")
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=e.response.status_code, detail=e.response.text)
        except Exception as e:
            logger.error(f"[Gestures] Error starting recording: {e}")
            raise HTTPException(status_code=502, detail=str(e))


@router.post("/custom/record/stop")
async def stop_record(
    name: str = Form(...),
    robot_ip: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Stop recording, then pull the parsed waypoints back from robot_sync and
    persist them to Postgres. `name` is the same logical name passed to
    record/start — the frontend must resend it here since robot_agent's own
    stop command takes no name.
    """
    disk_name = _disk_name(current_user.tenant_id, name)
    base = _robot_sync_url(robot_ip)
    async with httpx.AsyncClient() as client:
        try:
            r = await client.post(f"{base}/gestures/custom/record/stop", timeout=10.0)
            r.raise_for_status()
        except httpx.ConnectError:
            raise HTTPException(status_code=502, detail=f"Cannot reach robot_sync at {base}.")
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=e.response.status_code, detail=e.response.text)
        except Exception as e:
            logger.error(f"[Gestures] Error stopping recording: {e}")
            raise HTTPException(status_code=502, detail=str(e))

        try:
            raw = await client.get(f"{base}/gestures/custom/{disk_name}/raw", timeout=10.0)
            raw.raise_for_status()
        except httpx.HTTPStatusError as e:
            # robot_agent may not have saved a file at all — e.g. recording had 0 samples
            raise HTTPException(status_code=422, detail=f"No recording found to save: {e.response.text}")
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Could not fetch recorded waypoints: {e}")

    data = raw.json()
    sample_count = data.get("samples", 0)
    if sample_count <= 0:
        raise HTTPException(status_code=422, detail="Recording captured 0 samples — not saved")

    gesture = CustomGesture(
        tenant_id=current_user.tenant_id,
        name=name,
        waypoints=data["waypoints"],
        sample_count=sample_count,
        duration_s=data.get("duration_s", 0.0),
        created_by=current_user.id,
    )
    db.add(gesture)
    db.commit()
    db.refresh(gesture)
    logger.info(f"[Gestures] Saved '{name}' (tenant={current_user.tenant_id}), {sample_count} samples")
    return {"status": "stopped", "gesture": gesture.to_dict()}


@router.post("/custom/{name}/play")
async def play_gesture(
    name: str,
    robot_ip: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Replay a gesture. Tenant isolation is enforced by the DB lookup below —
    a tenant can only ever play back its own recordings, regardless of what
    else happens to be sitting in the Thor's flat data/gestures/ directory."""
    gesture = (
        db.query(CustomGesture)
        .filter(CustomGesture.tenant_id == current_user.tenant_id, CustomGesture.name == name)
        .first()
    )
    if not gesture:
        raise HTTPException(status_code=404, detail="Gesture not found")

    disk_name = _disk_name(current_user.tenant_id, name)
    base = _robot_sync_url(robot_ip)
    async with httpx.AsyncClient() as client:
        try:
            exists = await client.head(f"{base}/gestures/custom/{disk_name}", timeout=5.0)
            if exists.status_code == 404:
                # Cache miss on the Thor (reflash, robot swap, etc.) — repopulate from Postgres.
                logger.info(f"[Gestures] '{name}' missing on Thor — pushing from Postgres")
                push = await client.post(
                    f"{base}/gestures/custom/push",
                    json={"name": disk_name, "waypoints": gesture.waypoints},
                    timeout=15.0,
                )
                push.raise_for_status()

            r = await client.post(f"{base}/gestures/custom/{disk_name}/play", timeout=30.0)
            r.raise_for_status()
            return {"status": "playing", "name": name}
        except httpx.ConnectError:
            raise HTTPException(status_code=502, detail=f"Cannot reach robot_sync at {base}.")
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=e.response.status_code, detail=e.response.text)
        except Exception as e:
            logger.error(f"[Gestures] Error playing gesture '{name}': {e}")
            raise HTTPException(status_code=502, detail=str(e))


@router.delete("/custom/{name}")
async def delete_gesture(
    name: str,
    robot_ip: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a gesture. The DB row is authoritative — a failed on-disk delete
    (e.g. Thor unreachable) must not fail the request."""
    gesture = (
        db.query(CustomGesture)
        .filter(CustomGesture.tenant_id == current_user.tenant_id, CustomGesture.name == name)
        .first()
    )
    if not gesture:
        raise HTTPException(status_code=404, detail="Gesture not found")

    db.delete(gesture)
    db.commit()

    disk_name = _disk_name(current_user.tenant_id, name)
    try:
        async with httpx.AsyncClient() as client:
            await client.delete(f"{_robot_sync_url(robot_ip)}/gestures/custom/{disk_name}", timeout=5.0)
    except Exception as e:
        logger.warning(f"[Gestures] Best-effort file delete failed for '{name}': {e}")

    return {"status": "deleted", "name": name}


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
