"""Navigation API — talks to robot_agent (port 7788) and manages locations.json."""

import json
import pathlib
import socket
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.config import settings

router = APIRouter()

# ── Config ────────────────────────────────────────────────────────────────────

def _robot_host() -> str:
    return settings.ROBOT_AGENT_HOST   # set in .env as ROBOT_AGENT_HOST

def _robot_port() -> int:
    return settings.ROBOT_AGENT_PORT   # set in .env as ROBOT_AGENT_PORT

# locations.json lives in humanoid_nlp/config/ on the AGX.
# For the dashboard we keep a local copy at the path below and
# sync it to the robot when it changes.
LOCATIONS_PATH = pathlib.Path(
    "/home/surya/my_research/humanoid/humanoid_nlp/config/locations.json"
)

SLAM_API_IDS = {
    "start_mapping":  1801,
    "end_mapping":    1802,
    "relocation":     1804,
    "pause":          1201,
    "resume":         1202,
    "map_sequence_1": 1203,
    "map_sequence_2": 1204,
    "abort":          1205,
}

# ── Helpers ───────────────────────────────────────────────────────────────────

def _tcp_send(payload: dict, host: str = None,
              port: int = None, timeout: float = 5.0) -> dict:
    """Send JSON to robot_agent TCP and return status."""
    try:
        with socket.create_connection((host, port), timeout=timeout) as s:
            s.send(json.dumps(payload).encode())
        return {"success": True}
    except ConnectionRefusedError:
        return {"success": False, "error": f"Cannot connect to robot_agent at {host}:{port}"}
    except socket.timeout:
        return {"success": False, "error": "Connection timed out"}
    except Exception as e:
        return {"success": False, "error": str(e)}


def _load_locations() -> dict:
    if not LOCATIONS_PATH.exists():
        return {}
    try:
        data = json.loads(LOCATIONS_PATH.read_text())
        return data.get("locations", {})
    except Exception:
        return {}


def _save_locations(locations: dict) -> None:
    LOCATIONS_PATH.parent.mkdir(parents=True, exist_ok=True)
    current = {}
    if LOCATIONS_PATH.exists():
        try:
            current = json.loads(LOCATIONS_PATH.read_text())
        except Exception:
            pass
    current["locations"] = locations
    if "_comment" not in current:
        current["_comment"] = (
            "Maps spoken location names to keyDemo batch-group API IDs "
            "(rt/drex_slam_remote). keyDemo must be running."
        )
    LOCATIONS_PATH.write_text(json.dumps(current, indent=2))


# ── Schemas ───────────────────────────────────────────────────────────────────

class LocationCreate(BaseModel):
    name: str
    api_id: int
    aliases: list[str] = []

class NavigateRequest(BaseModel):
    location: str
    robot_host: Optional[str] = None
    robot_port: Optional[int] = None

class SlamCommandRequest(BaseModel):
    command: str          # one of SLAM_API_IDS keys
    robot_host: Optional[str] = None
    robot_port: Optional[int] = None

# ── Locations CRUD ────────────────────────────────────────────────────────────

@router.get("/locations")
def list_locations():
    """Return all locations with their API IDs."""
    raw = _load_locations()
    # Group by api_id so aliases show together
    by_api: dict[int, list[str]] = {}
    for name, api_id in raw.items():
        by_api.setdefault(api_id, []).append(name)

    locations = []
    for api_id, names in sorted(by_api.items()):
        locations.append({
            "primary_name": names[0],
            "aliases":      names[1:],
            "api_id":       api_id,
            "all_names":    names,
        })

    return {"locations": locations, "raw": raw}


@router.post("/locations")
def add_location(body: LocationCreate):
    """Add a new location (and optional aliases) to locations.json."""
    locs = _load_locations()

    name = body.name.lower().strip()
    if not name:
        raise HTTPException(status_code=400, detail="name cannot be empty")
    if body.api_id < 1300 or body.api_id > 1430:
        raise HTTPException(
            status_code=400,
            detail="api_id must be 1301-1399 (individual map) or 1401-1430 (batch group)"
        )

    locs[name] = body.api_id
    for alias in body.aliases:
        a = alias.lower().strip()
        if a:
            locs[a] = body.api_id

    _save_locations(locs)
    return {"success": True, "name": name, "api_id": body.api_id}


