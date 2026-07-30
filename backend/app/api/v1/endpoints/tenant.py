import json
import logging
from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException, Body, status
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.tenant import Tenant, TenantMcpConfig
from app.models.user import User
from app.models.support_ticket import SupportTicket
from app.models.notification import Notification

router = APIRouter()
logger = logging.getLogger(__name__)

def publish_upstream_sync(tenant_id: str, profile_data: dict):
    try:
        import paho.mqtt.client as mqtt
        client = mqtt.Client()
        client.connect("localhost", 1883, 60)
        topic = f"agx/{tenant_id}/profile_sync"
        client.publish(topic, json.dumps(profile_data), qos=1)
        client.disconnect()
        logger.info(f"[MQTT] Published upstream profile sync to {topic}")
    except ImportError:
        logger.warning("[MQTT] paho-mqtt not installed — upstream sync skipped. Run: pip install paho-mqtt")
    except Exception as e:
        logger.error(f"MQTT Connection Error: {e}")


from app.core.security import RequireRole

@router.get("/profile")
async def get_tenant_profile(db: Session = Depends(get_db)):
    # Just return the most recently updated tenant for now (single tenant mode fallback)
    tenant = db.query(Tenant).order_by(Tenant.updatedAt.desc()).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant

@router.put("/profile", dependencies=[Depends(RequireRole(["admin"]))])
async def update_tenant_profile(payload: Dict[Any, Any] = Body(...), db: Session = Depends(get_db)):
    tenant_id = payload.get("id")
    if not tenant_id:
        raise HTTPException(status_code=400, detail="Tenant ID required")
        
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
        
    for key in ["name", "host", "hostEmail", "companyDescription", "companyType", "companyLogo"]:
        if key in payload:
            setattr(tenant, key, payload[key])
            
    db.commit()
    db.refresh(tenant)
    
    publish_upstream_sync(tenant.id, {
        "name": tenant.name,
        "host": tenant.host,
        "hostEmail": tenant.hostEmail,
        "companyDescription": tenant.companyDescription,
        "companyType": tenant.companyType,
        "companyLogo": tenant.companyLogo,
    })
    
    # Generate local notification
    notification = Notification(
        tenant_id=tenant.id,
        type="success",
        message="Profile details updated successfully."
    )
    db.add(notification)
    db.commit()
    
    return tenant

