import asyncio
import json
import logging
from typing import List, Optional, Dict, Any

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

logger = logging.getLogger(__name__)

TOOLS = [
    {
        "name": "create_form",
        "description": "Create a new Google Form.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "The form title"},
                "user_google_email": {"type": "string", "description": "The user's Google email address"},
                "description": {"type": "string", "description": "Form description"},
                "document_title": {"type": "string", "description": "Title shown in browser tab"}
            },
            "required": ["title", "user_google_email"]
        }
    },
    {
        "name": "get_form",
        "description": "Get a form's details including title, description, questions, and URLs.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "form_id": {"type": "string"},
                "user_google_email": {"type": "string"}
            },
            "required": ["form_id", "user_google_email"]
        }
    },
    {
        "name": "set_publish_settings",
        "description": "Update the publish settings of a form.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "form_id": {"type": "string"},
                "user_google_email": {"type": "string"},
                "is_published": {"type": "boolean", "default": True},
                "is_accepting_responses": {"type": "boolean", "default": True}
            },
            "required": ["form_id", "user_google_email"]
        }
    },
    {
        "name": "get_form_response",
        "description": "Get a single response from a form.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "form_id": {"type": "string"},
                "response_id": {"type": "string"},
                "user_google_email": {"type": "string"}
            },
            "required": ["form_id", "response_id", "user_google_email"]
        }
    },
    {
        "name": "list_form_responses",
        "description": "List responses submitted to a form.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "form_id": {"type": "string"},
                "user_google_email": {"type": "string"},
                "page_size": {"type": "integer", "default": 10},
                "page_token": {"type": "string"}
            },
            "required": ["form_id", "user_google_email"]
        }
    },
    {
        "name": "batch_update_form",
        "description": "Apply batch updates to a form.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "form_id": {"type": "string"},
                "user_google_email": {"type": "string"},
                "requests": {
                    "type": "array",
                    "items": {"type": "object"}
                }
            },
            "required": ["form_id", "requests", "user_google_email"]
        }
    }
]

