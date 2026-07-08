import asyncio
import logging
import base64
from typing import Dict, Any, List

import httpx
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

logger = logging.getLogger(__name__)

TOOLS = [
    {
        "name": "list_spaces",
        "description": "Lists Google Chat spaces (rooms and direct messages) accessible to the user.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "user_google_email": {"type": "string", "description": "The email address of the user."},
                "page_size": {"type": "integer", "description": "Maximum number of spaces to return.", "default": 100},
                "space_type": {"type": "string", "description": "Type of space: 'all', 'room', or 'dm'.", "default": "all"}
            },
            "required": ["user_google_email"]
        }
    },
    {
        "name": "get_messages",
        "description": "Retrieves messages from a Google Chat space.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "user_google_email": {"type": "string", "description": "The email address of the user."},
                "space_id": {"type": "string", "description": "The space resource name (e.g., spaces/X)."},
                "page_size": {"type": "integer", "description": "Maximum number of messages to return.", "default": 50},
                "order_by": {"type": "string", "description": "Sort order.", "default": "createTime desc"}
            },
            "required": ["user_google_email", "space_id"]
        }
    },
    {
        "name": "search_messages",
        "description": "Searches for messages in Google Chat spaces by text content.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "user_google_email": {"type": "string", "description": "The email address of the user."},
                "query": {"type": "string", "description": "Text to search for."},
                "space_id": {"type": "string", "description": "Optional space to restrict the search to."},
                "page_size": {"type": "integer", "description": "Maximum number of messages to return.", "default": 25}
            },
            "required": ["user_google_email", "query"]
        }
    },
    {
        "name": "send_message",
        "description": "Sends a message to a Google Chat space. Can reply to existing threads.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "user_google_email": {"type": "string", "description": "The email address of the user."},
                "space_id": {"type": "string", "description": "The space resource name."},
                "message_text": {"type": "string", "description": "The text content of the message."},
                "thread_key": {"type": "string", "description": "App-defined key; creates thread if not found."},
                "thread_name": {"type": "string", "description": "Resource name, e.g. spaces/X/threads/Y"}
            },
            "required": ["user_google_email", "space_id", "message_text"]
        }
    },
    {
        "name": "create_reaction",
        "description": "Adds an emoji reaction to a message.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "user_google_email": {"type": "string", "description": "The email address of the user."},
                "message_id": {"type": "string", "description": "Resource name, e.g. spaces/X/messages/Y"},
                "emoji_unicode": {"type": "string", "description": "Literal Unicode emoji character (not a shortcode)."}
            },
            "required": ["user_google_email", "message_id", "emoji_unicode"]
        }
    },
    {
        "name": "download_chat_attachment",
        "description": "Downloads an attachment from a Chat message. Returns a local file path (stdio mode) or a temporary URL valid for 1 hour (HTTP mode).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "user_google_email": {"type": "string", "description": "The email address of the user."},
                "message_id": {"type": "string", "description": "Resource name, e.g. spaces/X/messages/Y"},
                "attachment_index": {"type": "integer", "description": "Zero-based index of the attachment.", "default": 0}
            },
            "required": ["user_google_email", "message_id"]
        }
    }
]

def _extract_rich_links(msg: dict) -> List[str]:
    text = msg.get("text", "")
    urls = []
    for ann in msg.get("annotations", []):
        if ann.get("type") == "RICH_LINK":
            uri = ann.get("richLinkMetadata", {}).get("uri", "")
            if uri and uri not in text:
                urls.append(uri)
    return urls

