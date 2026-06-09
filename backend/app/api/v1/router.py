"""API v1 router aggregation."""

from fastapi import APIRouter

from app.api.v1.endpoints import documents, chat, settings, dashboard, health, retrieve, auth, sessions, memory

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(sessions.router, prefix="/sessions", tags=["sessions"])
api_router.include_router(memory.router, prefix="/memory", tags=["memory"])
api_router.include_router(documents.router, prefix="/documents", tags=["documents"])
api_router.include_router(chat.router, prefix="/chat", tags=["chat"])
api_router.include_router(settings.router, prefix="/settings", tags=["settings"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(health.router, prefix="/health", tags=["health"])
api_router.include_router(retrieve.router, prefix="/retrieve", tags=["retrieve"])
