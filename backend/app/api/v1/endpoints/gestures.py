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
from sqlalchemy.exc import IntegrityError
from pydantic import BaseModel, Field
import httpx
import logging
from typing import Dict, List, Optional

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
    stop command takes no name. robot_sync is told the on-disk name too, so
    it can poll for the file to actually appear (the save happens ~2s after
    the stop command, on robot_agent's own ramp-down thread) before this
    request returns and we go looking for it.
    """
    disk_name = _disk_name(current_user.tenant_id, name)
    base = _robot_sync_url(robot_ip)
    async with httpx.AsyncClient() as client:
        try:
            r = await client.post(
                f"{base}/gestures/custom/record/stop",
                data={"name": disk_name},
                timeout=10.0,
            )
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
    try:
        db.commit()
    except IntegrityError:
        # A duplicate stop request for the same name (e.g. a double-click on
        # Stop & Save before the button disables) races this INSERT against
        # one that already succeeded. The first request already saved the
        # gesture — surface that as a clean 409 instead of an unhandled 500.
        db.rollback()
        raise HTTPException(status_code=409, detail=f"'{name}' was already saved by an earlier request")
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


# ── Communication gestures ────────────────────────────────────────────────────
# Which gestures the robot uses while explaining. The selection lives on the robot
# (app_config.json → g1.communication_gestures, read fresh by the pipeline every reply).
# Two mutually exclusive modes, chosen per-robot depending on whether it has a physical
# waist lock fitted:
#
#   mode="recorded"     (HAS a waist lock) — our own recorded .gesture files, tenant-scoped
#                       Postgres rows (CustomGesture), namespaced on-disk per _disk_name().
#   mode="unitree_app"  (NO waist lock) — recording through our own UI was found to
#                       destabilize a robot's balance without a physical waist lock, so this
#                       robot's 3 comm gestures ("short"/"medium"/"long" roles) are instead
#                       taught through the Unitree mobile app's "demo teaching" feature and
#                       fired via ExecuteAction(name). These are free-text names typed by the
#                       operator (not files, not tenant-scoped rows — one robot per tenant, so
#                       no namespacing collision risk) that must be confirmed present on the
#                       robot with POST .../communication/verify before being relied on.

COMM_GESTURE_MAX = 3
UDEMO_ROLES = ("short", "medium", "long")


class CommunicationSetIn(BaseModel):
    enabled: bool = False
    mode: str = Field(default="recorded", pattern="^(recorded|unitree_app)$")
    names: List[str] = Field(default_factory=list)              # mode="recorded"
    unitree_roles: Dict[str, str] = Field(default_factory=dict)  # mode="unitree_app"
    min_reply_chars: Optional[int] = Field(default=None, ge=20, le=2000)


class CommunicationTestIn(BaseModel):
    mode: Optional[str] = None
    names: List[str] = Field(default_factory=list)
    unitree_roles: Dict[str, str] = Field(default_factory=dict)
    seconds: float = Field(default=10.0, ge=3.0, le=30.0)


class CommunicationVerifyIn(BaseModel):
    unitree_roles: Dict[str, str] = Field(default_factory=dict)


def _clean_unitree_roles(roles: Dict[str, str]) -> Dict[str, str]:
    """Only the 3 known roles, trimmed, empty-string default for unset ones."""
    cleaned = {role: str((roles or {}).get(role, "")).strip() for role in UDEMO_ROLES}
    return cleaned


async def _ensure_on_robot(client: httpx.AsyncClient, base: str, gesture: CustomGesture, disk_name: str) -> None:
    """Push a recording from Postgres to the Thor if its .gesture file is missing (reflash, robot swap)."""
    exists = await client.head(f"{base}/gestures/custom/{disk_name}", timeout=5.0)
    if exists.status_code == 404:
        logger.info(f"[Gestures] '{gesture.name}' missing on Thor — pushing from Postgres")
        push = await client.post(
            f"{base}/gestures/custom/push",
            json={"name": disk_name, "waypoints": gesture.waypoints},
            timeout=15.0,
        )
        push.raise_for_status()
    else:
        exists.raise_for_status()


def _duration_band(duration_s: float) -> str:
    """
    Short/Medium/Long band from a recording's measured length — mirrors
    frontend/g1-dashboard/app/features/communication-gestures/types.ts durationBand().
    Short: 1-10s, Medium: 10-30s, Long: 30s+. The communication set is exactly one
    gesture per band (never two of the same length class) so the robot's per-reply
    selection (g1-nlp comm_seq_select_take) always has one option per rough speech
    length rather than two competing for the same slot.
    """
    if duration_s < 10:
        return "Short"
    if duration_s < 30:
        return "Medium"
    return "Long"


def _tenant_gestures(db: Session, tenant_id: str, names: List[str]) -> List[CustomGesture]:
    """Resolve logical names to this tenant's rows, preserving order; 404 on any unknown name."""
    unique = list(dict.fromkeys(n.strip() for n in names if n and n.strip()))
    if len(unique) > COMM_GESTURE_MAX:
        raise HTTPException(status_code=400, detail=f"Choose at most {COMM_GESTURE_MAX} gestures")
    rows = []
    for n in unique:
        row = (
            db.query(CustomGesture)
            .filter(CustomGesture.tenant_id == tenant_id, CustomGesture.name == n)
            .first()
        )
        if not row:
            raise HTTPException(status_code=404, detail=f"Gesture '{n}' not found")
        rows.append(row)
    return rows


def _robot_error(base: str, exc: Exception) -> HTTPException:
    if isinstance(exc, httpx.ConnectError):
        return HTTPException(status_code=502, detail=f"Cannot reach robot_sync at {base}.")
    if isinstance(exc, httpx.HTTPStatusError):
        return HTTPException(status_code=exc.response.status_code, detail=exc.response.text)
    return HTTPException(status_code=502, detail=str(exc))


@router.get("/communication")
async def get_communication_set(
    robot_ip: Optional[str] = None,
    current_user: User = Depends(get_current_user),
):
    """The robot's current communication-gesture set, in this tenant's logical names."""
    base = _robot_sync_url(robot_ip)
    try:
        async with httpx.AsyncClient() as client:
            r = await client.get(f"{base}/gestures/communication", timeout=5.0)
            r.raise_for_status()
    except Exception as e:
        raise _robot_error(base, e)

    data = r.json()
    prefix = f"{current_user.tenant_id}__"
    names = [n[len(prefix):] for n in data.get("names", []) if n.startswith(prefix)]
    mode = data.get("mode") if data.get("mode") in ("recorded", "unitree_app") else "recorded"
    unitree_roles = _clean_unitree_roles(data.get("unitree_roles") or {})
    return {
        "enabled": bool(data.get("enabled")) and (bool(names) if mode == "recorded" else any(unitree_roles.values())),
        "mode": mode,
        "names": names,
        "unitree_roles": unitree_roles,
        "min_reply_chars": data.get("min_reply_chars", 120),
    }


@router.put("/communication")
async def put_communication_set(
    body: CommunicationSetIn,
    robot_ip: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Select gestures for the robot to use while explaining.

    mode="recorded": at most one per Short/Medium/Long band (the frontend enforces this by
    replacing on add; this is the server-side backstop, e.g. against a stale second browser
    tab) — our own recorded gestures, needs a physical waist lock on the robot.

    mode="unitree_app": short/medium/long role → gesture name taught through the Unitree
    app's "demo teaching" feature — no waist lock needed. Names aren't validated here (they
    aren't local files); call POST .../communication/verify first to confirm they're
    actually taught on the robot.
    """
    base = _robot_sync_url(robot_ip)

    if body.mode == "unitree_app":
        roles = _clean_unitree_roles(body.unitree_roles)
        try:
            async with httpx.AsyncClient() as client:
                r = await client.put(
                    f"{base}/gestures/communication",
                    json={"enabled": body.enabled, "mode": "unitree_app",
                          "unitree_roles": roles, "min_reply_chars": body.min_reply_chars},
                    timeout=10.0,
                )
                r.raise_for_status()
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"[Gestures] Saving communication set (unitree_app) failed: {e}")
            raise _robot_error(base, e)

        saved = r.json()
        logger.info(f"[Gestures] Communication set (tenant={current_user.tenant_id}, mode=unitree_app): "
                    f"enabled={saved.get('enabled')} roles={saved.get('unitree_roles')}")
        return {
            "enabled": bool(saved.get("enabled")),
            "mode": "unitree_app",
            "names": [],
            "unitree_roles": _clean_unitree_roles(saved.get("unitree_roles") or roles),
            "min_reply_chars": saved.get("min_reply_chars", 120),
        }

    rows = _tenant_gestures(db, current_user.tenant_id, body.names)
    bands: dict = {}
    for g in rows:
        band = _duration_band(g.duration_s)
        if band in bands:
            raise HTTPException(
                status_code=400,
                detail=f"'{g.name}' and '{bands[band]}' are both {band} ({g.duration_s:.1f}s) — "
                       f"only one {band} gesture may be used at a time. Remove one first.",
            )
        bands[band] = g.name
    disk_names = [_disk_name(current_user.tenant_id, g.name) for g in rows]
    try:
        async with httpx.AsyncClient() as client:
            for g, disk in zip(rows, disk_names):
                await _ensure_on_robot(client, base, g, disk)
            r = await client.put(
                f"{base}/gestures/communication",
                json={"enabled": body.enabled, "mode": "recorded", "names": disk_names,
                      "min_reply_chars": body.min_reply_chars},
                timeout=10.0,
            )
            r.raise_for_status()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Gestures] Saving communication set failed: {e}")
        raise _robot_error(base, e)

    saved = r.json()
    logger.info(f"[Gestures] Communication set (tenant={current_user.tenant_id}): "
                f"enabled={saved.get('enabled')} names={[g.name for g in rows]}")
    return {
        "enabled": bool(saved.get("enabled")),
        "mode": "recorded",
        "names": [g.name for g in rows],
        "unitree_roles": {"short": "", "medium": "", "long": ""},
        "min_reply_chars": saved.get("min_reply_chars", 120),
    }


@router.post("/communication/verify")
async def verify_communication_set(
    body: CommunicationVerifyIn,
    robot_ip: Optional[str] = None,
    current_user: User = Depends(get_current_user),
):
    """
    Confirm gestures taught through the Unitree app's "demo teaching" feature actually exist
    on the robot, before enabling mode="unitree_app". There's no documented Unitree SDK API
    to list custom-taught action names, so robot_sync/robot_agent briefly fire each name
    (~400ms) and report whether the robot accepted it — this necessarily moves the arm
    briefly for each named role given.

    Body: {"unitree_roles": {"short": "NAME", "medium": "NAME", "long": "NAME"}}
    (any subset may be given — only non-empty names are tested)
    Returns: {"short": {"name": "...", "found": bool, "ret": int}, ...}
    """
    roles = {role: name for role, name in _clean_unitree_roles(body.unitree_roles).items() if name}
    if not roles:
        raise HTTPException(status_code=400, detail="Provide at least one gesture name to verify")
    base = _robot_sync_url(robot_ip)
    try:
        async with httpx.AsyncClient() as client:
            r = await client.post(
                f"{base}/gestures/communication/verify",
                json={"unitree_roles": roles},
                timeout=15.0,
            )
            r.raise_for_status()
    except HTTPException:
        raise
    except Exception as e:
        raise _robot_error(base, e)
    return r.json()


@router.post("/communication/test")
async def test_communication_set(
    body: CommunicationTestIn,
    robot_ip: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Play the given gestures as a communication sequence for a few seconds, without speech."""
    base = _robot_sync_url(robot_ip)
    mode = body.mode if body.mode in ("recorded", "unitree_app") else "recorded"

    if mode == "unitree_app":
        roles = {role: name for role, name in _clean_unitree_roles(body.unitree_roles).items() if name}
        if not roles:
            raise HTTPException(status_code=400, detail="Select at least one Unitree-app gesture to test")
        try:
            async with httpx.AsyncClient() as client:
                r = await client.post(
                    f"{base}/gestures/communication/test",
                    json={"mode": "unitree_app", "unitree_roles": roles, "seconds": body.seconds},
                    timeout=10.0,
                )
                r.raise_for_status()
        except HTTPException:
            raise
        except Exception as e:
            raise _robot_error(base, e)
        return {"status": "testing", "mode": mode, "unitree_roles": roles, "seconds": body.seconds}

    rows = _tenant_gestures(db, current_user.tenant_id, body.names)
    if not rows:
        raise HTTPException(status_code=400, detail="Select at least one gesture to test")
    disk_names = [_disk_name(current_user.tenant_id, g.name) for g in rows]
    try:
        async with httpx.AsyncClient() as client:
            for g, disk in zip(rows, disk_names):
                await _ensure_on_robot(client, base, g, disk)
            r = await client.post(
                f"{base}/gestures/communication/test",
                json={"mode": "recorded", "names": disk_names, "seconds": body.seconds},
                timeout=10.0,
            )
            r.raise_for_status()
    except HTTPException:
        raise
    except Exception as e:
        raise _robot_error(base, e)
    return {"status": "testing", "mode": mode, "names": [g.name for g in rows], "seconds": body.seconds}


# Canonical builtin gesture names — mirrors BUILTIN_GESTURES in robot_sync.py.
# Kept here so the backend can validate before hitting the robot network.
BUILTIN_GESTURES = {
    "wave_hello", "wave_goodbye", "shake_hand", "high_five", "hug",
    "high_wave", "clap", "left_kiss", "right_kiss", "two_hand_kiss",
    "heart", "hands_up", "x_ray", "reject",
}


@router.post("/builtin/{gesture_name}/play")
async def play_builtin_gesture(
    gesture_name: str,
    robot_ip: Optional[str] = None,
    current_user: User = Depends(get_current_user),
):
    """
    Execute one of the G1's built-in arm-action gestures.
    Proxies directly to robot_sync POST /gestures/builtin/{name}/play.
    No DB lookup — these are hardware-defined, not tenant data.
    """
    if gesture_name not in BUILTIN_GESTURES:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown builtin gesture '{gesture_name}'. "
                   f"Valid: {sorted(BUILTIN_GESTURES)}"
        )
    base = _robot_sync_url(robot_ip)
    async with httpx.AsyncClient() as client:
        try:
            r = await client.post(
                f"{base}/gestures/builtin/{gesture_name}/play",
                timeout=30.0,
            )
            r.raise_for_status()
            logger.info(f"[Gestures] Builtin '{gesture_name}' dispatched to robot")
            return {"status": "playing", "gesture": gesture_name}
        except httpx.ConnectError:
            raise HTTPException(status_code=502, detail=f"Cannot reach robot_sync at {base}.")
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=e.response.status_code, detail=e.response.text)
        except Exception as e:
            logger.error(f"[Gestures] Error playing builtin '{gesture_name}': {e}")
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
