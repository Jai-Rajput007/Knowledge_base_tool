import asyncio
import json
from typing import Any, Dict, List

import googleapiclient.discovery
from google.oauth2.credentials import Credentials


TOOLS = [
    {
        "name": "create_presentation",
        "description": "Create a new Google Slides presentation.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "user_google_email": {"type": "string"},
                "title": {"type": "string", "default": "Untitled Presentation"}
            },
            "required": ["user_google_email"]
        }
    },
    {
        "name": "get_presentation",
        "description": "Get presentation metadata: title, slide count, and slide object IDs.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "user_google_email": {"type": "string"},
                "presentation_id": {"type": "string"}
            },
            "required": ["user_google_email", "presentation_id"]
        }
    },
    {
        "name": "batch_update_presentation",
        "description": "Apply batch update requests to a presentation. This is the primary tool for modifying slides.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "user_google_email": {"type": "string"},
                "presentation_id": {"type": "string"},
                "requests": {
                    "type": "array",
                    "items": {"type": "object"},
                    "description": "List of Slides API request objects"
                }
            },
            "required": ["user_google_email", "presentation_id", "requests"]
        }
    },
    {
        "name": "get_page",
        "description": "Get details about a specific slide, including its elements and layout.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "user_google_email": {"type": "string"},
                "presentation_id": {"type": "string"},
                "page_object_id": {"type": "string"}
            },
            "required": ["user_google_email", "presentation_id", "page_object_id"]
        }
    },
    {
        "name": "get_page_thumbnail",
        "description": "Generate a thumbnail URL for a slide.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "user_google_email": {"type": "string"},
                "presentation_id": {"type": "string"},
                "page_object_id": {"type": "string"},
                "thumbnail_size": {"type": "string", "enum": ["LARGE", "MEDIUM", "SMALL"], "default": "MEDIUM"}
            },
            "required": ["user_google_email", "presentation_id", "page_object_id"]
        }
    },
    {
        "name": "list_presentation_comments",
        "description": "List all comments on a presentation.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "user_google_email": {"type": "string"},
                "presentation_id": {"type": "string"}
            },
            "required": ["user_google_email", "presentation_id"]
        }
    },
    {
        "name": "manage_presentation_comment",
        "description": "Create, reply to, or resolve a comment.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "user_google_email": {"type": "string"},
                "presentation_id": {"type": "string"},
                "action": {"type": "string", "enum": ["create", "reply", "resolve"]},
                "comment_content": {"type": "string"},
                "comment_id": {"type": "string"}
            },
            "required": ["user_google_email", "presentation_id", "action"]
        }
    }
]

def _extract_shape_text(shape: Dict[str, Any]) -> str:
    if not shape:
        return ""
    text = shape.get("text")
    if not text:
        return ""
    runs = []
    for text_element in text.get("textElements", []):
        text_run = text_element.get("textRun")
        if text_run and text_run.get("content"):
            runs.append((text_element.get("startIndex", 0), text_run["content"]))
    if not runs:
        return ""
    runs.sort(key=lambda r: r[0])
    return "".join(r[1] for r in runs)

def _iter_text_bearing_elements(elements):
    for element in elements or []:
        if "shape" in element:
            full_text = _extract_shape_text(element["shape"])
            if full_text:
                yield full_text
        elif "elementGroup" in element:
            children = element["elementGroup"].get("children", [])
            yield from _iter_text_bearing_elements(children)

