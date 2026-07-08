"""
Google Tasks API Module.
Implements Google Tasks tools using googleapiclient.discovery.
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, List

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

logger = logging.getLogger(__name__)

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "list_task_lists",
            "description": "Lists all Google Tasks lists for the user.",
            "parameters": {
                "type": "object",
                "properties": {
                    "max_results": {"type": "integer", "description": "Maximum number of task lists to return. Default 1000."},
                    "page_token": {"type": "string", "description": "Token for pagination."},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_task_list",
            "description": "Gets details of a specific Google Tasks list.",
            "parameters": {
                "type": "object",
                "properties": {
                    "task_list_id": {"type": "string", "description": "The ID of the task list to retrieve."},
                },
                "required": ["task_list_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "manage_task_list",
            "description": "Manages task lists: create, update, delete, or clear completed tasks.",
            "parameters": {
                "type": "object",
                "properties": {
                    "action": {"type": "string", "description": "Action to perform: 'create', 'update', 'delete', or 'clear_completed'."},
                    "task_list_id": {"type": "string", "description": "ID of the task list. Required for update, delete, and clear_completed."},
                    "title": {"type": "string", "description": "Title of the task list. Required for create and update."},
                },
                "required": ["action"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_tasks",
            "description": "Lists all tasks in a specific task list.",
            "parameters": {
                "type": "object",
                "properties": {
                    "task_list_id": {"type": "string", "description": "ID of the task list to retrieve tasks from."},
                    "max_results": {"type": "integer", "description": "Maximum number of tasks to return. Default 20."},
                    "page_token": {"type": "string", "description": "Token for pagination."},
                    "show_completed": {"type": "boolean", "description": "Whether to include completed tasks. Default True."},
                    "show_deleted": {"type": "boolean", "description": "Whether to include deleted tasks. Default False."},
                    "show_hidden": {"type": "boolean", "description": "Whether to include hidden tasks. Default False."},
                    "show_assigned": {"type": "boolean", "description": "Whether to include assigned tasks. Default False."},
                    "completed_max": {"type": "string", "description": "Upper bound for completion date (RFC 3339 timestamp)."},
                    "completed_min": {"type": "string", "description": "Lower bound for completion date (RFC 3339 timestamp)."},
                    "due_max": {"type": "string", "description": "Upper bound for due date (RFC 3339 timestamp)."},
                    "due_min": {"type": "string", "description": "Lower bound for due date (RFC 3339 timestamp)."},
                    "updated_min": {"type": "string", "description": "Lower bound for last modification time (RFC 3339 timestamp)."},
                },
                "required": ["task_list_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_task",
            "description": "Gets details of a specific task.",
            "parameters": {
                "type": "object",
                "properties": {
                    "task_list_id": {"type": "string", "description": "ID of the task list containing the task."},
                    "task_id": {"type": "string", "description": "ID of the task to retrieve."},
                },
                "required": ["task_list_id", "task_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "manage_task",
            "description": "Manages tasks: create, update, delete, or move tasks within task lists.",
            "parameters": {
                "type": "object",
                "properties": {
                    "action": {"type": "string", "description": "Action to perform: 'create', 'update', 'delete', or 'move'."},
                    "task_list_id": {"type": "string", "description": "ID of the task list. Required for all actions."},
                    "task_id": {"type": "string", "description": "ID of the task. Required for update, delete, and move actions."},
                    "title": {"type": "string", "description": "Title of the task. Required for create, optional for update."},
                    "notes": {"type": "string", "description": "Notes/description for the task."},
                    "status": {"type": "string", "description": "Task status ('needsAction' or 'completed')."},
                    "due": {"type": "string", "description": "Due date in RFC 3339 format (e.g., '2024-12-31T23:59:59Z')."},
                    "parent": {"type": "string", "description": "Parent task ID (for subtasks)."},
                    "previous": {"type": "string", "description": "Previous sibling task ID (for positioning)."},
                    "destination_task_list": {"type": "string", "description": "Destination task list ID (for moving between lists)."},
                },
                "required": ["action", "task_list_id"],
            },
        },
    },
]


def _adjust_due_max(due_max: str) -> str:
    """Adjust dueMax for Tasks API exclusive boundary logic."""
    try:
        parsed = datetime.fromisoformat(due_max.replace("Z", "+00:00"))
    except ValueError:
        return due_max
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    adjusted = parsed + timedelta(days=1)
    if adjusted.tzinfo == timezone.utc:
        return adjusted.isoformat().replace("+00:00", "Z")
    return adjusted.isoformat()


async def execute_tool(tool_name: str, arguments: dict, access_token: str) -> str:
    """Executes a Google Tasks tool using googleapiclient."""
    creds = Credentials(access_token)
    service = build("tasks", "v1", credentials=creds)

    try:
        if tool_name == "list_task_lists":
            max_results = arguments.get("max_results", 1000)
            page_token = arguments.get("page_token")
            params = {}
            if max_results:
                params["maxResults"] = max_results
            if page_token:
                params["pageToken"] = page_token

            result = await asyncio.to_thread(service.tasklists().list(**params).execute)
            task_lists = result.get("items", [])
            if not task_lists:
                return "No task lists found."

            lines = []
            for tl in task_lists:
                lines.append(f"- {tl.get('title', 'Untitled')} (ID: {tl['id']}) - Updated: {tl.get('updated', 'N/A')}")
            
            next_page = result.get("nextPageToken")
            res_str = "Task Lists:\n" + "\n".join(lines)
            if next_page:
                res_str += f"\nNext page token: {next_page}"
            return res_str

        elif tool_name == "get_task_list":
            task_list_id = arguments.get("task_list_id")
            if not task_list_id:
                return "Error: 'task_list_id' is required."
            
            result = await asyncio.to_thread(service.tasklists().get(tasklist=task_list_id).execute)
            return (
                f"Task List Details:\n"
                f"- Title: {result.get('title', 'Untitled')}\n"
                f"- ID: {result.get('id')}\n"
                f"- Updated: {result.get('updated', 'N/A')}"
            )

        elif tool_name == "manage_task_list":
            action = arguments.get("action")
            task_list_id = arguments.get("task_list_id")
            title = arguments.get("title")

            if action == "create":
                if not title: return "Error: 'title' is required for create."
                body = {"title": title}
                res = await asyncio.to_thread(service.tasklists().insert(body=body).execute)
                return f"Created task list: '{res.get('title')}' (ID: {res['id']})"
            
            elif action == "update":
                if not task_list_id or not title: return "Error: 'task_list_id' and 'title' are required for update."
                body = {"id": task_list_id, "title": title}
                res = await asyncio.to_thread(service.tasklists().update(tasklist=task_list_id, body=body).execute)
                return f"Updated task list: '{res.get('title')}' (ID: {res['id']})"
                
            elif action == "delete":
                if not task_list_id: return "Error: 'task_list_id' is required for delete."
                await asyncio.to_thread(service.tasklists().delete(tasklist=task_list_id).execute)
                return f"Deleted task list {task_list_id}."
                
            elif action == "clear_completed":
                if not task_list_id: return "Error: 'task_list_id' is required for clear_completed."
                await asyncio.to_thread(service.tasks().clear(tasklist=task_list_id).execute)
                return f"Cleared completed tasks from list {task_list_id}."
            else:
                return f"Unknown action: {action}"

        elif tool_name == "list_tasks":
            task_list_id = arguments.get("task_list_id")
            if not task_list_id: return "Error: 'task_list_id' is required."

            params = {"tasklist": task_list_id}
            if "max_results" in arguments: params["maxResults"] = arguments["max_results"]
            if "page_token" in arguments: params["pageToken"] = arguments["page_token"]
            if "show_completed" in arguments: params["showCompleted"] = arguments["show_completed"]
            if "show_deleted" in arguments: params["showDeleted"] = arguments["show_deleted"]
            if "show_hidden" in arguments: params["showHidden"] = arguments["show_hidden"]
            if "show_assigned" in arguments: params["showAssigned"] = arguments["show_assigned"]
            if "completed_max" in arguments: params["completedMax"] = arguments["completed_max"]
            if "completed_min" in arguments: params["completedMin"] = arguments["completed_min"]
            if "due_max" in arguments: params["dueMax"] = _adjust_due_max(arguments["due_max"])
            if "due_min" in arguments: params["dueMin"] = arguments["due_min"]
            if "updated_min" in arguments: params["updatedMin"] = arguments["updated_min"]

            result = await asyncio.to_thread(service.tasks().list(**params).execute)
            tasks = result.get("items", [])
            if not tasks:
                return f"No tasks found in list {task_list_id}."

            lines = []
            for t in tasks:
                lines.append(
                    f"- {t.get('title', 'Untitled')} (ID: {t['id']})\n"
                    f"  Status: {t.get('status', 'N/A')}"
                )
                if t.get("due"): lines.append(f"  Due: {t['due']}")
                if t.get("notes"): lines.append(f"  Notes: {t['notes'][:100]}...")
                if t.get("parent"): lines.append(f"  Parent: {t['parent']}")
            
            next_page = result.get("nextPageToken")
            res_str = f"Tasks in list {task_list_id}:\n" + "\n".join(lines)
            if next_page:
                res_str += f"\n\nNext page token: {next_page}"
            return res_str

        elif tool_name == "get_task":
            task_list_id = arguments.get("task_list_id")
            task_id = arguments.get("task_id")
            if not task_list_id or not task_id: return "Error: 'task_list_id' and 'task_id' are required."

            t = await asyncio.to_thread(service.tasks().get(tasklist=task_list_id, task=task_id).execute)
            res = (
                f"Task Details:\n"
                f"- Title: {t.get('title', 'Untitled')}\n"
                f"- ID: {t.get('id')}\n"
                f"- Status: {t.get('status', 'N/A')}\n"
                f"- Updated: {t.get('updated', 'N/A')}"
            )
            if t.get("due"): res += f"\n- Due: {t['due']}"
            if t.get("completed"): res += f"\n- Completed: {t['completed']}"
            if t.get("notes"): res += f"\n- Notes: {t['notes']}"
            if t.get("parent"): res += f"\n- Parent ID: {t['parent']}"
            if t.get("position"): res += f"\n- Position: {t['position']}"
            return res

        elif tool_name == "manage_task":
            action = arguments.get("action")
            task_list_id = arguments.get("task_list_id")
            if not action or not task_list_id: return "Error: 'action' and 'task_list_id' are required."
            
            task_id = arguments.get("task_id")
            title = arguments.get("title")
            notes = arguments.get("notes")
            status = arguments.get("status")
            due = arguments.get("due")
            parent = arguments.get("parent")
            previous = arguments.get("previous")
            dest = arguments.get("destination_task_list")

            if action == "create":
                if not title: return "Error: 'title' is required for create."
                body = {"title": title}
                if notes: body["notes"] = notes
                if due: body["due"] = due
                params = {"tasklist": task_list_id, "body": body}
                if parent: params["parent"] = parent
                if previous: params["previous"] = previous
                
                res = await asyncio.to_thread(service.tasks().insert(**params).execute)
                return f"Created task '{res.get('title')}' (ID: {res['id']})"
                
            elif action == "update":
                if not task_id: return "Error: 'task_id' is required for update."
                # Fetch existing to merge
                t = await asyncio.to_thread(service.tasks().get(tasklist=task_list_id, task=task_id).execute)
                body = {
                    "id": task_id,
                    "title": title if title is not None else t.get("title", ""),
                    "status": status if status is not None else t.get("status", "needsAction")
                }
                if notes is not None:
                    body["notes"] = notes
                elif t.get("notes"):
                    body["notes"] = t["notes"]
                    
                if due is not None:
                    body["due"] = due
                elif t.get("due"):
                    body["due"] = t["due"]
                    
                res = await asyncio.to_thread(service.tasks().update(tasklist=task_list_id, task=task_id, body=body).execute)
                return f"Updated task '{res.get('title')}' (ID: {res['id']})"
                
            elif action == "delete":
                if not task_id: return "Error: 'task_id' is required for delete."
                await asyncio.to_thread(service.tasks().delete(tasklist=task_list_id, task=task_id).execute)
                return f"Deleted task {task_id}."
                
            elif action == "move":
                if not task_id: return "Error: 'task_id' is required for move."
                params = {"tasklist": task_list_id, "task": task_id}
                if parent: params["parent"] = parent
                if previous: params["previous"] = previous
                if dest: params["destinationTasklist"] = dest
                
                res = await asyncio.to_thread(service.tasks().move(**params).execute)
                return f"Moved task '{res.get('title')}' (ID: {res['id']})."
            else:
                return f"Unknown action: {action}"

        else:
            return f"Unknown tool: {tool_name}"

    except HttpError as e:
        logger.error(f"[Google Tasks] API error: {e}", exc_info=True)
        return f"Google API Error: {e.reason} (Status Code: {e.status_code})"
    except Exception as e:
        logger.error(f"[Google Tasks] Error executing {tool_name}: {e}", exc_info=True)
        return f"Error executing {tool_name}: {str(e)}"
