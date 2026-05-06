"""Dashboard API endpoints."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timedelta

from app.db.database import get_db
from app.models.document import Document, DocumentStatus
from app.models.activity import Activity
from app.core.logging import logger

router = APIRouter()


class DashboardStats(BaseModel):
    """Dashboard statistics schema."""
    totalDocuments: int
    indexedChunks: int
    activeModels: int
    queriesToday: int
    storageUsed: str
    storageTotal: str
    lastIndexed: str


class RecentDocument(BaseModel):
    """Recent document schema."""
    id: int
    name: str
    size: str
    date: str
    status: str


class ModelStatus(BaseModel):
    """Model status schema."""
    name: str
    type: str
    status: str
    lastUsed: str


class ActivityItem(BaseModel):
    """Activity item schema."""
    id: int
    action: str
    target: str
    time: str
    type: str


class DashboardResponse(BaseModel):
    """Dashboard response schema."""
    stats: DashboardStats
    recentDocuments: List[RecentDocument]
    modelStatus: List[ModelStatus]
    activities: List[ActivityItem]


@router.get("/stats", response_model=DashboardStats)
async def get_stats(db: Session = Depends(get_db)):
    """Get dashboard statistics."""
    
    # Document counts
    total_docs = db.query(Document).count()
    indexed_docs = db.query(Document).filter(
        Document.status == DocumentStatus.INDEXED
    ).count()
    
    # Calculate total chunks (placeholder)
    total_chunks = sum(
        doc.chunks_count or 0 
        for doc in db.query(Document).all()
    )
    
    # Calculate storage
    total_bytes = sum(
        doc.file_size for doc in db.query(Document).all()
    )
    
    # Format storage
    storage_used = _format_bytes(total_bytes)
    storage_total = "2 GB"
    
    # Last indexed
    last_indexed_doc = db.query(Document).filter(
        Document.status == DocumentStatus.INDEXED
    ).order_by(Document.indexed_at.desc()).first()
    
    last_indexed = "-"
    if last_indexed_doc and last_indexed_doc.indexed_at:
        last_indexed = _time_ago(last_indexed_doc.indexed_at)
    
    return DashboardStats(
        totalDocuments=total_docs,
        indexedChunks=total_chunks,
        activeModels=0,  # TODO: Get from model service
        queriesToday=0,  # TODO: Track queries
        storageUsed=storage_used,
        storageTotal=storage_total,
        lastIndexed=last_indexed
    )


@router.get("/recent-documents", response_model=List[RecentDocument])
async def get_recent_documents(
    limit: int = 5,
    db: Session = Depends(get_db)
):
    """Get recent documents."""
    docs = db.query(Document).order_by(
        Document.created_at.desc()
    ).limit(limit).all()
    
    return [doc.to_dict() for doc in docs]


@router.get("/activities", response_model=List[ActivityItem])
async def get_activities(
    limit: int = 10,
    db: Session = Depends(get_db)
):
    """Get recent activities."""
    activities = db.query(Activity).order_by(
        Activity.created_at.desc()
    ).limit(limit).all()
    
    return [activity.to_dict() for activity in activities]


@router.get("/models", response_model=List[ModelStatus])
async def get_model_status():
    """Get model status."""
    # TODO: Get from actual model service
    return []


@router.get("/", response_model=DashboardResponse)
async def get_full_dashboard(db: Session = Depends(get_db)):
    """Get full dashboard data."""
    stats = await get_stats(db)
    recent_docs = await get_recent_documents(db=db)
    activities = await get_activities(db=db)
    models = await get_model_status()
    
    return DashboardResponse(
        stats=stats,
        recentDocuments=recent_docs,
        modelStatus=models,
        activities=activities
    )


def _format_bytes(bytes_val: int) -> str:
    """Format bytes to human readable."""
    for unit in ["B", "KB", "MB", "GB"]:
        if bytes_val < 1024:
            return f"{bytes_val:.1f} {unit}"
        bytes_val /= 1024
    return f"{bytes_val:.1f} TB"


def _time_ago(dt: datetime) -> str:
    """Format datetime as time ago."""
    now = datetime.utcnow()
    diff = now - dt
    
    if diff.days == 0:
        if diff.seconds < 60:
            return "Just now"
        elif diff.seconds < 3600:
            return f"{diff.seconds // 60} min ago"
        else:
            return f"{diff.seconds // 3600} hours ago"
    elif diff.days == 1:
        return "Yesterday"
    else:
        return f"{diff.days} days ago"
