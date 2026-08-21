"""
Robot liveness — aggregates three independent connectivity signals so the
dashboard can tell "robot is off" apart from "AGX Thor is unreachable" apart
from "robot_agent crashed but the Thor is fine".

Previously the dashboard computed robotStatus as a copy of the AGX health
check (see frontend/g1-dashboard/app/dashboard/page.tsx), so a powered-off G1
still showed ONLINE. This endpoint calls out to robot_sync.py's own
/robot/ping and /robot/agent-ports, which run on the AGX itself — the backend
has no network route to the robot's 192.168.123.0/24 subnet and cannot check
this directly.
"""

from fastapi import APIRouter
import httpx
import logging
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()


def _robot_sync_url(host: Optional[str] = None) -> str:
    h = host or settings.ROBOT_SYNC_HOST
    return f"http://{h}:{settings.ROBOT_SYNC_PORT}"


@router.get("/status")
async def robot_status(robot_ip: Optional[str] = None):
    """
    Returns Thor / Robot / Agent as three separate signals.

    thor   — implicit "online": if this request completed, the backend is up
             and the request reached us, which in this deployment means the
             AGX-hosted stack the dashboard depends on is reachable. Kept as
             an explicit field (rather than inferred client-side) so the UI
             shape doesn't have to special-case it.
    robot  — from robot_sync's own ping to the G1 PC1 IP (192.168.123.164).
             "unknown" (never "online") if robot_sync itself can't be reached
             — that ambiguity is the whole point of this endpoint.
    agent  — which of robot_agent's TCP ports (7788 gesture, 7789 audio,
             7790 status — the latter not yet deployed) are accepting
             connections. Lets "robot on, agent crashed" read differently
             from "robot off".
    """
    url = _robot_sync_url(robot_ip)

    async with httpx.AsyncClient() as client:
        try:
            ping_resp = await client.get(f"{url}/robot/ping", timeout=3.0)
            ping_resp.raise_for_status()
            ping = ping_resp.json()
            robot_block = {
                "status":     "online" if ping.get("reachable") else "offline",
                "reachable":  ping.get("reachable", False),
                "ip":         ping.get("robot_ip"),
                "checked_at": ping.get("checked_at"),
            }
        except Exception as e:
            logger.warning(f"[Robot] /robot/ping unreachable via {url}: {e}")
            robot_block = {"status": "unknown", "reachable": None,
                           "ip": None, "checked_at": None}

        try:
            ports_resp = await client.get(f"{url}/robot/agent-ports", timeout=3.0)
            ports_resp.raise_for_status()
            ports_data = ports_resp.json()
            ports = ports_data.get("ports", {})
            agent_block = {
                "status": "online" if any(ports.values()) else "offline",
                "ports":  ports,
            }
        except Exception as e:
            logger.warning(f"[Robot] /robot/agent-ports unreachable via {url}: {e}")
            agent_block = {"status": "unknown", "ports": {}}

    return {
        "thor":  {"status": "online",
                  "note": "implicit — this response could not have been "
                          "produced if the AGX-hosted stack were unreachable"},
        "robot": robot_block,
        "agent": agent_block,
    }
