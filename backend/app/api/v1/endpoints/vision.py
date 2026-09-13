"""
Vision (VLM tool) — thin proxy to robot_sync's /vision endpoint.

The dashboard's VLM Vision toggle (feature flag `vlmVision`) turns the robot's
"look_through_camera" tool on or off (g1-nlp/services/perception/vision_service.py).
The model stays loaded on the robot at all times once enabled once (keep_alive=-1);
this only flips whether the LLM is offered the tool, and the conversation pipeline
re-reads the config fresh on every reply — no restart needed on either side. Mirrors
voice_studio.py's proxy pattern.
"""

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.config import settings as app_settings
from app.core.logging import logger

router = APIRouter()

ROBOT_TIMEOUT_S = 10.0


class VisionToggle(BaseModel):
    enabled: bool


def _robot_sync_url() -> str:
    return f"http://{app_settings.ROBOT_SYNC_HOST}:{app_settings.ROBOT_SYNC_PORT}"


async def _forward(method: str, path: str, **kwargs):
    """Call robot_sync and pass its JSON back; map failures to 4xx/5xx with a clear message."""
    url = f"{_robot_sync_url()}{path}"
    try:
        async with httpx.AsyncClient(timeout=ROBOT_TIMEOUT_S) as client:
            resp = await client.request(method, url, **kwargs)
    except httpx.RequestError as e:
        logger.error(f"[vision] robot_sync unreachable at {url}: {e}")
        raise HTTPException(status_code=503, detail="The robot is not reachable (robot_sync is down)")
    if resp.status_code >= 400:
        try:
            detail = resp.json().get("detail", resp.text)
        except ValueError:
            detail = resp.text
        logger.warning(f"[vision] {method} {path} -> {resp.status_code}: {detail}")
        raise HTTPException(status_code=resp.status_code, detail=detail)
    return resp.json()


@router.get("/")
async def get_vision():
    """Current VLM-tool config (enabled flag, model, urls, timeouts)."""
    return await _forward("GET", "/vision")


@router.put("/")
async def put_vision(body: VisionToggle):
    """Turn the VLM tool on/off. Only `enabled` is writable from the dashboard today —
    model/timeout/snapshot settings need a matched Ollama pull + latency check
    (tests/test_vision_latency.py) before changing on a live robot."""
    logger.info(f"[vision] enabled -> {body.enabled}")
    return await _forward("PUT", "/vision", json={"enabled": body.enabled})
