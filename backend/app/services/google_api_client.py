"""
Direct Google API Client.

Bypasses the google_workspace_mcp server entirely. Uses the raw Google
OAuth access token (ya29.*) stored in TenantMcpConfig to call Google REST
APIs directly. This avoids the OAuth 2.1 session-token mismatch that caused
every MCP request to return 401 invalid_token.
"""

import httpx
from datetime import datetime, timezone
from typing import Optional
from app.core.logging import logger


class GoogleApiClient:
    """Calls Google Calendar, Docs, and Drive APIs directly with a Google access token."""

    CALENDAR_BASE = "https://www.googleapis.com/calendar/v3"
    DOCS_BASE     = "https://docs.googleapis.com/v1"
    DRIVE_BASE    = "https://www.googleapis.com/drive/v3"
    GMAIL_BASE    = "https://gmail.googleapis.com/gmail/v1"

    def __init__(self, access_token: str):
        self.access_token = access_token
        self.headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }

    # ── Google Docs ────────────────────────────────────────────────────────────

    async def create_document(self, title: str, content: str = "") -> str:
        """Creates a Google Doc and optionally writes content to it."""
        async with httpx.AsyncClient(timeout=20.0) as client:
            # 1. Create the document
            create_resp = await client.post(
                f"{self.DOCS_BASE}/documents",
                headers=self.headers,
                json={"title": title},
            )
            if create_resp.status_code not in (200, 201):
                return f"Error creating document: {create_resp.status_code} — {create_resp.text}"

            doc = create_resp.json()
            doc_id  = doc["documentId"]
            doc_url = f"https://docs.google.com/document/d/{doc_id}/edit"

            # 2. Write initial content if provided
            if content:
                batch_resp = await client.post(
                    f"{self.DOCS_BASE}/documents/{doc_id}:batchUpdate",
                    headers=self.headers,
                    json={
                        "requests": [
                            {
                                "insertText": {
                                    "location": {"index": 1},
                                    "text": content,
                                }
                            }
                        ]
                    },
                )
                if batch_resp.status_code not in (200, 201):
                    logger.warning(f"[GoogleAPI] Content write failed: {batch_resp.text}")

            logger.info(f"[GoogleAPI] Created document '{title}' → {doc_url}")
            return f"✅ Document '{title}' created successfully!\nURL: {doc_url}"

    # ── Google Calendar ────────────────────────────────────────────────────────

    async def create_calendar_event(
        self,
        title: str,
        date: str,          # YYYY-MM-DD
        start_time: str,    # HH:MM  (24h), e.g. "20:00"
        end_time: str = "", # HH:MM  — defaults to 1 h after start
        description: str = "",
        calendar_id: str = "primary",
    ) -> str:
        """Creates a Google Calendar event."""
        # Build ISO-8601 datetime strings in IST (UTC+5:30)
        tz = "Asia/Kolkata"
        if not end_time:
            # Default: 1 hour after start
            sh, sm = map(int, start_time.split(":"))
            end_h  = sh + 1
            end_time = f"{end_h:02d}:{sm:02d}"

        start_dt = f"{date}T{start_time}:00"
        end_dt   = f"{date}T{end_time}:00"

        event_body = {
            "summary": title,
            "description": description,
            "start": {"dateTime": start_dt, "timeZone": tz},
            "end":   {"dateTime": end_dt,   "timeZone": tz},
            "reminders": {
                "useDefault": False,
                "overrides": [
                    {"method": "popup",  "minutes": 30},
                    {"method": "email",  "minutes": 60},
                ],
            },
        }

        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                f"{self.CALENDAR_BASE}/calendars/{calendar_id}/events",
                headers=self.headers,
                json=event_body,
            )

        if resp.status_code not in (200, 201):
            return f"Error creating event: {resp.status_code} — {resp.text}"

        event     = resp.json()
        event_url = event.get("htmlLink", "")
        logger.info(f"[GoogleAPI] Created event '{title}' on {date} at {start_time} → {event_url}")
        return (
            f"✅ Calendar event '{title}' created for {date} at {start_time} (IST)!\n"
            f"URL: {event_url}"
        )

    async def list_calendar_events(self, max_results: int = 10) -> str:
        """Lists upcoming calendar events."""
        now = datetime.now(timezone.utc).isoformat()
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.get(
                f"{self.CALENDAR_BASE}/calendars/primary/events",
                headers=self.headers,
                params={
                    "timeMin": now,
                    "maxResults": max_results,
                    "singleEvents": "true",
                    "orderBy": "startTime",
                },
            )
        if resp.status_code != 200:
            return f"Error listing events: {resp.status_code} — {resp.text}"

        events = resp.json().get("items", [])
        if not events:
            return "No upcoming events found."

        lines = []
        for e in events:
            start = e.get("start", {}).get("dateTime") or e.get("start", {}).get("date", "")
            lines.append(f"• {e.get('summary', 'Untitled')} — {start}")
        return "Upcoming events:\n" + "\n".join(lines)

    # ── Gmail ──────────────────────────────────────────────────────────────────

    async def send_email(self, to: str, subject: str, body: str) -> str:
        """Sends an email via Gmail."""
        import base64
        from email.mime.text import MIMEText
        msg = MIMEText(body)
        msg["to"]      = to
        msg["subject"] = subject
        raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()

        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                f"{self.GMAIL_BASE}/users/me/messages/send",
                headers=self.headers,
                json={"raw": raw},
            )
        if resp.status_code not in (200, 201):
            return f"Error sending email: {resp.status_code} — {resp.text}"

        logger.info(f"[GoogleAPI] Email sent to {to}: {subject}")
        return f"✅ Email sent to {to} with subject '{subject}'."

    # ── Google Drive ───────────────────────────────────────────────────────────

    async def list_drive_files(self, query: str = "", max_results: int = 10) -> str:
        """Lists files in Google Drive."""
        params = {"pageSize": max_results, "fields": "files(id,name,mimeType,webViewLink)"}
        if query:
            params["q"] = query
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.get(
                f"{self.DRIVE_BASE}/files",
                headers=self.headers,
                params=params,
            )
        if resp.status_code != 200:
            return f"Error listing files: {resp.status_code} — {resp.text}"

        files = resp.json().get("files", [])
        if not files:
            return "No files found."

        lines = [f"• {f['name']} ({f['mimeType'].split('.')[-1]}) — {f.get('webViewLink', '')}" for f in files]
        return "Files in Drive:\n" + "\n".join(lines)


