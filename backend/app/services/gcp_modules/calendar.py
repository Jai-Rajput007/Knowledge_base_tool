import asyncio
import datetime
import re
import uuid
import json
import logging
from typing import Dict, Any, Optional, List, Union

import pytz
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

logger = logging.getLogger(__name__)

TOOLS = [
    {
        "name": "list_calendars",
        "description": "List all calendars accessible to the authenticated user. Returns summary, ID, and primary status.",
        "parameters": {
            "type": "object",
            "properties": {
                "user_google_email": {"type": "string"}
            },
            "required": ["user_google_email"]
        }
    },
    {
        "name": "get_events",
        "description": "Retrieve events from a calendar. Fetch a single event by ID, list events in a time range, or search by keyword.",
        "parameters": {
            "type": "object",
            "properties": {
                "user_google_email": {"type": "string"},
                "calendar_id": {"type": "string", "default": "primary"},
                "event_id": {"type": "string"},
                "time_min": {"type": "string"},
                "time_max": {"type": "string"},
                "max_results": {"type": "integer", "default": 25},
                "query": {"type": "string"},
                "detailed": {"type": "boolean", "default": False},
                "include_attachments": {"type": "boolean", "default": False}
            },
            "required": ["user_google_email"]
        }
    },
    {
        "name": "manage_event",
        "description": "Create, update, or delete a calendar event.",
        "parameters": {
            "type": "object",
            "properties": {
                "user_google_email": {"type": "string"},
                "action": {"type": "string", "enum": ["create", "update", "delete"]},
                "summary": {"type": "string"},
                "start_time": {"type": "string"},
                "end_time": {"type": "string"},
                "event_id": {"type": "string"},
                "calendar_id": {"type": "string", "default": "primary"},
                "description": {"type": "string"},
                "location": {"type": "string"},
                "attendees": {"type": "array", "items": {}},
                "timezone": {"type": "string"},
                "attachments": {"type": "array", "items": {"type": "string"}},
                "add_google_meet": {"type": "boolean"},
                "reminders": {"type": "array", "items": {"type": "object"}},
                "use_default_reminders": {"type": "boolean"},
                "transparency": {"type": "string", "enum": ["opaque", "transparent"]},
                "visibility": {"type": "string", "enum": ["default", "public", "private", "confidential"]},
                "color_id": {"type": "string"},
                "guests_can_modify": {"type": "boolean"},
                "guests_can_invite_others": {"type": "boolean"},
                "guests_can_see_other_guests": {"type": "boolean"}
            },
            "required": ["user_google_email", "action"]
        }
    },
    {
        "name": "query_freebusy",
        "description": "Check free/busy status for one or more calendars over a time interval.",
        "parameters": {
            "type": "object",
            "properties": {
                "user_google_email": {"type": "string"},
                "time_min": {"type": "string"},
                "time_max": {"type": "string"},
                "calendar_ids": {"type": "array", "items": {"type": "string"}},
                "group_expansion_max": {"type": "integer"},
                "calendar_expansion_max": {"type": "integer"}
            },
            "required": ["user_google_email", "time_min", "time_max"]
        }
    }
]

def _get_meeting_link(item: Dict[str, Any]) -> str:
    conference_data = item.get("conferenceData")
    if conference_data and "entryPoints" in conference_data:
        for entry_point in conference_data["entryPoints"]:
            if entry_point.get("entryPointType") == "video":
                uri = entry_point.get("uri", "")
                if uri:
                    return uri
    hangout_link = item.get("hangoutLink", "")
    if hangout_link:
        return hangout_link
    return ""

def _format_attendee_details(attendees: List[Dict[str, Any]], indent: str = "  ") -> str:
    if not attendees:
        return "None"
    attendee_details_list = []
    for a in attendees:
        email = a.get("email", "unknown")
        response_status = a.get("responseStatus", "unknown")
        optional = a.get("optional", False)
        organizer = a.get("organizer", False)
        detail_parts = [f"{email}: {response_status}"]
        if organizer:
            detail_parts.append("(organizer)")
        if optional:
            detail_parts.append("(optional)")
        attendee_details_list.append(" ".join(detail_parts))
    return f"\n{indent}".join(attendee_details_list)

