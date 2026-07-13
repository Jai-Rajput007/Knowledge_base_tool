import time
import jwt
import json
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import Request
from sqlalchemy.orm import Session
from datetime import datetime
import uuid

from app.db.database import SessionLocal
from app.core.config import settings
from app.models.audit_log import AuditLog
from app.core.logging import logger

class AuditLogMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Only log mutating requests
        if request.method not in ["POST", "PUT", "DELETE", "PATCH"]:
            return await call_next(request)
            
        # Extract user from token
        user_id = "System/Anonymous"
        tenant_id = None
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            try:
                payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
                user_id = payload.get("sub", user_id)
                tenant_id = payload.get("tenant_id", None)
            except Exception:
                pass

        # Process the request
        start_time = time.time()
        response = None
        status_code = 500
        try:
            response = await call_next(request)
            status_code = response.status_code
        except Exception as e:
            status_code = 500
            raise e
        finally:
            process_time = time.time() - start_time
            
            # Map path to an action name
            action = f"{request.method} {request.url.path}"
            
            # Record audit log in background to avoid blocking response
            # Since we are in ASGI middleware, we instantiate a short-lived DB session
            try:
                db: Session = SessionLocal()
                
                # Fetch tenant_id from user if not in token payload
                if not tenant_id and user_id != "System/Anonymous":
                    from app.models.user import User
                    user = db.query(User).filter(User.id == user_id).first()
                    if user:
                        tenant_id = user.tenant_id

                audit = AuditLog(
                    id=str(uuid.uuid4()),
                    tenant_id=tenant_id,
                    action=action,
                    endpoint=request.url.path,
                    method=request.method,
                    status_code=str(status_code),
                    details={
                        "query_params": dict(request.query_params),
                        "process_time_ms": round(process_time * 1000, 2)
                    },
                    user_id=user_id,
                    created_at=datetime.utcnow()
                )
                db.add(audit)
                db.commit()
                db.close()
            except Exception as e:
                logger.error(f"Failed to write audit log: {e}")

        return response
