from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict

from app.db.database import get_db
from app.models.notification import Notification
from app.core.security import get_current_user

router = APIRouter()

@router.get("/")
def get_notifications(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get all notifications for the current user's tenant, ordered by newest."""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=400, detail="No tenant_id in token")
        
    notifications = db.query(Notification)\
        .filter(Notification.tenant_id == tenant_id)\
        .order_by(Notification.created_at.desc())\
        .limit(50)\
        .all()
        
    return [
        {
            "id": n.id,
            "type": n.type,
            "message": n.message,
            "is_read": n.is_read,
            "date": n.created_at.isoformat()
        } for n in notifications
    ]

@router.put("/{notification_id}/read")
def mark_read(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Mark a notification as read."""
    tenant_id = current_user.get("tenant_id")
    notif = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.tenant_id == tenant_id
    ).first()
    
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
        
    notif.is_read = True
    db.commit()
    return {"success": True}