def _format_attachment_details(attachments: List[Dict[str, Any]], indent: str = "  ") -> str:
    if not attachments:
        return "None"
    attachment_details_list = []
    for att in attachments:
        title = att.get("title", "Untitled")
        file_url = att.get("fileUrl", "No URL")
        file_id = att.get("fileId", "No ID")
        mime_type = att.get("mimeType", "Unknown")
        attachment_info = (f"{title}\n{indent}File URL: {file_url}\n{indent}File ID: {file_id}\n{indent}MIME Type: {mime_type}")
        attachment_details_list.append(attachment_info)
    return f"\n{indent}".join(attachment_details_list)

def _format_person(person: Optional[Dict[str, Any]]) -> Optional[str]:
    if not person:
        return None
    name = (person.get("displayName") or "").strip()
    email = (person.get("email") or "").strip()
    if name and email:
        return f"{name} <{email}>"
    if name:
        return name
    if email:
        return f"<{email}>"
    return None

def _parse_reminders_json(reminders_input: Optional[Union[str, List[Dict[str, Any]]]], function_name: str) -> List[Dict[str, Any]]:
    if not reminders_input:
        return []
    if isinstance(reminders_input, str):
        try:
            reminders = json.loads(reminders_input)
            if not isinstance(reminders, list):
                return []
        except json.JSONDecodeError:
            return []
    elif isinstance(reminders_input, list):
        reminders = reminders_input
    else:
        return []

    if len(reminders) > 5:
        reminders = reminders[:5]

    validated_reminders = []
    for reminder in reminders:
        if not isinstance(reminder, dict) or "method" not in reminder or "minutes" not in reminder:
            continue
        method = reminder["method"].lower()
        if method not in ["popup", "email"]:
            continue
        minutes = reminder["minutes"]
        if not isinstance(minutes, int) or minutes < 0 or minutes > 40320:
            continue
        validated_reminders.append({"method": method, "minutes": minutes})
    return validated_reminders

def _apply_transparency_if_valid(event_body: Dict[str, Any], transparency: Optional[str], function_name: str) -> None:
    if transparency is None:
        return
    valid_transparency_values = ["opaque", "transparent"]
    if transparency in valid_transparency_values:
        event_body["transparency"] = transparency

def _apply_visibility_if_valid(event_body: Dict[str, Any], visibility: Optional[str], function_name: str) -> None:
    if visibility is None:
        return
    valid_visibility_values = ["default", "public", "private", "confidential"]
    if visibility in valid_visibility_values:
        event_body["visibility"] = visibility

def _preserve_existing_fields(event_body: Dict[str, Any], existing_event: Dict[str, Any], field_mappings: Dict[str, Any]) -> None:
    for field_name, new_value in field_mappings.items():
        if new_value is None and field_name in existing_event:
            event_body[field_name] = existing_event[field_name]
        elif new_value is not None:
            event_body[field_name] = new_value

