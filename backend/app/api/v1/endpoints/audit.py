from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import cast, String
from typing import List, Optional
from datetime import datetime

from app.db.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.audit_log import AuditLog

router = APIRouter()

@router.get("/")
def get_audit_logs(
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get audit logs for the current tenant/user."""
    # Filter by the current user's tenant
    query = db.query(
        AuditLog.id,
        AuditLog.action,
        AuditLog.endpoint,
        AuditLog.method,
        AuditLog.status_code.label('status'),
        AuditLog.created_at.label('timestamp'),
        AuditLog.details,
        User.username.label('name'),
        User.email
    ).outerjoin(
        User, AuditLog.user_id == cast(User.id, String)
    ).filter(
        AuditLog.tenant_id == current_user.tenant_id
    ).order_by(AuditLog.created_at.desc())
    
    total = query.count()
    logs = query.offset(offset).limit(limit).all()
    
    return {
        "total": total,
        "logs": [
            {
                "id": log.id,
                "action": log.action,
                "endpoint": log.endpoint,
                "method": log.method,
                "status": log.status,
                "timestamp": log.timestamp.isoformat() if log.timestamp else None,
                "name": log.name or "System",
                "email": log.email or "system@local",
                "details": log.details,
            }
            for log in logs
        ]
    }
