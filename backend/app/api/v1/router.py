"""API v1 router aggregation."""

from fastapi import APIRouter

from app.api.v1.endpoints import documents, chat, settings, dashboard, health, retrieve, auth, sessions, memory, employees, wakeword, navigation, personas, tenant, mcp, gestures

api_router = APIRouter()

api_router.include_router(auth.router,      prefix="/auth",      tags=["auth"])
api_router.include_router(employees.router, prefix="/employees", tags=["employees"])
api_router.include_router(sessions.router,  prefix="/sessions",  tags=["sessions"])
api_router.include_router(memory.router,    prefix="/memory",    tags=["memory"])
api_router.include_router(documents.router, prefix="/documents", tags=["documents"])
api_router.include_router(chat.router,      prefix="/chat",      tags=["chat"])
api_router.include_router(settings.router,  prefix="/settings",  tags=["settings"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(health.router,    prefix="/health",    tags=["health"])
api_router.include_router(retrieve.router,  prefix="/retrieve",  tags=["retrieve"])
api_router.include_router(wakeword.router,  prefix="/wakeword",  tags=["wakeword"])
api_router.include_router(navigation.router,prefix="/navigation",tags=["navigation"])
api_router.include_router(personas.router,  prefix="/personas",  tags=["personas"])
api_router.include_router(tenant.router,    prefix="/tenant",    tags=["tenant"])
api_router.include_router(mcp.router,       prefix="/mcp",       tags=["mcp"])
api_router.include_router(gestures.router,  prefix="/gestures",  tags=["gestures"])