def _correct_time_format_for_api(time_str: Optional[str], param_name: str, timezone: Optional[str] = None) -> Optional[str]:
    if not time_str:
        return None
    time_str = time_str.strip().strip('"').strip("'").strip()
    if not time_str or time_str.lower() in ("null", "none"):
        return None

    if len(time_str) == 10 and time_str.count("-") == 2:
        try:
            datetime.datetime.strptime(time_str, "%Y-%m-%d")
            if timezone:
                try:
                    tz = pytz.timezone(timezone)
                    date_obj = datetime.datetime.strptime(time_str, "%Y-%m-%d")
                    dt = tz.localize(date_obj)
                    formatted = dt.astimezone(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
                except pytz.exceptions.UnknownTimeZoneError:
                    formatted = f"{time_str}T00:00:00Z"
            else:
                formatted = f"{time_str}T00:00:00Z"
            return formatted
        except ValueError:
            return time_str

    if (len(time_str) == 19 and time_str[10] == "T" and time_str.count(":") == 2 and not (time_str.endswith("Z") or ("+" in time_str[10:]) or ("-" in time_str[10:]))):
        try:
            datetime.datetime.strptime(time_str, "%Y-%m-%dT%H:%M:%S")
            return time_str + "Z"
        except ValueError:
            return time_str

    return time_str

def _strip_utc_offset(datetime_str: str) -> str:
    if datetime_str.endswith("Z"):
        return datetime_str[:-1]
    return re.sub(r"[+-]\d{2}:\d{2}$", "", datetime_str)

def _normalize_attendees(attendees: Optional[Union[List[str], List[Dict[str, Any]]]]) -> Optional[List[Dict[str, Any]]]:
    if attendees is None:
        return None
    normalized = []
    for att in attendees:
        if isinstance(att, str):
            normalized.append({"email": att})
        elif isinstance(att, dict) and "email" in att:
            normalized.append(att)
    return normalized if normalized else None

async def list_calendars(service, user_google_email: str) -> str:
    calendar_list_response = await asyncio.to_thread(lambda: service.calendarList().list().execute())
    items = calendar_list_response.get("items", [])
    if not items:
        return f"No calendars found for {user_google_email}."
    calendars_summary_list = [f'- "{cal.get("summary", "No Summary")}"{" (Primary)" if cal.get("primary") else ""} (ID: {cal["id"]})' for cal in items]
    return f"Successfully listed {len(items)} calendars for {user_google_email}:\n" + "\n".join(calendars_summary_list)

async def get_events(
    service,
    user_google_email: str,
    calendar_id: str = "primary",
    event_id: Optional[str] = None,
    time_min: Optional[str] = None,
    time_max: Optional[str] = None,
    max_results: int = 25,
    query: Optional[str] = None,
    detailed: bool = False,
    include_attachments: bool = False,
) -> str:
    if event_id:
        event = await asyncio.to_thread(lambda: service.events().get(calendarId=calendar_id, eventId=event_id).execute())
        items = [event]
    else:
        formatted_time_min = _correct_time_format_for_api(time_min, "time_min", None)
        if formatted_time_min:
            effective_time_min = formatted_time_min
        else:
            utc_now = datetime.datetime.now(datetime.timezone.utc)
            effective_time_min = utc_now.isoformat().replace("+00:00", "Z")
        effective_time_max = _correct_time_format_for_api(time_max, "time_max", None)

        request_params = {
            "calendarId": calendar_id,
            "timeMin": effective_time_min,
            "timeMax": effective_time_max,
            "maxResults": max_results,
            "singleEvents": True,
            "orderBy": "startTime",
        }
        if query:
            request_params["q"] = query

        events_result = await asyncio.to_thread(lambda: service.events().list(**request_params).execute())
        items = events_result.get("items", [])

    if not items:
        if event_id:
            return f"Event with ID '{event_id}' not found in calendar '{calendar_id}' for {user_google_email}."
        else:
            return f"No events found in calendar '{calendar_id}' for {user_google_email} for the specified time range."

    if event_id and detailed:
        item = items[0]
        summary = item.get("summary", "No Title")
        start = item["start"].get("dateTime", item["start"].get("date"))
        end = item["end"].get("dateTime", item["end"].get("date"))
        link = item.get("htmlLink", "No Link")
        description = item.get("description", "No Description")
        location = item.get("location", "No Location")
        color_id = item.get("colorId", "None")
        attendees = item.get("attendees", [])
        attendee_emails = ", ".join([a.get("email", "") for a in attendees]) if attendees else "None"
        attendee_details_str = _format_attendee_details(attendees, indent="  ")

        meeting_link = _get_meeting_link(item)
        creator_str = _format_person(item.get("creator"))
        organizer_str = _format_person(item.get("organizer"))

        event_details = f"Event Details:\n- Title: {summary}\n- Starts: {start}\n- Ends: {end}\n- Description: {description}\n- Location: {location}\n- Color ID: {color_id}\n"
        if creator_str:
            event_details += f"- Creator: {creator_str}\n"
        if organizer_str:
            event_details += f"- Organizer: {organizer_str}\n"
        if meeting_link:
            event_details += f"- Meeting Link: {meeting_link}\n"
        event_details += f"- Attendees: {attendee_emails}\n- Attendee Details: {attendee_details_str}\n"

        if include_attachments:
            attachments = item.get("attachments", [])
            attachment_details_str = _format_attachment_details(attachments, indent="  ")
            event_details += f"- Attachments: {attachment_details_str}\n"

        event_details += f"- Event ID: {event_id}\n- Link: {link}"
        return event_details

    event_details_list = []
    for item in items:
        summary = item.get("summary", "No Title")
        start_time = item["start"].get("dateTime", item["start"].get("date"))
        end_time = item["end"].get("dateTime", item["end"].get("date"))
        link = item.get("htmlLink", "No Link")
        item_event_id = item.get("id", "No ID")

        if detailed:
            description = item.get("description", "No Description")
            location = item.get("location", "No Location")
            attendees = item.get("attendees", [])
            attendee_emails = ", ".join([a.get("email", "") for a in attendees]) if attendees else "None"
            attendee_details_str = _format_attendee_details(attendees, indent="    ")
            meeting_link = _get_meeting_link(item)
            creator_str = _format_person(item.get("creator"))
            organizer_str = _format_person(item.get("organizer"))

            event_detail_parts = f'- "{summary}" (Starts: {start_time}, Ends: {end_time})\n  Description: {description}\n  Location: {location}\n'
            if creator_str:
                event_detail_parts += f"  Creator: {creator_str}\n"
            if organizer_str:
                event_detail_parts += f"  Organizer: {organizer_str}\n"
            if meeting_link:
                event_detail_parts += f"  Meeting Link: {meeting_link}\n"
            event_detail_parts += f"  Attendees: {attendee_emails}\n  Attendee Details: {attendee_details_str}\n"

            if include_attachments:
                attachments = item.get("attachments", [])
                attachment_details_str = _format_attachment_details(attachments, indent="    ")
                event_detail_parts += f"  Attachments: {attachment_details_str}\n"

            event_detail_parts += f"  ID: {item_event_id} | Link: {link}"
            event_details_list.append(event_detail_parts)
        else:
            meeting_link = _get_meeting_link(item)
            basic_line = f'- "{summary}" (Starts: {start_time}, Ends: {end_time})'
            if meeting_link:
                basic_line += f" Meeting: {meeting_link}"
            basic_line += f" ID: {item_event_id} | Link: {link}"
            event_details_list.append(basic_line)

    if event_id:
        return f"Successfully retrieved event from calendar '{calendar_id}' for {user_google_email}:\n" + "\n".join(event_details_list)
    else:
        return f"Successfully retrieved {len(items)} events from calendar '{calendar_id}' for {user_google_email}:\n" + "\n".join(event_details_list)

async def _create_event_impl(
    service, creds, user_google_email, summary, start_time, end_time, calendar_id, description, location,
    attendees, timezone, attachments, add_google_meet, reminders, use_default_reminders, transparency,
    visibility, guests_can_modify, guests_can_invite_others, guests_can_see_other_guests, send_updates
) -> str:
    if attachments and isinstance(attachments, str):
        attachments = [a.strip() for a in attachments.split(",") if a.strip()]

    effective_start = start_time
    effective_end = end_time
    if timezone and "T" in start_time:
        effective_start = _strip_utc_offset(start_time)
    if timezone and "T" in end_time:
        effective_end = _strip_utc_offset(end_time)

    event_body = {
        "summary": summary,
        "start": {"date": start_time} if "T" not in start_time else {"dateTime": effective_start},
        "end": {"date": end_time} if "T" not in end_time else {"dateTime": effective_end},
    }
    if location: event_body["location"] = location
    if description: event_body["description"] = description
    if timezone:
        if "dateTime" in event_body["start"]: event_body["start"]["timeZone"] = timezone
        if "dateTime" in event_body["end"]: event_body["end"]["timeZone"] = timezone
    if attendees:
        event_body["attendees"] = [{"email": email} for email in attendees]

    if reminders is not None or not use_default_reminders:
        effective_use_default = use_default_reminders and reminders is None
        reminder_data = {"useDefault": effective_use_default}
        if reminders is not None:
            validated_reminders = _parse_reminders_json(reminders, "create_event")
            if validated_reminders:
                reminder_data["overrides"] = validated_reminders
        event_body["reminders"] = reminder_data

    _apply_transparency_if_valid(event_body, transparency, "create_event")
    _apply_visibility_if_valid(event_body, visibility, "create_event")

    if guests_can_modify is not None: event_body["guestsCanModify"] = guests_can_modify
    if guests_can_invite_others is not None: event_body["guestsCanInviteOthers"] = guests_can_invite_others
    if guests_can_see_other_guests is not None: event_body["guestsCanSeeOtherGuests"] = guests_can_see_other_guests

    if add_google_meet:
        request_id = str(uuid.uuid4())
        event_body["conferenceData"] = {
            "createRequest": {
                "requestId": request_id,
                "conferenceSolutionKey": {"type": "hangoutsMeet"},
            }
        }
    conference_data_version = 1 if add_google_meet else 0

    if attachments:
        event_body["attachments"] = []
        drive_service = None
        try:
            try:
                drive_service = build("drive", "v3", credentials=creds)
            except Exception:
                pass
            for att in attachments:
                file_id = None
                if att.startswith("https://"):
                    match = re.search(r"(?:/d/|/file/d/|id=)([\w-]+)", att)
                    file_id = match.group(1) if match else None
                else:
                    file_id = att
                if file_id:
                    file_url = f"https://drive.google.com/open?id={file_id}"
                    mime_type = "application/vnd.google-apps.drive-sdk"
                    title = "Drive Attachment"
                    if drive_service:
                        try:
                            file_metadata = await asyncio.to_thread(lambda: drive_service.files().get(fileId=file_id, fields="mimeType,name", supportsAllDrives=True).execute())
                            mime_type = file_metadata.get("mimeType", mime_type)
                            filename = file_metadata.get("name")
                            if filename: title = filename
                        except Exception:
                            pass
                    event_body["attachments"].append({"fileUrl": file_url, "title": title, "mimeType": mime_type})
        finally:
            if drive_service: drive_service.close()
            
        created_event = await asyncio.to_thread(
            lambda: service.events().insert(
                calendarId=calendar_id, body=event_body, supportsAttachments=True,
                conferenceDataVersion=conference_data_version, sendUpdates=send_updates
            ).execute()
        )
    else:
        created_event = await asyncio.to_thread(
            lambda: service.events().insert(
                calendarId=calendar_id, body=event_body,
                conferenceDataVersion=conference_data_version, sendUpdates=send_updates
            ).execute()
        )
    link = created_event.get("htmlLink", "No link available")
    confirmation_message = f"Successfully created event '{created_event.get('summary', summary)}' for {user_google_email}. Link: {link}"
    if add_google_meet:
        meeting_link = _get_meeting_link(created_event)
        if meeting_link:
            confirmation_message += f" Google Meet: {meeting_link}"
    return confirmation_message

async def _modify_event_impl(
    service, creds, user_google_email, event_id, calendar_id, summary, start_time, end_time, description, location,
    attendees, timezone, add_google_meet, reminders, use_default_reminders, transparency, visibility,
    color_id, guests_can_modify, guests_can_invite_others, guests_can_see_other_guests, send_updates
) -> str:
    event_body = {}
    if summary is not None: event_body["summary"] = summary
    if start_time is not None:
        effective_start = start_time
        if timezone is not None and "T" in start_time:
            effective_start = _strip_utc_offset(start_time)
        event_body["start"] = {"date": start_time} if "T" not in start_time else {"dateTime": effective_start}
        if timezone is not None and "dateTime" in event_body["start"]: event_body["start"]["timeZone"] = timezone
    if end_time is not None:
        effective_end = end_time
        if timezone is not None and "T" in end_time:
            effective_end = _strip_utc_offset(end_time)
        event_body["end"] = {"date": end_time} if "T" not in end_time else {"dateTime": effective_end}
        if timezone is not None and "dateTime" in event_body["end"]: event_body["end"]["timeZone"] = timezone
    if description is not None: event_body["description"] = description
    if location is not None: event_body["location"] = location

    normalized_attendees = _normalize_attendees(attendees)
    if normalized_attendees is not None:
        event_body["attendees"] = normalized_attendees

    if color_id is not None: event_body["colorId"] = color_id

    if reminders is not None or use_default_reminders is not None:
        reminder_data = {}
        if use_default_reminders is not None:
            reminder_data["useDefault"] = use_default_reminders
        else:
            try:
                existing_event = service.events().get(calendarId=calendar_id, eventId=event_id).execute()
                reminder_data["useDefault"] = existing_event.get("reminders", {}).get("useDefault", True)
            except Exception:
                reminder_data["useDefault"] = True
        if reminders is not None:
            if reminder_data.get("useDefault", False):
                reminder_data["useDefault"] = False
            validated_reminders = _parse_reminders_json(reminders, "modify_event")
            if validated_reminders:
                reminder_data["overrides"] = validated_reminders
        event_body["reminders"] = reminder_data

    _apply_transparency_if_valid(event_body, transparency, "modify_event")
    _apply_visibility_if_valid(event_body, visibility, "modify_event")

    if guests_can_modify is not None: event_body["guestsCanModify"] = guests_can_modify
    if guests_can_invite_others is not None: event_body["guestsCanInviteOthers"] = guests_can_invite_others
    if guests_can_see_other_guests is not None: event_body["guestsCanSeeOtherGuests"] = guests_can_see_other_guests

    if add_google_meet is not None:
        if add_google_meet:
            request_id = str(uuid.uuid4())
            event_body["conferenceData"] = {
                "createRequest": {
                    "requestId": request_id,
                    "conferenceSolutionKey": {"type": "hangoutsMeet"},
                }
            }
        else:
            event_body["conferenceData"] = None

    if not event_body:
        raise Exception("No fields provided to modify the event.")

    try:
        existing_event = await asyncio.to_thread(lambda: service.events().get(calendarId=calendar_id, eventId=event_id).execute())
        _preserve_existing_fields(
            event_body, existing_event,
            {
                "summary": summary, "description": description, "location": location,
                "attendees": event_body.get("attendees"), "colorId": event_body.get("colorId"),
            }
        )
    except HttpError as get_error:
        if get_error.resp.status == 404:
            raise Exception(f"Event not found during verification. The event with ID '{event_id}' could not be found in calendar '{calendar_id}'.")

    updated_event = await asyncio.to_thread(
        lambda: service.events().patch(
            calendarId=calendar_id, eventId=event_id, body=event_body,
            conferenceDataVersion=1, sendUpdates=send_updates
        ).execute()
    )

    link = updated_event.get("htmlLink", "No link available")
    confirmation_message = f"Successfully modified event '{updated_event.get('summary', summary)}' (ID: {event_id}) for {user_google_email}. Link: {link}"
    if add_google_meet is True:
        meeting_link = _get_meeting_link(updated_event)
        if meeting_link:
            confirmation_message += f" Google Meet: {meeting_link}"
    elif add_google_meet is False:
        confirmation_message += " (Google Meet removed)"
    return confirmation_message

async def _delete_event_impl(service, user_google_email, event_id, calendar_id, send_updates) -> str:
    try:
        await asyncio.to_thread(lambda: service.events().get(calendarId=calendar_id, eventId=event_id).execute())
    except HttpError as get_error:
        if get_error.resp.status == 404:
            raise Exception(f"Event not found during verification. The event with ID '{event_id}' could not be found in calendar '{calendar_id}'.")
    await asyncio.to_thread(lambda: service.events().delete(calendarId=calendar_id, eventId=event_id, sendUpdates=send_updates).execute())
    return f"Successfully deleted event (ID: {event_id}) from calendar '{calendar_id}' for {user_google_email}."

async def manage_event(service, creds, user_google_email, action, **kwargs) -> str:
    action_lower = action.lower().strip()
    calendar_id = kwargs.get("calendar_id", "primary")
    send_updates = kwargs.get("send_updates", "all")
    if action_lower == "create":
        if not kwargs.get("summary") or not kwargs.get("start_time") or not kwargs.get("end_time"):
            raise ValueError("summary, start_time, and end_time are required for create action")
        return await _create_event_impl(
            service, creds, user_google_email, kwargs.get("summary"), kwargs.get("start_time"), kwargs.get("end_time"),
            calendar_id, kwargs.get("description"), kwargs.get("location"), kwargs.get("attendees"), kwargs.get("timezone"),
            kwargs.get("attachments"), kwargs.get("add_google_meet", False), kwargs.get("reminders"),
            kwargs.get("use_default_reminders", True), kwargs.get("transparency"), kwargs.get("visibility"),
            kwargs.get("guests_can_modify"), kwargs.get("guests_can_invite_others"), kwargs.get("guests_can_see_other_guests"),
            send_updates
        )
    elif action_lower == "update":
        event_id = kwargs.get("event_id")
        if not event_id:
            raise ValueError("event_id is required for update action")
        return await _modify_event_impl(
            service, creds, user_google_email, event_id, calendar_id, kwargs.get("summary"), kwargs.get("start_time"),
            kwargs.get("end_time"), kwargs.get("description"), kwargs.get("location"), kwargs.get("attendees"), kwargs.get("timezone"),
            kwargs.get("add_google_meet"), kwargs.get("reminders"), kwargs.get("use_default_reminders"), kwargs.get("transparency"),
            kwargs.get("visibility"), kwargs.get("color_id"), kwargs.get("guests_can_modify"), kwargs.get("guests_can_invite_others"),
            kwargs.get("guests_can_see_other_guests"), send_updates
        )
    elif action_lower == "delete":
        event_id = kwargs.get("event_id")
        if not event_id:
            raise ValueError("event_id is required for delete action")
        return await _delete_event_impl(service, user_google_email, event_id, calendar_id, send_updates)
    else:
        raise ValueError(f"Invalid action '{action_lower}'. Must be 'create', 'update', or 'delete'.")

async def query_freebusy(
    service,
    user_google_email: str,
    time_min: str,
    time_max: str,
    calendar_ids: Optional[List[str]] = None,
    group_expansion_max: Optional[int] = None,
    calendar_expansion_max: Optional[int] = None,
) -> str:
    formatted_time_min = _correct_time_format_for_api(time_min, "time_min", None)
    formatted_time_max = _correct_time_format_for_api(time_max, "time_max", None)

    if not calendar_ids:
        calendar_ids = ["primary"]

    request_body = {
        "timeMin": formatted_time_min,
        "timeMax": formatted_time_max,
        "items": [{"id": cal_id} for cal_id in calendar_ids],
    }
    if group_expansion_max is not None: request_body["groupExpansionMax"] = group_expansion_max
    if calendar_expansion_max is not None: request_body["calendarExpansionMax"] = calendar_expansion_max

    freebusy_result = await asyncio.to_thread(lambda: service.freebusy().query(body=request_body).execute())

    calendars = freebusy_result.get("calendars", {})
    time_min_result = freebusy_result.get("timeMin", formatted_time_min)
    time_max_result = freebusy_result.get("timeMax", formatted_time_max)

    if not calendars:
        return f"No free/busy information found for the requested calendars for {user_google_email}."

    output_lines = [f"Free/Busy information for {user_google_email}:", f"Time range: {time_min_result} to {time_max_result}", ""]

    for cal_id, cal_data in calendars.items():
        output_lines.append(f"Calendar: {cal_id}")
        errors = cal_data.get("errors", [])
        if errors:
            output_lines.append("  Errors:")
            for error in errors:
                output_lines.append(f"    - {error.get('domain', 'unknown')}: {error.get('reason', 'unknown')}")
            output_lines.append("")
            continue
        busy_periods = cal_data.get("busy", [])
        if not busy_periods:
            output_lines.append("  Status: Free (no busy periods)")
        else:
            output_lines.append(f"  Busy periods: {len(busy_periods)}")
            for period in busy_periods:
                output_lines.append(f"    - {period.get('start', 'Unknown')} to {period.get('end', 'Unknown')}")
        output_lines.append("")

    return "\n".join(output_lines)

async def execute_tool(tool_name: str, arguments: dict, access_token: str) -> str:
    creds = Credentials(access_token)
    service = build("calendar", "v3", credentials=creds)

    if tool_name == "list_calendars":
        return await list_calendars(service, **arguments)
    elif tool_name == "get_events":
        return await get_events(service, **arguments)
    elif tool_name == "manage_event":
        return await manage_event(service, creds, **arguments)
    elif tool_name == "query_freebusy":
        return await query_freebusy(service, **arguments)
    else:
        raise ValueError(f"Unknown tool name: {tool_name}")