# ── Tool definitions Ollama understands ───────────────────────────────────────

GOOGLE_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "create_google_doc",
            "description": "Creates a new Google Doc with a given title and optional content.",
            "parameters": {
                "type": "object",
                "properties": {
                    "title":   {"type": "string", "description": "The title of the document."},
                    "content": {"type": "string", "description": "Optional initial text content to write into the document."},
                },
                "required": ["title"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_calendar_event",
            "description": "Creates a Google Calendar event on a specific date and time.",
            "parameters": {
                "type": "object",
                "properties": {
                    "title":       {"type": "string", "description": "Event title / summary."},
                    "date":        {"type": "string", "description": "Date in YYYY-MM-DD format, e.g. 2026-07-05."},
                    "start_time":  {"type": "string", "description": "Start time in HH:MM 24-hour format, e.g. 20:00."},
                    "end_time":    {"type": "string", "description": "End time in HH:MM 24-hour format. Optional — defaults to 1 hour after start."},
                    "description": {"type": "string", "description": "Optional description or notes for the event."},
                },
                "required": ["title", "date", "start_time"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_calendar_events",
            "description": "Lists upcoming events from Google Calendar.",
            "parameters": {
                "type": "object",
                "properties": {
                    "max_results": {"type": "integer", "description": "Maximum number of events to return. Default 10."},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "send_email",
            "description": "Sends an email via Gmail.",
            "parameters": {
                "type": "object",
                "properties": {
                    "to":      {"type": "string", "description": "Recipient email address."},
                    "subject": {"type": "string", "description": "Email subject."},
                    "body":    {"type": "string", "description": "Email body text."},
                },
                "required": ["to", "subject", "body"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_drive_files",
            "description": "Lists files in the user's Google Drive. Can filter with a search query.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query":       {"type": "string", "description": "Optional Google Drive search query, e.g. \"name contains 'report'\"."},
                    "max_results": {"type": "integer", "description": "Maximum number of files to list. Default 10."},
                },
                "required": [],
            },
        },
    },
]


async def execute_google_tool(
    tool_name: str,
    arguments: dict,
    access_token: str,
) -> str:
    """Dispatcher: maps Ollama tool call names to GoogleApiClient methods."""
    client = GoogleApiClient(access_token)
    try:
        if tool_name == "create_google_doc":
            return await client.create_document(
                title=arguments.get("title", "Untitled"),
                content=arguments.get("content", ""),
            )
        elif tool_name == "create_calendar_event":
            return await client.create_calendar_event(
                title=arguments.get("title", "Event"),
                date=arguments.get("date", ""),
                start_time=arguments.get("start_time", "09:00"),
                end_time=arguments.get("end_time", ""),
                description=arguments.get("description", ""),
            )
        elif tool_name == "list_calendar_events":
            return await client.list_calendar_events(
                max_results=arguments.get("max_results", 10)
            )
        elif tool_name == "send_email":
            return await client.send_email(
                to=arguments.get("to", ""),
                subject=arguments.get("subject", ""),
                body=arguments.get("body", ""),
            )
        elif tool_name == "list_drive_files":
            return await client.list_drive_files(
                query=arguments.get("query", ""),
                max_results=arguments.get("max_results", 10),
            )
        else:
            return f"Unknown tool: {tool_name}"
    except Exception as e:
        logger.error(f"[GoogleAPI] Tool '{tool_name}' failed: {e}")
        return f"Error executing {tool_name}: {str(e)}"
