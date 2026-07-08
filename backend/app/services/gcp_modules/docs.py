"""Google Docs MCP module adaptation"""

import asyncio
import logging
import inspect
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials

from .docs_impl.core.server import server
import app.services.gcp_modules.docs_impl.docs_tools as dt

logger = logging.getLogger(__name__)

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_docs",
            "description": "Searches for Google Docs by name using Drive API (mimeType filter).",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_google_email": {
                        "type": "string",
                        "description": "Parameter user_google_email"
                    },
                    "query": {
                        "type": "string",
                        "description": "Parameter query"
                    },
                    "page_size": {
                        "type": "integer",
                        "description": "Parameter page_size"
                    }
                },
                "required": [
                    "user_google_email",
                    "query"
                ]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_doc_content",
            "description": "Retrieves content of a Google Doc or a Drive file (like .docx) identified by document_id.",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_google_email": {
                        "type": "string",
                        "description": "Parameter user_google_email"
                    },
                    "document_id": {
                        "type": "string",
                        "description": "Parameter document_id"
                    },
                    "suggestions_view_mode": {
                        "type": "string",
                        "description": "Parameter suggestions_view_mode"
                    }
                },
                "required": [
                    "user_google_email",
                    "document_id"
                ]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_docs_in_folder",
            "description": "Lists Google Docs within a specific Drive folder.",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_google_email": {
                        "type": "string",
                        "description": "Parameter user_google_email"
                    },
                    "folder_id": {
                        "type": "string",
                        "description": "Parameter folder_id"
                    },
                    "page_size": {
                        "type": "integer",
                        "description": "Parameter page_size"
                    }
                },
                "required": [
                    "user_google_email"
                ]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "create_doc",
            "description": "Creates a new Google Doc and optionally inserts initial content.",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_google_email": {
                        "type": "string",
                        "description": "Parameter user_google_email"
                    },
                    "title": {
                        "type": "string",
                        "description": "Parameter title"
                    },
                    "content": {
                        "type": "string",
                        "description": "Parameter content"
                    }
                },
                "required": [
                    "user_google_email",
                    "title"
                ]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "modify_doc_text",
            "description": "Modifies text in a Google Doc - can insert/replace text and/or apply formatting in a single operation.",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_google_email": {
                        "type": "string",
                        "description": "Parameter user_google_email"
                    },
                    "document_id": {
                        "type": "string",
                        "description": "Parameter document_id"
                    },
                    "start_index": {
                        "type": "integer",
                        "description": "Parameter start_index"
                    },
                    "end_index": {
                        "type": "integer",
                        "description": "Parameter end_index"
                    },
                    "text": {
                        "type": "string",
                        "description": "Parameter text"
                    },
                    "tab_id": {
                        "type": "string",
                        "description": "Parameter tab_id"
                    },
                    "segment_id": {
                        "type": "string",
                        "description": "Parameter segment_id"
                    },
                    "end_of_segment": {
                        "type": "boolean",
                        "description": "Parameter end_of_segment"
                    },
                    "bold": {
                        "type": "boolean",
                        "description": "Parameter bold"
                    },
                    "italic": {
                        "type": "boolean",
                        "description": "Parameter italic"
                    },
                    "underline": {
                        "type": "boolean",
                        "description": "Parameter underline"
                    },
                    "strikethrough": {
                        "type": "boolean",
                        "description": "Parameter strikethrough"
                    },
                    "font_size": {
                        "type": "integer",
                        "description": "Parameter font_size"
                    },
                    "font_family": {
                        "type": "string",
                        "description": "Parameter font_family"
                    },
                    "font_weight": {
                        "type": "integer",
                        "description": "Parameter font_weight"
                    },
                    "text_color": {
                        "type": "string",
                        "description": "Parameter text_color"
                    },
                    "background_color": {
                        "type": "string",
                        "description": "Parameter background_color"
                    },
                    "link_url": {
                        "type": "string",
                        "description": "Parameter link_url"
                    },
                    "clear_link": {
                        "type": "boolean",
                        "description": "Parameter clear_link"
                    },
                    "baseline_offset": {
                        "type": "string",
                        "description": "Parameter baseline_offset"
                    },
                    "small_caps": {
                        "type": "boolean",
                        "description": "Parameter small_caps"
                    }
                },
                "required": [
                    "user_google_email",
                    "document_id",
                    "start_index"
                ]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "find_and_replace_doc",
            "description": "Finds and replaces text throughout a Google Doc. No index calculation required.",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_google_email": {
                        "type": "string",
                        "description": "Parameter user_google_email"
                    },
                    "document_id": {
                        "type": "string",
                        "description": "Parameter document_id"
                    },
                    "find_text": {
                        "type": "string",
                        "description": "Parameter find_text"
                    },
                    "replace_text": {
                        "type": "string",
                        "description": "Parameter replace_text"
                    },
                    "match_case": {
                        "type": "boolean",
                        "description": "Parameter match_case"
                    },
                    "tab_id": {
                        "type": "string",
                        "description": "Parameter tab_id"
                    }
                },
                "required": [
                    "user_google_email",
                    "document_id",
                    "find_text",
                    "replace_text"
                ]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "insert_doc_elements",
            "description": "Inserts structural elements like tables, lists, or page breaks into a Google Doc.",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_google_email": {
                        "type": "string",
                        "description": "Parameter user_google_email"
                    },
                    "document_id": {
                        "type": "string",
                        "description": "Parameter document_id"
                    },
                    "element_type": {
                        "type": "string",
                        "description": "Parameter element_type"
                    },
                    "index": {
                        "type": "integer",
                        "description": "Parameter index"
                    },
                    "rows": {
                        "type": "integer",
                        "description": "Parameter rows"
                    },
                    "columns": {
                        "type": "integer",
                        "description": "Parameter columns"
                    },
                    "list_type": {
                        "type": "string",
                        "description": "Parameter list_type"
                    },
                    "text": {
                        "type": "string",
                        "description": "Parameter text"
                    }
                },
                "required": [
                    "user_google_email",
                    "document_id",
                    "element_type",
                    "index"
                ]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "insert_doc_image",
            "description": "Inserts an image into a Google Doc from Drive or a URL.",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_google_email": {
                        "type": "string",
                        "description": "Parameter user_google_email"
                    },
                    "document_id": {
                        "type": "string",
                        "description": "Parameter document_id"
                    },
                    "image_source": {
                        "type": "string",
                        "description": "Parameter image_source"
                    },
                    "index": {
                        "type": "integer",
                        "description": "Parameter index"
                    },
                    "width": {
                        "type": "integer",
                        "description": "Parameter width"
                    },
                    "height": {
                        "type": "integer",
                        "description": "Parameter height"
                    }
                },
                "required": [
                    "user_google_email",
                    "document_id",
                    "image_source",
                    "index"
                ]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "update_doc_headers_footers",
            "description": "Safely creates or updates header/footer text in a Google Doc.",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_google_email": {
                        "type": "string",
                        "description": "Parameter user_google_email"
                    },
                    "document_id": {
                        "type": "string",
                        "description": "Parameter document_id"
                    },
                    "section_type": {
                        "type": "string",
                        "description": "Parameter section_type"
                    },
                    "content": {
                        "type": "string",
                        "description": "Parameter content"
                    },
                    "header_footer_type": {
                        "type": "string",
                        "description": "Parameter header_footer_type"
                    }
                },
                "required": [
                    "user_google_email",
                    "document_id",
                    "section_type",
                    "content"
                ]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "batch_update_doc",
            "description": "Executes multiple low-level document operations in a single atomic batch update.",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_google_email": {
                        "type": "string",
                        "description": "Parameter user_google_email"
                    },
                    "document_id": {
                        "type": "string",
                        "description": "Parameter document_id"
                    },
                    "operations": {
                        "type": "string",
                        "description": "Parameter operations"
                    }
                },
                "required": [
                    "user_google_email",
                    "document_id",
                    "operations"
                ]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "inspect_doc_structure",
            "description": "Essential tool for finding safe insertion points and understanding document structure.",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_google_email": {
                        "type": "string",
                        "description": "Parameter user_google_email"
                    },
                    "document_id": {
                        "type": "string",
                        "description": "Parameter document_id"
                    },
                    "detailed": {
                        "type": "boolean",
                        "description": "Parameter detailed"
                    },
                    "tab_id": {
                        "type": "string",
                        "description": "Parameter tab_id"
                    }
                },
                "required": [
                    "user_google_email",
                    "document_id"
                ]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "debug_docs_runtime_info",
            "description": "Return runtime/source information for diagnosing stale MCP server instances.",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_google_email": {
                        "type": "string",
                        "description": "Parameter user_google_email"
                    }
                },
                "required": [
                    "user_google_email"
                ]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "create_table_with_data",
            "description": "Creates a table and populates it with data in one reliable operation.",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_google_email": {
                        "type": "string",
                        "description": "Parameter user_google_email"
                    },
                    "document_id": {
                        "type": "string",
                        "description": "Parameter document_id"
                    },
                    "table_data": {
                        "type": "array",
                        "description": "Parameter table_data"
                    },
                    "index": {
                        "type": "integer",
                        "description": "Parameter index"
                    },
                    "bold_headers": {
                        "type": "boolean",
                        "description": "Parameter bold_headers"
                    },
                    "tab_id": {
                        "type": "string",
                        "description": "Parameter tab_id"
                    }
                },
                "required": [
                    "user_google_email",
                    "document_id",
                    "table_data",
                    "index"
                ]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "debug_table_structure",
            "description": "ESSENTIAL DEBUGGING TOOL - Use this whenever tables don't work as expected.",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_google_email": {
                        "type": "string",
                        "description": "Parameter user_google_email"
                    },
                    "document_id": {
                        "type": "string",
                        "description": "Parameter document_id"
                    },
                    "table_index": {
                        "type": "integer",
                        "description": "Parameter table_index"
                    }
                },
                "required": [
                    "user_google_email",
                    "document_id"
                ]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "export_doc_to_pdf",
            "description": "Exports a Google Doc to PDF format and saves it to Google Drive.",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_google_email": {
                        "type": "string",
                        "description": "Parameter user_google_email"
                    },
                    "document_id": {
                        "type": "string",
                        "description": "Parameter document_id"
                    },
                    "pdf_filename": {
                        "type": "string",
                        "description": "Parameter pdf_filename"
                    },
                    "folder_id": {
                        "type": "string",
                        "description": "Parameter folder_id"
                    }
                },
                "required": [
                    "user_google_email",
                    "document_id"
                ]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "update_paragraph_style",
            "description": "Apply paragraph-level formatting, heading styles, and/or list formatting to a range in a Google Doc.",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_google_email": {
                        "type": "string",
                        "description": "Parameter user_google_email"
                    },
                    "document_id": {
                        "type": "string",
                        "description": "Parameter document_id"
                    },
                    "start_index": {
                        "type": "integer",
                        "description": "Parameter start_index"
                    },
                    "end_index": {
                        "type": "integer",
                        "description": "Parameter end_index"
                    },
                    "heading_level": {
                        "type": "integer",
                        "description": "Parameter heading_level"
                    },
                    "alignment": {
                        "type": "string",
                        "description": "Parameter alignment"
                    },
                    "line_spacing": {
                        "type": "number",
                        "description": "Parameter line_spacing"
                    },
                    "indent_first_line": {
                        "type": "number",
                        "description": "Parameter indent_first_line"
                    },
                    "indent_start": {
                        "type": "number",
                        "description": "Parameter indent_start"
                    },
                    "indent_end": {
                        "type": "number",
                        "description": "Parameter indent_end"
                    },
                    "space_above": {
                        "type": "number",
                        "description": "Parameter space_above"
                    },
                    "space_below": {
                        "type": "number",
                        "description": "Parameter space_below"
                    },
                    "named_style_type": {
                        "type": "string",
                        "description": "Parameter named_style_type"
                    },
                    "tab_id": {
                        "type": "string",
                        "description": "Parameter tab_id"
                    },
                    "segment_id": {
                        "type": "string",
                        "description": "Parameter segment_id"
                    },
                    "direction": {
                        "type": "string",
                        "description": "Parameter direction"
                    },
                    "keep_lines_together": {
                        "type": "boolean",
                        "description": "Parameter keep_lines_together"
                    },
                    "keep_with_next": {
                        "type": "boolean",
                        "description": "Parameter keep_with_next"
                    },
                    "avoid_widow_and_orphan": {
                        "type": "boolean",
                        "description": "Parameter avoid_widow_and_orphan"
                    },
                    "page_break_before": {
                        "type": "boolean",
                        "description": "Parameter page_break_before"
                    },
                    "spacing_mode": {
                        "type": "string",
                        "description": "Parameter spacing_mode"
                    },
                    "shading_color": {
                        "type": "string",
                        "description": "Parameter shading_color"
                    },
                    "list_type": {
                        "type": "string",
                        "description": "Parameter list_type"
                    },
                    "list_nesting_level": {
                        "type": "integer",
                        "description": "Parameter list_nesting_level"
                    },
                    "bullet_preset": {
                        "type": "string",
                        "description": "Parameter bullet_preset"
                    }
                },
                "required": [
                    "user_google_email",
                    "document_id",
                    "start_index",
                    "end_index"
                ]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_doc_as_markdown",
            "description": "Reads a Google Doc and returns it as clean Markdown with optional comment context.",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_google_email": {
                        "type": "string",
                        "description": "Parameter user_google_email"
                    },
                    "document_id": {
                        "type": "string",
                        "description": "Parameter document_id"
                    },
                    "include_comments": {
                        "type": "boolean",
                        "description": "Parameter include_comments"
                    },
                    "comment_mode": {
                        "type": "string",
                        "description": "Parameter comment_mode"
                    },
                    "include_resolved": {
                        "type": "boolean",
                        "description": "Parameter include_resolved"
                    },
                    "suggestions_view_mode": {
                        "type": "string",
                        "description": "Parameter suggestions_view_mode"
                    }
                },
                "required": [
                    "user_google_email",
                    "document_id"
                ]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "manage_doc_tab",
            "description": "Manage document tabs: create, rename, delete, or populate from Markdown.",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_google_email": {
                        "type": "string",
                        "description": "Parameter user_google_email"
                    },
                    "document_id": {
                        "type": "string",
                        "description": "Parameter document_id"
                    },
                    "action": {
                        "type": "string",
                        "description": "Parameter action"
                    },
                    "tab_id": {
                        "type": "string",
                        "description": "Parameter tab_id"
                    },
                    "title": {
                        "type": "string",
                        "description": "Parameter title"
                    },
                    "index": {
                        "type": "integer",
                        "description": "Parameter index"
                    },
                    "parent_tab_id": {
                        "type": "string",
                        "description": "Parameter parent_tab_id"
                    },
                    "markdown_text": {
                        "type": "string",
                        "description": "Parameter markdown_text"
                    },
                    "replace_existing": {
                        "type": "boolean",
                        "description": "Parameter replace_existing"
                    }
                },
                "required": [
                    "user_google_email",
                    "document_id",
                    "action"
                ]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_comments",
            "description": "List all comments on an item.",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_google_email": {
                        "type": "string",
                        "description": "Parameter user_google_email"
                    },
                    "kwargs": {
                        "type": "string",
                        "description": "Parameter kwargs"
                    }
                },
                "required": [
                    "user_google_email",
                    "kwargs"
                ]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "manage_comment",
            "description": "Create, reply to, or resolve a comment.",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_google_email": {
                        "type": "string",
                        "description": "Parameter user_google_email"
                    },
                    "action": {
                        "type": "string",
                        "description": "Parameter action"
                    },
                    "comment_content": {
                        "type": "string",
                        "description": "Parameter comment_content"
                    },
                    "comment_id": {
                        "type": "string",
                        "description": "Parameter comment_id"
                    },
                    "kwargs": {
                        "type": "string",
                        "description": "Parameter kwargs"
                    }
                },
                "required": [
                    "user_google_email",
                    "action",
                    "kwargs"
                ]
            }
        }
    }
]

async def execute_tool(tool_name: str, arguments: dict, access_token: str) -> str:
    creds = Credentials(access_token)
    docs_service = build("docs", "v1", credentials=creds)
    drive_service = build("drive", "v3", credentials=creds)

    func = server.tools.get(tool_name)
    if not func:
        return f"Unknown tool: {tool_name}"

    # Inject services
    sig = inspect.signature(func)
    kwargs = dict(arguments)
    if "service" in sig.parameters:
        kwargs["service"] = docs_service if tool_name != "search_docs" and tool_name != "list_docs_in_folder" else drive_service
    if "docs_service" in sig.parameters:
        kwargs["docs_service"] = docs_service
    if "drive_service" in sig.parameters:
        kwargs["drive_service"] = drive_service

    try:
        result = await func(**kwargs)
        return str(result)
    except Exception as e:
        logger.error(f"Error executing {tool_name}: {e}")
        return f"Error executing {tool_name}: {e}"
