"""
Voice Studio — thin proxy to robot_sync's /studio/* endpoints.

The dashboard's Voice Studio (feature flag `voiceStudio`) lets an admin/editor type text,
upload a .txt script or build a playlist, and hear it spoken on the ROBOT speaker with
the voice currently saved in Settings -> Voice. All playback state lives on the robot
(g1-nlp/services/voice_studio/); this router only forwards requests and turns
robot_sync errors into readable HTTP errors. POST calls are recorded by the audit
middleware automatically.
"""

from typing import List, Optional

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.core.config import settings as app_settings
from app.core.logging import logger

router = APIRouter()

ROBOT_TIMEOUT_S = 10.0


class StudioItem(BaseModel):
    id: Optional[str] = None
    text: str = Field(..., min_length=1)


class StudioPlayRequest(BaseModel):
    items: List[StudioItem] = Field(..., min_length=1, max_length=100)
    language: str


def _robot_sync_url() -> str:
    return f"http://{app_settings.ROBOT_SYNC_HOST}:{app_settings.ROBOT_SYNC_PORT}"


async def _forward(method: str, path: str, **kwargs):
    """Call robot_sync and pass its JSON back; map failures to 4xx/5xx with a clear message."""
    url = f"{_robot_sync_url()}{path}"
    try:
        async with httpx.AsyncClient(timeout=ROBOT_TIMEOUT_S) as client:
            resp = await client.request(method, url, **kwargs)
    except httpx.RequestError as e:
        logger.error(f"[voice-studio] robot_sync unreachable at {url}: {e}")
        raise HTTPException(status_code=503, detail="The robot is not reachable (robot_sync is down)")
    if resp.status_code >= 400:
        try:
            detail = resp.json().get("detail", resp.text)
        except ValueError:
            detail = resp.text
        logger.warning(f"[voice-studio] {method} {path} -> {resp.status_code}: {detail}")
        raise HTTPException(status_code=resp.status_code, detail=detail)
    return resp.json()


@router.post("/play")
async def play(req: StudioPlayRequest):
    """Speak the given items in order on the robot (replaces current playback)."""
    chars = sum(len(i.text) for i in req.items)
    logger.info(f"[voice-studio] play {len(req.items)} item(s), {chars} chars, language={req.language}")
    return await _forward("POST", "/studio/play", json=req.model_dump())


@router.post("/pause")
async def pause():
    return await _forward("POST", "/studio/pause")


@router.post("/resume")
async def resume():
    return await _forward("POST", "/studio/resume")


@router.post("/stop")
async def stop():
    return await _forward("POST", "/studio/stop")


@router.get("/status")
async def status():
    return await _forward("GET", "/studio/status")


@router.get("/voice")
async def voice(language: str):
    """Resolved voice (engine, voice name, gain...) the robot will use for `language`."""
    return await _forward("GET", "/studio/voice", params={"language": language})
