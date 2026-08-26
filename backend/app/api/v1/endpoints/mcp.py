import os
from typing import Any, Dict, List
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from composio import Composio

from app.db.database import get_db
from app.models.tenant import Tenant, McpIntegration, TenantMcpConfig
from app.core.config import settings

router = APIRouter()

from app.core.security import RequireRole, RequireServiceKey
from app.services.tools.registry import ToolRegistryService
from app.models.tenant import TenantMcpConfig, McpIntegration
from app.models.user import User
from pydantic import BaseModel

class ToolCallRequest(BaseModel):
    name: str
    arguments: dict

def _get_robot_creds_map(db: Session, tenant_id: str):
    creds_map = {}
    try:
        if not tenant_id:
            return creds_map

        configs = db.query(TenantMcpConfig).join(McpIntegration).filter(
            TenantMcpConfig.isEnabled == True,
            TenantMcpConfig.tenantId == tenant_id
        ).all()

        for config in configs:
            provider = config.mcp_integration.provider if hasattr(config, 'mcp_integration') else None
            if not provider:
                integration = db.query(McpIntegration).filter(McpIntegration.id == config.mcpId).first()
                provider = integration.provider if integration else None

            if provider == "taylorwilsdon/google_workspace_mcp":
                creds_map[provider] = config.credentials
            elif provider == "composio":
                import os, json
                api_key = os.environ.get("COMPOSIO_API_KEY", "ak_HlT2qEnTnTXF1OGcHMEG")
                # Full list of Composio toolkit slugs enabled for this tenant.
                # These map 1-to-1 with Composio's official slugs — do NOT use display names.
                # Google Workspace apps (replacing the hand-rolled gcp_modules/):
                # + Additional business/productivity/social apps.
                composio_apps = [
                    # Google Workspace
                    "gmail",
                    "googlecalendar",
                    "googledrive",
                    "googlesheets",
                    "googledocs",
                    "googleslides",
                    "googletasks",
                    "googlechat",
                    "googleclassroom",
                    "googleforms",
                    "googlemaps",
                    # Communication & Collaboration
                    "slack",
                    "microsoftteams",
                    "zoom",
                    "whatsapp",
                    # Email & Calendar
                    "outlook",
                    # Project Management
                    "jira",
                    # Social & Content
                    "twitter",
                    "linkedin",
                    "instagram",
                    "pinterest",
                    "spotify",
                    # Travel
                    "tripadvisorcontent",   # Tripadvisor Content API (not the management app)
                    # Context
                    "context7",
                ]
                creds_map["composio"] = json.dumps({
                    "api_key": api_key,
                    "user_id": config.composioUserId,
                    "apps": composio_apps
                })

        enabled_public = (
            db.query(McpIntegration)
            .join(TenantMcpConfig, TenantMcpConfig.mcpId == McpIntegration.id)
            .filter(McpIntegration.provider == "public", TenantMcpConfig.isEnabled == True, TenantMcpConfig.tenantId == tenant_id)
            .all()
        )
        if enabled_public:
            import json
            enabled_names = [i.name for i in enabled_public]
            creds_map["public"] = json.dumps({"enabled": enabled_names})

    except Exception as e:
        print(f"Error fetching robot creds: {e}")

    return creds_map

@router.get("/tools")
async def get_tools(query: str = None, db: Session = Depends(get_db), _service = Depends(RequireServiceKey)):
    try:
        tenant = db.query(Tenant).first()
        creds_map = _get_robot_creds_map(db, tenant.id if tenant else None)
        registry = ToolRegistryService()
        registry.load_adapters(creds_map)
        tools = await registry.get_all_tools(query=query)
        return {"tools": tools}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Cache logos in-memory so we don't re-hit Composio API on every frontend load.
# Key: slug, Value: logo URL string. Populated lazily on first /logos call.
_logos_cache: dict = {}