def _describe_elements(elements, indent="  "):
    info = []
    for element in elements or []:
        element_id = element.get("objectId", "Unknown")
        if "shape" in element:
            shape_type = element["shape"].get("shapeType", "Unknown")
            full_text = _extract_shape_text(element["shape"])
            if full_text:
                lines = [line.rstrip() for line in full_text.split("\n") if line.strip()]
                if len(lines) == 1:
                    info.append(f'{indent}Shape: ID {element_id}, Type: {shape_type}, Text: "{lines[0]}"')
                else:
                    info.append(f"{indent}Shape: ID {element_id}, Type: {shape_type}, Text:")
                    info.extend(f"{indent}  > {line}" for line in lines)
            else:
                info.append(f"{indent}Shape: ID {element_id}, Type: {shape_type}")
        elif "table" in element:
            table = element["table"]
            rows = table.get("rows", 0)
            cols = table.get("columns", 0)
            info.append(f"{indent}Table: ID {element_id}, Size: {rows}x{cols}")
        elif "line" in element:
            line_type = element["line"].get("lineType", "Unknown")
            info.append(f"{indent}Line: ID {element_id}, Type: {line_type}")
        elif "elementGroup" in element:
            children = element["elementGroup"].get("children", [])
            info.append(f"{indent}Group: ID {element_id}, Children: {len(children)}")
            info.extend(_describe_elements(children, indent + "  "))
        else:
            info.append(f"{indent}Element: ID {element_id}, Type: Unknown")
    return info