def _extract_option_values(options: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return [option for option in options if option.get("value")]

def _get_question_type(question: Dict[str, Any]) -> str:
    choice_question = question.get("choiceQuestion")
    if choice_question:
        return choice_question.get("type", "CHOICE")
    text_question = question.get("textQuestion")
    if text_question:
        return "PARAGRAPH" if text_question.get("paragraph") else "TEXT"
    if "rowQuestion" in question:
        return "GRID_ROW"
    if "scaleQuestion" in question:
        return "SCALE"
    if "dateQuestion" in question:
        return "DATE"
    if "timeQuestion" in question:
        return "TIME"
    if "fileUploadQuestion" in question:
        return "FILE_UPLOAD"
    if "ratingQuestion" in question:
        return "RATING"
    return "QUESTION"

def _serialize_form_item(item: Dict[str, Any], index: int) -> Dict[str, Any]:
    serialized_item: Dict[str, Any] = {
        "index": index,
        "itemId": item.get("itemId"),
        "title": item.get("title", f"Question {index}"),
    }
    if item.get("description"):
        serialized_item["description"] = item["description"]

    if "questionItem" in item:
        question = item.get("questionItem", {}).get("question", {})
        serialized_item["type"] = _get_question_type(question)
        serialized_item["required"] = question.get("required", False)

        question_id = question.get("questionId")
        if question_id:
            serialized_item["questionId"] = question_id

        choice_question = question.get("choiceQuestion")
        if choice_question:
            serialized_item["options"] = _extract_option_values(
                choice_question.get("options", [])
            )
        return serialized_item

    if "questionGroupItem" in item:
        question_group = item.get("questionGroupItem", {})
        columns = _extract_option_values(
            question_group.get("grid", {}).get("columns", {}).get("options", [])
        )
        rows = []
        for question in question_group.get("questions", []):
            row: Dict[str, Any] = {
                "title": question.get("rowQuestion", {}).get("title", "")
            }
            row_question_id = question.get("questionId")
            if row_question_id:
                row["questionId"] = row_question_id
            row["required"] = question.get("required", False)
            rows.append(row)

        serialized_item["type"] = "GRID"
        serialized_item["grid"] = {"rows": rows, "columns": columns}
        return serialized_item

    if "pageBreakItem" in item:
        serialized_item["type"] = "PAGE_BREAK"
    elif "textItem" in item:
        serialized_item["type"] = "TEXT_ITEM"
    elif "imageItem" in item:
        serialized_item["type"] = "IMAGE"
    elif "videoItem" in item:
        serialized_item["type"] = "VIDEO"
    else:
        serialized_item["type"] = "UNKNOWN"

    return serialized_item

async def execute_tool(tool_name: str, arguments: dict, access_token: str) -> str:
    credentials = Credentials(token=access_token)
    service = build('forms', 'v1', credentials=credentials)

    user_google_email = arguments.get('user_google_email', 'unknown')

    if tool_name == 'create_form':
        title = arguments['title']
        description = arguments.get('description')
        document_title = arguments.get('document_title')

        form_body: Dict[str, Any] = {"info": {"title": title}}
        if description:
            form_body["info"]["description"] = description
        if document_title:
            form_body["info"]["document_title"] = document_title

        created_form = await asyncio.to_thread(
            service.forms().create(body=form_body).execute
        )

        form_id = created_form.get("formId")
        edit_url = f"https://docs.google.com/forms/d/{form_id}/edit"
        responder_url = created_form.get(
            "responderUri", f"https://docs.google.com/forms/d/{form_id}/viewform"
        )
        return f"Successfully created form '{created_form.get('info', {}).get('title', title)}' for {user_google_email}. Form ID: {form_id}. Edit URL: {edit_url}. Responder URL: {responder_url}"

    elif tool_name == 'get_form':
        form_id = arguments['form_id']
        form = await asyncio.to_thread(service.forms().get(formId=form_id).execute)

        form_info = form.get("info", {})
        title = form_info.get("title", "No Title")
        description = form_info.get("description", "No Description")
        document_title = form_info.get("documentTitle", title)

        edit_url = f"https://docs.google.com/forms/d/{form_id}/edit"
        responder_url = form.get(
            "responderUri", f"https://docs.google.com/forms/d/{form_id}/viewform"
        )

        items = form.get("items", [])
        serialized_items = [
            _serialize_form_item(item, i) for i, item in enumerate(items, 1)
        ]

        items_summary = []
        for serialized_item in serialized_items:
            item_index = serialized_item["index"]
            item_title = serialized_item.get("title", f"Item {item_index}")
            item_type = serialized_item.get("type", "UNKNOWN")
            required_text = " (Required)" if serialized_item.get("required") else ""
            items_summary.append(
                f"  {item_index}. {item_title} [{item_type}]{required_text}"
            )

        items_summary_text = (
            "\n".join(items_summary) if items_summary else "  No items found"
        )
        items_text = json.dumps(serialized_items, indent=2) if serialized_items else "[]"

        return f'''Form Details for {user_google_email}:
- Title: "{title}"
- Description: "{description}"
- Document Title: "{document_title}"
- Form ID: {form_id}
- Edit URL: {edit_url}
- Responder URL: {responder_url}
- Items ({len(items)} total):
{items_summary_text}
- Items (structured):
{items_text}'''

    elif tool_name == 'set_publish_settings':
        form_id = arguments['form_id']
        is_published = arguments.get('is_published', True)
        is_accepting_responses = arguments.get('is_accepting_responses', True)

        settings_body = {
            "publishSettings": {
                "publishState": {
                    "isPublished": is_published,
                    "isAcceptingResponses": is_accepting_responses,
                }
            },
            "updateMask": "publishState",
        }

        await asyncio.to_thread(
            service.forms().setPublishSettings(formId=form_id, body=settings_body).execute
        )
        return f"Successfully updated publish settings for form {form_id} for {user_google_email}. Published: {is_published}, Accepting responses: {is_accepting_responses}"

    elif tool_name == 'get_form_response':
        form_id = arguments['form_id']
        response_id = arguments['response_id']
        
        response = await asyncio.to_thread(
            service.forms().responses().get(formId=form_id, responseId=response_id).execute
        )

        resp_id = response.get("responseId", "Unknown")
        create_time = response.get("createTime", "Unknown")
        last_submitted_time = response.get("lastSubmittedTime", "Unknown")

        answers = response.get("answers", {})
        answer_details = []
        for question_id, answer_data in answers.items():
            question_response = answer_data.get("textAnswers", {}).get("answers", [])
            if question_response:
                answer_text = ", ".join([ans.get("value", "") for ans in question_response])
                answer_details.append(f"  Question ID {question_id}: {answer_text}")
            else:
                answer_details.append(f"  Question ID {question_id}: No answer provided")

        answers_text = "\n".join(answer_details) if answer_details else "  No answers found"

        return f'''Form Response Details for {user_google_email}:
- Form ID: {form_id}
- Response ID: {resp_id}
- Created: {create_time}
- Last Submitted: {last_submitted_time}
- Answers:
{answers_text}'''

    elif tool_name == 'list_form_responses':
        form_id = arguments['form_id']
        page_size = arguments.get('page_size', 10)
        page_token = arguments.get('page_token')

        params = {"formId": form_id, "pageSize": page_size}
        if page_token:
            params["pageToken"] = page_token

        responses_result = await asyncio.to_thread(
            service.forms().responses().list(**params).execute
        )

        responses = responses_result.get("responses", [])
        next_page_token = responses_result.get("nextPageToken")

        if not responses:
            return f"No responses found for form {form_id} for {user_google_email}."

        response_details = []
        for i, response in enumerate(responses, 1):
            resp_id = response.get("responseId", "Unknown")
            create_time = response.get("createTime", "Unknown")
            last_submitted_time = response.get("lastSubmittedTime", "Unknown")

            answers_count = len(response.get("answers", {}))
            response_details.append(
                f"  {i}. Response ID: {resp_id} | Created: {create_time} | Last Submitted: {last_submitted_time} | Answers: {answers_count}"
            )

        pagination_info = (
            f"\nNext page token: {next_page_token}"
            if next_page_token
            else "\nNo more pages."
        )

        return f'''Form Responses for {user_google_email}:
- Form ID: {form_id}
- Total responses returned: {len(responses)}
- Responses:
{chr(10).join(response_details)}{pagination_info}'''

    elif tool_name == 'batch_update_form':
        form_id = arguments['form_id']
        requests = arguments['requests']

        body = {"requests": requests}

        result = await asyncio.to_thread(
            service.forms().batchUpdate(formId=form_id, body=body).execute
        )

        replies = result.get("replies", [])

        confirmation_message = f"""Batch Update Completed:
- Form ID: {form_id}
- URL: https://docs.google.com/forms/d/{form_id}/edit
- Requests Applied: {len(requests)}
- Replies Received: {len(replies)}"""

        if replies:
            confirmation_message += "\n\nUpdate Results:"
            for i, reply in enumerate(replies, 1):
                if "createItem" in reply:
                    item_id = reply["createItem"].get("itemId", "Unknown")
                    question_ids = reply["createItem"].get("questionId", [])
                    question_info = (
                        f" (Question IDs: {', '.join(question_ids)})"
                        if question_ids
                        else ""
                    )
                    confirmation_message += (
                        f"\n  Request {i}: Created item {item_id}{question_info}"
                    )
                else:
                    confirmation_message += f"\n  Request {i}: Operation completed"

        return confirmation_message

    else:
        raise ValueError(f"Unknown tool name: {tool_name}")