@router.get("/logos")
async def get_toolkit_logos(current_user = Depends(RequireRole(["admin"]))):
    """
    Fetches the official logo URL for each Composio toolkit using
    GET /api/v3.1/toolkits/{slug} (as documented in Composio's Toolkit API reference).
    Returns a flat map: { slug: logo_url }.
    Results are cached in-memory for the lifetime of the process.
    """
    global _logos_cache
    if _logos_cache:
        return {"logos": _logos_cache}

    import os
    api_key = os.environ.get("COMPOSIO_API_KEY", "ak_HlT2qEnTnTXF1OGcHMEG")

    # Full list of Composio slugs we support (mirrors mcp.py composio_apps list)
    composio_apps = [
        "gmail", "googlecalendar", "googledrive", "googlesheets",
        "googledocs", "googleslides", "googletasks", "googlechat",
        "googleclassroom", "googleforms", "googlemaps",
        "slack", "microsoftteams", "zoom", "whatsapp", "outlook",
        "jira", "twitter", "linkedin", "instagram", "pinterest", "spotify",
        "tripadvisorcontent", "context7",
    ]

    try:
        client = Composio(api_key=api_key)
        logos = {}
        for slug in composio_apps:
            try:
                meta = client.toolkits.get(slug)
                # SDK may return an object or dict depending on version
                if hasattr(meta, "logo"):
                    logo = meta.logo
                elif isinstance(meta, dict):
                    logo = meta.get("logo")
                else:
                    logo = None

                if logo:
                    logos[slug] = logo
                    print(f"[Logos] {slug} → {logo}")
                else:
                    print(f"[Logos] {slug} → no logo in response")
            except Exception as e:
                print(f"[Logos] Failed to fetch logo for '{slug}': {e}")

        _logos_cache = logos
        return {"logos": logos}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch toolkit logos: {str(e)}")

