"""
FRS live feed — admin-only relay of the FRS camera's annotated MJPEG preview.

Why a ticket: the browser shows the stream in an <img> tag, which cannot send the
Bearer token. So the dashboard first POSTs /ticket with its normal admin token (this
POST is what the audit middleware records as "someone opened the live feed"), gets a
60-second single-purpose JWT, and puts it in the <img src> query string. The stream
endpoint accepts ONLY that ticket type, never a login token.

Cost: the FRS process encodes preview JPEGs only while at least one viewer is connected
(g1-nlp/frs/live_feed.py), and every stream ends after MAX_STREAM_SECONDS, so a forgotten
browser tab can't keep the camera encoding forever.
"""

import time
import uuid

import httpx
import jwt
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from app.core.config import settings as app_settings
from app.core.logging import logger
from app.core.security import require_admin
from app.models.user import User

router = APIRouter()

TICKET_TTL_SECONDS = 60
TICKET_AUDIENCE = "frs-live-feed"
MAX_STREAM_SECONDS = 300          # matches FRS; the dashboard shows this countdown
FRS_CONNECT_TIMEOUT_S = 5.0


@router.post("/ticket")
def create_ticket(current_user: User = Depends(require_admin)):
    """Issue a short-lived ticket that lets the caller open the live feed stream once."""
    now = int(time.time())
    ticket = jwt.encode(
        {"sub": str(current_user.id), "aud": TICKET_AUDIENCE, "iat": now,
         "exp": now + TICKET_TTL_SECONDS, "jti": uuid.uuid4().hex},
        app_settings.SECRET_KEY, algorithm="HS256")
    logger.info(f"[frs-live-feed] ticket issued to user {current_user.id} ({current_user.email})")
    return {"ticket": ticket, "expires_in": TICKET_TTL_SECONDS, "max_seconds": MAX_STREAM_SECONDS}


@router.get("/stream")
async def stream(ticket: str):
    """Relay the FRS MJPEG stream to the browser. Auth = ticket from POST /ticket."""
    try:
        claims = jwt.decode(ticket, app_settings.SECRET_KEY, algorithms=["HS256"],
                            audience=TICKET_AUDIENCE)
    except jwt.PyJWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid or expired live-feed ticket: {e}")

    client = httpx.AsyncClient(timeout=httpx.Timeout(FRS_CONNECT_TIMEOUT_S, read=30.0))
    try:
        req = client.build_request("GET", f"{app_settings.FRS_URL}/live_feed",
                                   params={"max_seconds": MAX_STREAM_SECONDS})
        upstream = await client.send(req, stream=True)
    except httpx.RequestError as e:
        await client.aclose()
        logger.error(f"[frs-live-feed] FRS unreachable: {e}")
        raise HTTPException(status_code=503, detail="Face recognition service is not reachable")
    if upstream.status_code != 200:
        body = (await upstream.aread()).decode(errors="replace")
        await upstream.aclose()
        await client.aclose()
        detail = "Camera is not active" if upstream.status_code == 503 else body
        raise HTTPException(status_code=upstream.status_code, detail=detail)

    logger.info(f"[frs-live-feed] stream opened by user {claims['sub']}")

    async def relay():
        try:
            async for chunk in upstream.aiter_raw():
                yield chunk
        except httpx.HTTPError as e:
            logger.warning(f"[frs-live-feed] upstream ended: {e}")
        finally:
            await upstream.aclose()
            await client.aclose()
            logger.info(f"[frs-live-feed] stream closed for user {claims['sub']}")

    return StreamingResponse(relay(), media_type=upstream.headers.get("content-type"),
                             headers={"Cache-Control": "no-store"})