@router.post("/tickets", dependencies=[Depends(RequireRole(["admin"]))])
async def create_tenant_ticket(payload: Dict[Any, Any] = Body(...), db: Session = Depends(get_db)):
    tenant_id = payload.get("tenantId")
    name = payload.get("name")
    email = payload.get("email")
    subject = payload.get("subject")
    description = payload.get("description")
    
    if not all([tenant_id, name, email, subject, description]):
        raise HTTPException(status_code=400, detail="Missing required fields for ticket")
        
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
        
    ticket = SupportTicket(
        tenantId=tenant.id,
        name=name,
        email=email,
        subject=subject,
        description=description,
        status="OPEN"
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    
    # Publish via MQTT to Super Admin
    try:
        import paho.mqtt.client as mqtt
        client = mqtt.Client()
        client.connect("localhost", 1883, 60)
        topic = f"tickets/created"
        ticket_data = {
            "id": ticket.id,
            "tenantId": ticket.tenantId,
            "name": ticket.name,
            "email": ticket.email,
            "subject": ticket.subject,
            "description": ticket.description,
            "status": ticket.status,
            "createdAt": ticket.createdAt.isoformat()
        }
        client.publish(topic, json.dumps(ticket_data), qos=1)
        client.disconnect()
        logger.info(f"[MQTT] Published new ticket {ticket.id} to {topic}")
    except Exception as e:
        logger.error(f"MQTT Connection Error while publishing ticket: {e}")
        
    # Generate local notification
    notification = Notification(
        tenant_id=tenant.id,
        type="info",
        message=f"Support ticket '{subject}' has been submitted."
    )
    db.add(notification)
    db.commit()
        
    return ticket

@router.get("/tickets", dependencies=[Depends(RequireRole(["admin"]))])
async def get_tenant_tickets(db: Session = Depends(get_db)):
    # In single tenant fallback, get the first tenant
    tenant = db.query(Tenant).order_by(Tenant.updatedAt.desc()).first()
    if not tenant:
        return []
    tickets = db.query(SupportTicket).filter(SupportTicket.tenantId == tenant.id).order_by(SupportTicket.createdAt.desc()).all()
    return tickets

@router.get("/features")
async def get_tenant_features(db: Session = Depends(get_db)):
    tenant = db.query(Tenant).order_by(Tenant.updatedAt.desc()).first()
    if not tenant:
        return {"features": {}}
    try:
        features = json.loads(tenant.features)
    except Exception:
        features = {}
    return features


sync_router = APIRouter()

# ── MQTT Downstream Sync Endpoints ───────────────────────────────────────────
# Called by the client-side mqtt-listener.ts when data arrives from Super Admin.
# These are the ONLY authorised writers to the client DB from the MQTT pipeline.

@sync_router.post("/sync", status_code=status.HTTP_200_OK)
async def sync_tenant_info(payload: Dict[str, Any] = Body(...), db: Session = Depends(get_db)):
    """Upsert tenant info received from Super Admin via MQTT."""
    tenant_id = payload.get("id")
    if not tenant_id:
        raise HTTPException(status_code=400, detail="Tenant ID required in payload")

    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if tenant:
        # Update existing
        for key in ["name", "host", "hostEmail", "companyDescription", "companyType", "companyLogo"]:
            if key in payload:
                setattr(tenant, key, payload[key])
        logger.info(f"[MQTT Sync] Updated tenant {tenant_id}")
    else:
        # Create new tenant synced from Super Admin
        tenant = Tenant(
            id=tenant_id,
            name=payload.get("name", "Synced Tenant"),
            host=payload.get("host"),
            hostEmail=payload.get("hostEmail"),
            companyDescription=payload.get("companyDescription"),
            companyType=payload.get("companyType"),
            companyLogo=payload.get("companyLogo"),
        )
        db.add(tenant)
        logger.info(f"[MQTT Sync] Created new tenant {tenant_id}")

    db.commit()
    db.refresh(tenant)
    return {"ok": True, "tenant_id": tenant_id}


@sync_router.post("/features/sync", status_code=status.HTTP_200_OK)
async def sync_tenant_features(payload: Dict[str, Any] = Body(...), db: Session = Depends(get_db)):
    """Update tenant features received from Super Admin via MQTT."""
    tenant_id = payload.get("tenantId")
    features = payload.get("features")
    if not tenant_id or features is None:
        raise HTTPException(status_code=400, detail="tenantId and features required")

    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail=f"Tenant {tenant_id} not found locally. Sync tenant info first.")

    tenant.features = json.dumps(features)
    
    # Generate local notification
    notification = Notification(
        tenant_id=tenant_id,
        type="info",
        message="Super Admin has updated your platform features."
    )
    db.add(notification)
    
    db.commit()
    logger.info(f"[MQTT Sync] Updated features for tenant {tenant_id}")
    return {"ok": True, "tenant_id": tenant_id}


@sync_router.post("/mcp/sync", status_code=status.HTTP_200_OK)
async def sync_tenant_mcp(payload: Dict[str, Any] = Body(...), db: Session = Depends(get_db)):
    """Update MCP unlock status received from Super Admin via MQTT."""
    tenant_id = payload.get("tenantId")
    mcp_id = payload.get("mcpId")
    is_unlocked = payload.get("isUnlocked", False)
    if not tenant_id or not mcp_id:
        raise HTTPException(status_code=400, detail="tenantId and mcpId required")

    config = db.query(TenantMcpConfig).filter(
        TenantMcpConfig.tenantId == tenant_id,
        TenantMcpConfig.mcpId == mcp_id,
    ).first()

    if config:
        config.isUnlocked = is_unlocked
        logger.info(f"[MQTT Sync] Updated MCP {mcp_id} for tenant {tenant_id} → isUnlocked={is_unlocked}")
    else:
        config = TenantMcpConfig(tenantId=tenant_id, mcpId=mcp_id, isUnlocked=is_unlocked)
        db.add(config)
        logger.info(f"[MQTT Sync] Created MCP config {mcp_id} for tenant {tenant_id}")

    db.commit()
    return {"ok": True, "tenant_id": tenant_id, "mcp_id": mcp_id}


