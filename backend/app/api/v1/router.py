"""API v1 router aggregation."""

from fastapi import APIRouter, Depends
from app.core.security import RequireRole

from app.api.v1.endpoints import documents, chat, settings, dashboard, health, retrieve, auth, sessions, memory, employees, wakeword, navigation, personas, tenant, mcp, gestures, robot, audit, notifications, voice_studio, frs_live_feed, vision

api_router = APIRouter()

# --- ADMIN ONLY ---
api_router.include_router(tenant.router,    prefix="/tenant",    tags=["tenant"])
api_router.include_router(mcp.router,       prefix="/mcp",       tags=["mcp"])
api_router.include_router(settings.router,  prefix="/settings",  tags=["settings"],   dependencies=[Depends(RequireRole(["admin"]))])
api_router.include_router(audit.router,     prefix="/audit-logs",tags=["audit-logs"], dependencies=[Depends(RequireRole(["admin"]))])

# --- INTERNAL MQTT SYNC (No Auth Required) ---
api_router.include_router(tenant.sync_router, prefix="/tenant", tags=["tenant_sync"])

# --- ADMIN & EDITOR ---
api_router.include_router(documents.router, prefix="/documents", tags=["documents"])
api_router.include_router(personas.router,  prefix="/personas",  tags=["personas"])
api_router.include_router(wakeword.router,  prefix="/wakeword",  tags=["wakeword"])
api_router.include_router(gestures.router,  prefix="/gestures",  tags=["gestures"])
api_router.include_router(robot.router,     prefix="/robot",     tags=["robot"])
api_router.include_router(navigation.router,prefix="/navigation",tags=["navigation"])
api_router.include_router(voice_studio.router, prefix="/voice-studio", tags=["voice-studio"], dependencies=[Depends(RequireRole(["admin", "editor"]))])
api_router.include_router(vision.router,    prefix="/vision",    tags=["vision"],     dependencies=[Depends(RequireRole(["admin", "editor"]))])

# --- ADMIN, EDITOR, USER ---
api_router.include_router(chat.router,      prefix="/chat",      tags=["chat"],       dependencies=[Depends(RequireRole(["admin", "editor", "user"]))])
api_router.include_router(retrieve.router,  prefix="/retrieve",  tags=["retrieve"])
api_router.include_router(sessions.router,  prefix="/sessions",  tags=["sessions"],   dependencies=[Depends(RequireRole(["admin", "editor", "user"]))])
api_router.include_router(memory.router,    prefix="/memory",    tags=["memory"],     dependencies=[Depends(RequireRole(["admin", "editor", "user"]))])
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"], dependencies=[Depends(RequireRole(["admin", "editor", "user"]))])

# --- MIXED / PUBLIC (Auth applied per-endpoint) ---
api_router.include_router(auth.router,      prefix="/auth",      tags=["auth"])
api_router.include_router(frs_live_feed.router, prefix="/employees/live-feed", tags=["frs-live-feed"])  # admin ticket + ticket-auth stream
api_router.include_router(employees.router, prefix="/employees", tags=["employees"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(health.router,    prefix="/health",    tags=["health"])