@router.post("/call")
async def call_tool(req: ToolCallRequest, db: Session = Depends(get_db), _service = Depends(RequireServiceKey)):
    try:
        tenant = db.query(Tenant).first()
        creds_map = _get_robot_creds_map(db, tenant.id if tenant else None)
        registry = ToolRegistryService()
        registry.load_adapters(creds_map)
        # Must call get_all_tools to populate _tool_map so execute_tool knows the adapter
        await registry.get_all_tools(query=req.name)

        result = await registry.execute_tool(req.name, req.arguments)
        return {"content": [{"type": "text", "text": str(result)}]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/")
def get_integrations(db: Session = Depends(get_db), current_user = Depends(RequireRole(["admin"]))):
    try:
        # 1. Get all available integrations
        integrations = db.query(McpIntegration).order_by(McpIntegration.category.asc()).all()

        # 2. Get the first tenant (acting as the current logged-in tenant)
        tenant = db.query(Tenant).first()
        if not tenant:
            tenant = Tenant(name="Default Tenant")
            db.add(tenant)
            db.commit()
            db.refresh(tenant)

        # 3. Get all configs for this tenant
        tenant_configs = db.query(TenantMcpConfig).filter(TenantMcpConfig.tenantId == tenant.id).all()
        config_map = {c.mcpId: c for c in tenant_configs}

        # 4. Merge them together for the frontend
        payload = []
        for integration in integrations:
            config = config_map.get(integration.id)
            
            is_configured = False
            if config and config.credentials:
                import json
                try:
                    creds = json.loads(config.credentials)
                    is_configured = bool(creds)
                except Exception:
                    is_configured = bool(config.credentials.strip())

            payload.append({
                "id": integration.id,
                "name": integration.name,
                "description": integration.description,
                "category": integration.category,
                "provider": integration.provider,
                "providerConfig": integration.providerConfig,
                "tier": integration.tier,
                "isUnlocked": True if integration.tier == "BASIC" else (config.isUnlocked if config else False),
                "isEnabled": config.isEnabled if config else False,
                "configId": config.id if config else None,
                "isConfigured": is_configured,
            })

        return payload
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to fetch MCP integrations")

@router.post("/configure")
async def configure_integration(request: Request, db: Session = Depends(get_db), current_user = Depends(RequireRole(["admin"]))):
    try:
        body = await request.json()
        mcp_id = body.get("mcpId")
        is_enabled = body.get("isEnabled", False)
        credentials = body.get("credentials")

        tenant = db.query(Tenant).first()
        if not tenant:
            raise HTTPException(status_code=400, detail="No tenant found")

        integration = db.query(McpIntegration).filter(McpIntegration.id == mcp_id).first()
        if not integration:
            raise HTTPException(status_code=404, detail="Integration not found")

        import json
        config = db.query(TenantMcpConfig).filter(
            TenantMcpConfig.tenantId == tenant.id,
            TenantMcpConfig.mcpId == mcp_id
        ).first()

        creds_str = json.dumps(credentials) if credentials else "{}"

        if config:
            config.isEnabled = is_enabled
            if credentials:
                config.credentials = creds_str
        else:
            config = TenantMcpConfig(
                tenantId=tenant.id,
                mcpId=mcp_id,
                isUnlocked=(integration.tier == "BASIC"),
                isEnabled=is_enabled,
                credentials=creds_str
            )
            db.add(config)
        
        db.commit()
        db.refresh(config)

        return {"success": True, "config": {"id": config.id, "isEnabled": config.isEnabled}}
    except HTTPException as e:
        raise e
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to update config")

@router.post("/composio-link")
async def composio_link(request: Request, db: Session = Depends(get_db), current_user = Depends(RequireRole(["admin"]))):
    """
    Generates a Composio OAuth redirect URL for a given integration.
    The user is sent to this URL to connect their account (e.g. Gmail, Slack).
    Uses client.toolkits.authorize(user_id, slug=app_slug) — the correct API
    for generating an OAuth link from a toolkit slug without needing a pre-created
    auth config UUID.
    """
    try:
        body = await request.json()
        mcp_id = body.get("mcpId")

        tenant = db.query(Tenant).first()
        if not tenant:
            raise HTTPException(status_code=400, detail="No tenant found")

        integration = db.query(McpIntegration).filter(McpIntegration.id == mcp_id).first()
        if not integration or integration.provider != "composio":
            raise HTTPException(status_code=400, detail="Invalid integration")

        # Get the app slug from providerConfig (e.g. {"app": "slack"} → "slack")
        import json, os
        app_slug = None
        try:
            if integration.providerConfig:
                config_json = json.loads(integration.providerConfig)
                app_slug = config_json.get("app")
        except Exception:
            pass

        if not app_slug:
            raise HTTPException(status_code=400, detail="Integration has no app slug configured")

        # Use a consistent user_id per tenant — all users on this tenant share one Composio entity
        user_id = f"tenant_{tenant.id}"
        api_key = os.environ.get("COMPOSIO_API_KEY", "ak_HlT2qEnTnTXF1OGcHMEG")

        print(f"[ComposioLink] Generating OAuth link: slug={app_slug!r} user_id={user_id!r}")

        # toolkits.authorize() is the correct SDK method — it internally creates/reuses
        # a Composio-managed auth config and returns the OAuth redirect URL.
        # Do NOT use connected_accounts.link() — that requires a pre-created auth config UUID.
        client = Composio(api_key=api_key)
        connection_request = client.toolkits.authorize(user_id=user_id, toolkit=app_slug)
        redirect_url = connection_request.redirect_url

        print(f"[ComposioLink] Got redirect URL for {app_slug}: {redirect_url!r}")

        # Mark as enabled in DB and store the composio user_id for later tool calls
        config = db.query(TenantMcpConfig).filter(
            TenantMcpConfig.tenantId == tenant.id,
            TenantMcpConfig.mcpId == mcp_id
        ).first()

        if config:
            config.isEnabled = True
            config.composioUserId = user_id
        else:
            config = TenantMcpConfig(
                tenantId=tenant.id,
                mcpId=mcp_id,
                isUnlocked=True,
                isEnabled=True,
                credentials="{}",
                composioUserId=user_id
            )
            db.add(config)

        db.commit()
        return {"redirectUrl": redirect_url}

    except HTTPException as e:
        raise e
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

from fastapi.responses import RedirectResponse, HTMLResponse
import urllib.parse
import httpx

CLIENT_ID = '687399754252-2nt7j6i3qljcoje1a61kjlqu0mpgnlrt.apps.googleusercontent.com'
CLIENT_SECRET = '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'
# Notice we are now redirecting back to FastAPI
REDIRECT_URI = os.getenv("GOOGLE_AUTH_REDIRECT_URI", 'http://localhost:8000/api/v1/mcp/google/callback')
SCOPES = ' '.join([
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/documents'
])

@router.get("/google/login")
async def google_login():
    import random
    import string
    state = ''.join(random.choices(string.ascii_letters + string.digits, k=16))
    
    params = {
        'client_id': CLIENT_ID,
        'redirect_uri': REDIRECT_URI,
        'response_type': 'code',
        'scope': SCOPES,
        'access_type': 'offline',
        'prompt': 'consent',
        'state': state
    }
    
    auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{urllib.parse.urlencode(params)}"
    return RedirectResponse(auth_url)

@router.get("/google/callback", response_class=HTMLResponse)
async def google_callback(request: Request, db: Session = Depends(get_db)):
    code = request.query_params.get("code")
    error = request.query_params.get("error")
    
    if error:
        raise HTTPException(status_code=400, detail=f"Error from Google: {error}")
    if not code:
        raise HTTPException(status_code=400, detail="No code provided")
        
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post('https://oauth2.googleapis.com/token', data={
                'code': code,
                'client_id': CLIENT_ID,
                'client_secret': CLIENT_SECRET,
                'redirect_uri': REDIRECT_URI,
                'grant_type': 'authorization_code',
            })
            
            if response.status_code != 200:
                raise HTTPException(status_code=400, detail=f"Token exchange failed: {response.text}")
                
            tokens = response.json()
            
        integration = db.query(McpIntegration).filter(McpIntegration.provider == 'taylorwilsdon/google_workspace_mcp').first()
        if not integration:
            raise HTTPException(status_code=500, detail="Google Workspace MCP integration not found in database")
            
        tenant = db.query(Tenant).first()
        if not tenant:
            tenant = Tenant(name='Default Tenant')
            db.add(tenant)
            db.commit()
            db.refresh(tenant)
            
        import json
        credentials = json.dumps({
            'access_token': tokens.get('access_token'),
            'refresh_token': tokens.get('refresh_token'),
            'expires_in': tokens.get('expires_in'),
            'token_type': tokens.get('token_type')
        })
        
        config = db.query(TenantMcpConfig).filter(
            TenantMcpConfig.tenantId == tenant.id,
            TenantMcpConfig.mcpId == integration.id
        ).first()
        
        if config:
            config.credentials = credentials
            config.isEnabled = True
            config.isUnlocked = True
        else:
            config = TenantMcpConfig(
                tenantId=tenant.id,
                mcpId=integration.id,
                credentials=credentials,
                isEnabled=True,
                isUnlocked=True
            )
            db.add(config)
            
        db.commit()
        
        html = """
        <!DOCTYPE html>
        <html>
          <head>
            <title>Google Workspace Connected</title>
            <style>
              body { font-family: system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #f8fafc; }
              .card { background: white; padding: 3rem 2rem; border-radius: 12px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); text-align: center; }
              h1 { color: #16a34a; margin-bottom: 0.5rem; }
              p { color: #64748b; margin-bottom: 2rem; }
              button { background: #0f172a; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 6px; cursor: pointer; }
              button:hover { background: #1e293b; }
            </style>
          </head>
          <body>
            <div class="card">
              <h1>Connection Successful</h1>
              <p>Your OAuth token has been saved to the database.</p>
              <button onclick="window.close()">Close Window</button>
            </div>
            <script>
              if (window.opener) {
                window.opener.postMessage('google_auth_success', '*');
              }
            </script>
          </body>
        </html>
        """
        return HTMLResponse(content=html)
    except HTTPException as e:
        raise e
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