@router.put("/locations/{name}")
def update_location(name: str, body: LocationCreate):
    """Update a location's API ID."""
    locs = _load_locations()
    key = name.lower().strip()
    if key not in locs:
        raise HTTPException(status_code=404, detail=f"Location '{name}' not found")
    locs[key] = body.api_id
    _save_locations(locs)
    return {"success": True, "name": key, "api_id": body.api_id}


@router.delete("/locations/{name}")
def delete_location(name: str):
    """Remove a location (and all aliases with same api_id)."""
    locs = _load_locations()
    key = name.lower().strip()
    if key not in locs:
        raise HTTPException(status_code=404, detail=f"Location '{name}' not found")

    api_id = locs[key]
    # Remove all names that map to the same api_id
    to_delete = [k for k, v in locs.items() if v == api_id]
    for k in to_delete:
        del locs[k]

    _save_locations(locs)
    return {"success": True, "removed": to_delete}


# ── Navigation ────────────────────────────────────────────────────────────────

@router.post("/go")
def navigate_to(body: NavigateRequest):
    """
    Send navigate_to command to robot_agent.
    robot_agent looks up the location in locations.json and publishes
    the api_id to rt/drex_slam_remote → keyDemo runs the map sequence.
    """
    location = body.location.lower().strip()
    if not location:
        raise HTTPException(status_code=400, detail="location cannot be empty")

    # Validate the location exists
    locs = _load_locations()
    if location not in locs:
        available = list(locs.keys())
        raise HTTPException(
            status_code=404,
            detail=f"Location '{location}' not found. Available: {available}"
        )

    host = body.robot_host or _robot_host()
    port = body.robot_port or _robot_port()

    result = _tcp_send(
        {"gesture": "navigate_to", "location": location},
        host=host,
        port=port,
    )

    if not result["success"]:
        raise HTTPException(status_code=503, detail=result.get("error", "Navigation failed"))

    return {
        "success":  True,
        "location": location,
        "api_id":   locs[location],
        "message":  f"Navigation to '{location}' started (api_id={locs[location]})",
    }


# ── SLAM Commands ─────────────────────────────────────────────────────────────

@router.post("/slam/{command}")
def slam_command(command: str, robot_host: Optional[str] = None,
                 robot_port: Optional[int] = None):
    """
    Send a SLAM command to robot_agent which publishes to DDS.
    Commands: start_mapping, end_mapping, relocation, pause, resume,
              map_sequence_1, map_sequence_2, abort
    """
    if command not in SLAM_API_IDS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown command '{command}'. Valid: {list(SLAM_API_IDS)}"
        )

    api_id = SLAM_API_IDS[command]
    host   = robot_host or _robot_host()
    port   = robot_port or _robot_port()

    result = _tcp_send(
        {"gesture": "slam_command", "api_id": api_id, "command": command},
        host=host, port=port,
    )

    if not result["success"]:
        raise HTTPException(status_code=503, detail=result.get("error", "SLAM command failed"))

    return {
        "success": True,
        "command": command,
        "api_id":  api_id,
        "message": f"SLAM command '{command}' sent (api_id={api_id})",
    }


@router.get("/slam/commands")
def list_slam_commands():
    """List all available SLAM commands and their API IDs."""
    return {
        "commands": [
            {"command": k, "api_id": v, "description": {
                "start_mapping":  "Start LiDAR mapping (move robot for 15+ seconds)",
                "end_mapping":    "Stop mapping and save .pcd file",
                "relocation":     "Localize robot on existing map",
                "pause":          "Pause active navigation",
                "resume":         "Resume paused navigation",
                "map_sequence_1": "Run map_sequence.yaml (full route)",
                "map_sequence_2": "Run map_sequence_2.yaml (alt route)",
                "abort":          "Abort active map sequence immediately",
            }.get(k, "")}
            for k, v in SLAM_API_IDS.items()
        ]
    }


@router.get("/status")
def navigation_status(robot_host: Optional[str] = None,
                      robot_port: Optional[int] = None):
    """Check robot_agent connectivity and return locations count."""
    host = robot_host or _robot_host()
    port = robot_port or _robot_port()

    try:
        with socket.create_connection((host, port), timeout=3):
            reachable = True
    except Exception:
        reachable = False

    locs = _load_locations()
    return {
        "robot_agent_reachable": reachable,
        "robot_agent_host":      host,
        "robot_agent_port":      port,
        "locations_count":       len(locs),
        "locations":             list(locs.keys()),
    }