async def execute_tool(tool_name: str, arguments: Dict[str, Any], access_token: str) -> str:
    credentials = Credentials(access_token)
    service = build("chat", "v1", credentials=credentials)

    try:
        if tool_name == "list_spaces":
            page_size = arguments.get("page_size", 100)
            space_type = arguments.get("space_type", "all")

            filter_param = None
            if space_type == "room":
                filter_param = "spaceType = SPACE"
            elif space_type == "dm":
                filter_param = "spaceType = DIRECT_MESSAGE"

            request_params = {"pageSize": page_size}
            if filter_param:
                request_params["filter"] = filter_param

            response = await asyncio.to_thread(service.spaces().list(**request_params).execute)
            spaces = response.get("spaces", [])
            if not spaces:
                return f"No Chat spaces found for type '{space_type}'."

            output = [f"Found {len(spaces)} Chat spaces (type: {space_type}):"]
            for space in spaces:
                space_name = space.get("displayName", "Unnamed Space")
                space_id = space.get("name", "")
                space_type_actual = space.get("spaceType", "UNKNOWN")
                output.append(f"- {space_name} (ID: {space_id}, Type: {space_type_actual})")

            return "\n".join(output)

        elif tool_name == "get_messages":
            space_id = arguments.get("space_id")
            if not space_id:
                return "Missing required argument: space_id"
            page_size = arguments.get("page_size", 50)
            order_by = arguments.get("order_by", "createTime desc")

            space_info = await asyncio.to_thread(service.spaces().get(name=space_id).execute)
            space_name = space_info.get("displayName", "Unknown Space")

            list_params = {"parent": space_id, "pageSize": page_size, "orderBy": order_by}
            response = await asyncio.to_thread(service.spaces().messages().list(**list_params).execute)
            messages = response.get("messages", [])
            if not messages:
                return f"No messages found in space '{space_name}' (ID: {space_id})."

            output = [f"Messages from '{space_name}' (ID: {space_id}):\n"]
            for msg in messages:
                sender_obj = msg.get("sender", {})
                sender = sender_obj.get("displayName") or sender_obj.get("name", "Unknown Sender")
                create_time = msg.get("createTime", "Unknown Time")
                text_content = msg.get("text", "No text content")
                msg_name = msg.get("name", "")

                output.append(f"[{create_time}] {sender}:")
                output.append(f"  {text_content}")
                rich_links = _extract_rich_links(msg)
                for url in rich_links:
                    output.append(f"  [linked: {url}]")
                attachments = msg.get("attachment", [])
                for idx, att in enumerate(attachments):
                    att_name = att.get("contentName", "unnamed")
                    att_type = att.get("contentType", "unknown type")
                    att_resource = att.get("name", "")
                    output.append(f"  [attachment {idx}: {att_name} ({att_type})]")
                    if att_resource:
                        output.append(f"  Use download_chat_attachment(message_id='{msg_name}', attachment_index={idx}) to download")

                thread = msg.get("thread", {})
                if msg.get("threadReply") and thread.get("name"):
                    output.append(f"  [thread: {thread['name']}]")

                reactions = msg.get("emojiReactionSummaries", [])
                if reactions:
                    parts = []
                    for r in reactions:
                        emoji = r.get("emoji", {})
                        symbol = emoji.get("unicode", "")
                        if not symbol:
                            ce = emoji.get("customEmoji", {})
                            symbol = f":{ce.get('uid', '?')}:"
                        count = r.get("reactionCount", 0)
                        parts.append(f"{symbol}x{count}")
                    output.append(f"  [reactions: {', '.join(parts)}]")
                output.append(f"  (Message ID: {msg_name})\n")

            return "\n".join(output)

        elif tool_name == "search_messages":
            query = arguments.get("query")
            space_id = arguments.get("space_id")
            page_size = arguments.get("page_size", 25)

            search_desc = f'text "{query}"' if query else "all messages"

            if space_id:
                list_params = {"parent": space_id, "pageSize": page_size}
                response = await asyncio.to_thread(service.spaces().messages().list(**list_params).execute)
                messages = response.get("messages", [])
                context = f"space '{space_id}'"
            else:
                spaces_response = await asyncio.to_thread(service.spaces().list(pageSize=100).execute)
                spaces = spaces_response.get("spaces", [])
                spaces_to_search = spaces[:10]

                messages = []
                async def fetch_space_messages(space: dict):
                    try:
                        list_params = {"parent": space.get("name"), "pageSize": page_size}
                        res = await asyncio.to_thread(service.spaces().messages().list(**list_params).execute)
                        msgs = res.get("messages", [])
                        display = space.get("displayName", "Unknown")
                        for m in msgs:
                            m["_space_name"] = display
                        return msgs
                    except HttpError:
                        return []

                results = await asyncio.gather(*(fetch_space_messages(space) for space in spaces_to_search))
                for batch in results:
                    messages.extend(batch)
                context = "all accessible spaces"

            if query:
                query_lower = query.lower()
                messages = [m for m in messages if query_lower in (m.get("text") or "").lower()]

            if not messages:
                return f"No messages found matching '{search_desc}' in {context}."

            output = [f"Found {len(messages)} messages matching '{search_desc}' in {context}:"]
            for msg in messages:
                sender_obj = msg.get("sender", {})
                sender = sender_obj.get("displayName") or sender_obj.get("name", "Unknown Sender")
                create_time = msg.get("createTime", "Unknown Time")
                text_content = msg.get("text", "No text content")
                space_name = msg.get("_space_name", "Unknown Space")

                if len(text_content) > 100:
                    text_content = text_content[:100] + "..."

                rich_links = _extract_rich_links(msg)
                links_suffix = "".join(f" [linked: {url}]" for url in rich_links)
                attachments = msg.get("attachment", [])
                att_suffix = "".join(
                    f" [attachment: {a.get('contentName', 'unnamed')} ({a.get('contentType', 'unknown type')})]"
                    for a in attachments
                )
                output.append(f"- [{create_time}] {sender} in '{space_name}': {text_content}{links_suffix}{att_suffix}")

            return "\n".join(output)

        elif tool_name == "send_message":
            space_id = arguments.get("space_id")
            if not space_id:
                return "Missing required argument: space_id"
            message_text = arguments.get("message_text")
            if not message_text:
                return "Missing required argument: message_text"
            
            thread_key = arguments.get("thread_key")
            thread_name = arguments.get("thread_name")

            message_body = {"text": message_text}
            request_params = {"parent": space_id, "body": message_body}

            if thread_name:
                message_body["thread"] = {"name": thread_name}
                request_params["messageReplyOption"] = "REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD"
            elif thread_key:
                message_body["thread"] = {"threadKey": thread_key}
                request_params["messageReplyOption"] = "REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD"

            message = await asyncio.to_thread(service.spaces().messages().create(**request_params).execute)
            message_name = message.get("name", "")
            create_time = message.get("createTime", "")

            user_google_email = arguments.get("user_google_email", "Unknown User")
            return f"Message sent to space '{space_id}' by {user_google_email}. Message ID: {message_name}, Time: {create_time}"

        elif tool_name == "create_reaction":
            message_id = arguments.get("message_id")
            if not message_id:
                return "Missing required argument: message_id"
            emoji_unicode = arguments.get("emoji_unicode")
            if not emoji_unicode:
                return "Missing required argument: emoji_unicode"

            reaction = await asyncio.to_thread(
                service.spaces().messages().reactions().create(
                    parent=message_id,
                    body={"emoji": {"unicode": emoji_unicode}}
                ).execute
            )
            reaction_name = reaction.get("name", "")
            return f"Reacted with {emoji_unicode} on message {message_id}. Reaction ID: {reaction_name}"

        elif tool_name == "download_chat_attachment":
            message_id = arguments.get("message_id")
            if not message_id:
                return "Missing required argument: message_id"
            attachment_index = arguments.get("attachment_index", 0)

            msg = await asyncio.to_thread(service.spaces().messages().get(name=message_id).execute)
            attachments = msg.get("attachment", [])

            if not attachments:
                return f"No attachments found on message {message_id}."

            if attachment_index < 0 or attachment_index >= len(attachments):
                return (
                    f"Invalid attachment_index {attachment_index}. "
                    f"Message has {len(attachments)} attachment(s) (0-{len(attachments) - 1})."
                )

            att = attachments[attachment_index]
            filename = att.get("contentName", "attachment")
            content_type = att.get("contentType", "application/octet-stream")

            media_resource = att.get("attachmentDataRef", {}).get("resourceName", "")
            att_name = att.get("name", "")

            resource_name = media_resource or att_name
            if not resource_name:
                return f"No resource name available for attachment '{filename}'."

            download_url = f"https://chat.googleapis.com/v1/media/{resource_name}?alt=media"

            async with httpx.AsyncClient(follow_redirects=True) as client:
                resp = await client.get(
                    download_url,
                    headers={"Authorization": f"Bearer {access_token}"}
                )
                if resp.status_code != 200:
                    return f"Failed to download attachment '{filename}': HTTP {resp.status_code} from {download_url}\n{resp.text[:500]}"
                file_bytes = resp.content

            size_bytes = len(file_bytes)
            size_kb = size_bytes / 1024
            b64_preview = base64.urlsafe_b64encode(file_bytes).decode("utf-8")[:100]

            return "\n".join([
                f"Attachment downloaded: {filename} ({content_type})",
                f"Size: {size_kb:.1f} KB ({size_bytes} bytes)",
                "",
                "Stateless mode: File storage disabled.",
                f"Base64 preview: {b64_preview}..."
            ])

        else:
            return f"Unknown tool: {tool_name}"

    except HttpError as e:
        return f"Google API Error: {e}"
    except Exception as e:
        return f"Error executing {tool_name}: {str(e)}"