async def execute_tool(tool_name: str, arguments: dict, access_token: str) -> str:
    creds = Credentials(access_token)
    
    if tool_name in ["list_presentation_comments", "manage_presentation_comment"]:
        service = googleapiclient.discovery.build("drive", "v3", credentials=creds)
    else:
        service = googleapiclient.discovery.build("slides", "v1", credentials=creds)
        
    user_google_email = arguments.get("user_google_email")
    
    if tool_name == "create_presentation":
        title = arguments.get("title", "Untitled Presentation")
        body = {"title": title}
        result = await asyncio.to_thread(service.presentations().create(body=body).execute)
        
        presentation_id = result.get("presentationId")
        presentation_url = f"https://docs.google.com/presentation/d/{presentation_id}/edit"
        return f"Presentation Created Successfully:\n- Title: {title}\n- Presentation ID: {presentation_id}\n- URL: {presentation_url}\n- Slides: {len(result.get('slides', []))} slide(s) created"
        
    elif tool_name == "get_presentation":
        presentation_id = arguments["presentation_id"]
        result = await asyncio.to_thread(service.presentations().get(presentationId=presentation_id).execute)
        
        title = result.get("title", "Untitled")
        slides = result.get("slides", [])
        page_size = result.get("pageSize", {})
        
        slides_info = []
        for i, slide in enumerate(slides, 1):
            slide_id = slide.get("objectId", "Unknown")
            page_elements = slide.get("pageElements", [])
            slide_text = ""
            try:
                texts_from_elements = list(_iter_text_bearing_elements(page_elements))
                slide_text = "\n".join(texts_from_elements)
                slide_text_rows = [row for row in slide_text.split("\n") if row.strip()]
                if slide_text_rows:
                    slide_text = "\n" + "\n".join(["    > " + row for row in slide_text_rows])
            except Exception as e:
                slide_text = f"<failed to extract text: {e}>"
                
            slides_info.append(f"  Slide {i}: ID {slide_id}, {len(page_elements)} element(s), text: {slide_text if slide_text else 'empty'}")
            
        res = f"Presentation Details:\n- Title: {title}\n- Presentation ID: {presentation_id}\n- URL: https://docs.google.com/presentation/d/{presentation_id}/edit\n- Total Slides: {len(slides)}"
        if slides_info:
            res += "\n\nSlides Breakdown:\n" + "\n".join(slides_info)
        else:
            res += "\n\nSlides Breakdown:\n  No slides found"
        return res
        
    elif tool_name == "batch_update_presentation":
        presentation_id = arguments["presentation_id"]
        requests = arguments["requests"]
        body = {"requests": requests}
        result = await asyncio.to_thread(
            service.presentations().batchUpdate(presentationId=presentation_id, body=body).execute
        )
        
        replies = result.get("replies", [])
        res = f"Batch Update Completed:\n- Presentation ID: {presentation_id}\n- Requests Applied: {len(requests)}\n- Replies Received: {len(replies)}"
        if replies:
            res += "\n\nUpdate Results:"
            for i, reply in enumerate(replies, 1):
                if "createSlide" in reply:
                    res += f"\n  Request {i}: Created slide with ID {reply['createSlide'].get('objectId', 'Unknown')}"
                elif "createShape" in reply:
                    res += f"\n  Request {i}: Created shape with ID {reply['createShape'].get('objectId', 'Unknown')}"
                else:
                    res += f"\n  Request {i}: Operation completed"
        return res
        
    elif tool_name == "get_page":
        presentation_id = arguments["presentation_id"]
        page_object_id = arguments["page_object_id"]
        result = await asyncio.to_thread(
            service.presentations().pages().get(presentationId=presentation_id, pageObjectId=page_object_id).execute
        )
        
        page_type = result.get("pageType", "Unknown")
        page_elements = result.get("pageElements", [])
        elements_info = _describe_elements(page_elements)
        
        res = f"Page Details:\n- Presentation ID: {presentation_id}\n- Page ID: {page_object_id}\n- Page Type: {page_type}\n- Total Elements: {len(page_elements)}"
        if elements_info:
            res += "\n\nPage Elements:\n" + "\n".join(elements_info)
        else:
            res += "\n\nPage Elements:\n  No elements found"
        return res
        
    elif tool_name == "get_page_thumbnail":
        presentation_id = arguments["presentation_id"]
        page_object_id = arguments["page_object_id"]
        thumbnail_size = arguments.get("thumbnail_size", "MEDIUM")
        result = await asyncio.to_thread(
            service.presentations().pages().getThumbnail(
                presentationId=presentation_id,
                pageObjectId=page_object_id,
                thumbnailProperties_thumbnailSize=thumbnail_size,
                thumbnailProperties_mimeType="PNG"
            ).execute
        )
        thumbnail_url = result.get("contentUrl", "")
        return f"Thumbnail Generated:\n- Presentation ID: {presentation_id}\n- Page ID: {page_object_id}\n- Thumbnail Size: {thumbnail_size}\n- Thumbnail URL: {thumbnail_url}"

    elif tool_name == "list_presentation_comments":
        presentation_id = arguments["presentation_id"]
        result = await asyncio.to_thread(
            service.comments().list(fileId=presentation_id, fields="comments(id,content,author,replies)").execute
        )
        comments = result.get("comments", [])
        if not comments:
            return "No comments found on this presentation."
        
        output = [f"Found {len(comments)} comment(s):"]
        for comment in comments:
            author = comment.get("author", {}).get("displayName", "Unknown")
            output.append(f"\n- Comment ID: {comment.get('id')}")
            output.append(f"  Author: {author}")
            output.append(f"  Content: {comment.get('content')}")
            replies = comment.get("replies", [])
            for reply in replies:
                r_author = reply.get("author", {}).get("displayName", "Unknown")
                output.append(f"    -> Reply from {r_author}: {reply.get('content')}")
        return "\n".join(output)

    elif tool_name == "manage_presentation_comment":
        presentation_id = arguments["presentation_id"]
        action = arguments["action"]
        comment_id = arguments.get("comment_id")
        content = arguments.get("comment_content")
        
        if action == "create":
            if not content:
                return "Error: comment_content is required for create action."
            body = {"content": content}
            result = await asyncio.to_thread(
                service.comments().create(fileId=presentation_id, body=body, fields="id,content").execute
            )
            return f"Comment created successfully with ID: {result.get('id')}"
            
        elif action == "reply":
            if not comment_id or not content:
                return "Error: comment_id and comment_content are required for reply action."
            body = {"content": content}
            result = await asyncio.to_thread(
                service.replies().create(fileId=presentation_id, commentId=comment_id, body=body, fields="id,content").execute
            )
            return f"Reply created successfully with ID: {result.get('id')}"
            
        elif action == "resolve":
            if not comment_id:
                return "Error: comment_id is required for resolve action."
            body = {"resolved": True}
            result = await asyncio.to_thread(
                service.comments().update(fileId=presentation_id, commentId=comment_id, body=body, fields="id,resolved").execute
            )
            return f"Comment {comment_id} resolved successfully."
            
        else:
            raise ValueError(f"Unknown action: {action}")
            
    else:
        raise ValueError(f"Unknown tool: {tool_name}")