@sync_router.post("/users/sync", status_code=status.HTTP_200_OK)
async def sync_user(payload: Dict[str, Any] = Body(...), db: Session = Depends(get_db)):
    """Upsert a user received from Super Admin via MQTT (downstream provisioning)."""
    email = payload.get("email")
    tenant_id = payload.get("tenantId")
    name = payload.get("name") or payload.get("username")
    username = (name or "").strip() or (email.split("@")[0] if email else None)
    password = payload.get("password", "")
    role = payload.get("role", "user").lower()
    if role == "client":
        role = "admin"
    requires_pw_change = payload.get("requiresPasswordChange", False)

    if not email or not password:
        raise HTTPException(status_code=400, detail="email and password required")

    # Super Admin hashes with bcrypt — detect and store as-is
    is_bcrypt = password.startswith("$2b$") or password.startswith("$2a$")

    user = db.query(User).filter(User.email == email).first()
    if user:
        user.role = role
        user.tenant_id = tenant_id
        user.requires_password_change = 1 if requires_pw_change else 0
        if is_bcrypt:
            user.set_bcrypt_password(password)
        else:
            user.set_password(password)  # plaintext fallback
        logger.info(f"[MQTT Sync] Updated user {email} (bcrypt={is_bcrypt})")
    else:
        user = User(username=username, email=email, role=role, tenant_id=tenant_id, requires_password_change=1 if requires_pw_change else 0)
        if is_bcrypt:
            user.set_bcrypt_password(password)
        else:
            user.set_password(password)
        db.add(user)
        logger.info(f"[MQTT Sync] Created new user {email} (bcrypt={is_bcrypt})")

    db.commit()
    db.refresh(user)
    return {"ok": True, "email": email, "role": role}

@sync_router.post("/tickets/sync", status_code=status.HTTP_200_OK)
async def sync_ticket_status(payload: Dict[str, Any] = Body(...), db: Session = Depends(get_db)):
    """Sync ticket status update received from Super Admin via MQTT."""
    ticket_id = payload.get("id")
    status_val = payload.get("status")
    
    if not ticket_id or not status_val:
        raise HTTPException(status_code=400, detail="id and status required")
        
    ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
    if not ticket:
        logger.warning(f"[MQTT Sync] Ticket {ticket_id} not found locally.")
        return {"ok": False, "error": "not found"}
        
    ticket.status = status_val
    
    # Generate local notification
    notification = Notification(
        tenant_id=ticket.tenantId,
        type="info",
        message=f"Super Admin updated your ticket '{ticket.subject}' status to {status_val}."
    )
    db.add(notification)
    
    db.commit()
    logger.info(f"[MQTT Sync] Updated ticket {ticket_id} status to {status_val}")
    return {"ok": True, "id": ticket_id, "status": status_val}


@sync_router.post("/sync-delete", status_code=status.HTTP_200_OK)
async def sync_delete_tenant(payload: Dict[str, Any] = Body(...), db: Session = Depends(get_db)):
    """Delete a tenant and all its associated users from local DB."""
    tenant_id = payload.get("id")
    if not tenant_id:
        raise HTTPException(status_code=400, detail="Tenant ID required in payload")

    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if tenant:
        db.delete(tenant)
        logger.info(f"[MQTT Sync] Deleted tenant {tenant_id}")
        
    users = db.query(User).filter(User.tenant_id == tenant_id).all()
    for user in users:
        db.delete(user)
    
    if users:
        logger.info(f"[MQTT Sync] Deleted {len(users)} users for tenant {tenant_id}")

    db.commit()
    return {"ok": True, "tenant_id": tenant_id}
