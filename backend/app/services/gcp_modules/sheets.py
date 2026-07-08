import asyncio
import json
import logging
import re
import os
import copy
from typing import List, Optional, Union, Dict, Any

from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials

logger = logging.getLogger(__name__)

class UserInputError(Exception):
    pass

def ToolAnnotations(*args, **kwargs):
    return None

def create_comment_tools(*args, **kwargs):
    return {'list_comments': None, 'manage_comment': None}

StringList = List[str]

TOOLS = json.loads('''[
    {
        "name": "list_spreadsheets",
        "description": "List spreadsheets the user has access to (via Drive).",
        "parameters": {
            "type": "object",
            "properties": {
                "user_google_email": {
                    "type": "string"
                },
                "max_results": {
                    "type": "integer",
                    "default": 25
                }
            },
            "required": [
                "user_google_email"
            ]
        }
    },
    {
        "name": "get_spreadsheet_info",
        "description": "Get spreadsheet metadata: title, locale, and list of sheets.",
        "parameters": {
            "type": "object",
            "properties": {
                "user_google_email": {
                    "type": "string"
                },
                "spreadsheet_id": {
                    "type": "string"
                }
            },
            "required": [
                "user_google_email",
                "spreadsheet_id"
            ]
        }
    },
    {
        "name": "read_sheet_values",
        "description": "Read values from a range in a spreadsheet.",
        "parameters": {
            "type": "object",
            "properties": {
                "user_google_email": {
                    "type": "string"
                },
                "spreadsheet_id": {
                    "type": "string"
                },
                "range_name": {
                    "type": "string",
                    "default": "A1:Z1000"
                },
                "include_hyperlinks": {
                    "type": "boolean",
                    "default": false
                },
                "include_notes": {
                    "type": "boolean",
                    "default": false
                }
            },
            "required": [
                "user_google_email",
                "spreadsheet_id"
            ]
        }
    },
    {
        "name": "modify_sheet_values",
        "description": "Write, update, or clear values in a range.",
        "parameters": {
            "type": "object",
            "properties": {
                "user_google_email": {
                    "type": "string"
                },
                "spreadsheet_id": {
                    "type": "string"
                },
                "range_name": {
                    "type": "string"
                },
                "values": {
                    "type": [
                        "array",
                        "string"
                    ]
                },
                "value_input_option": {
                    "type": "string",
                    "default": "USER_ENTERED"
                },
                "clear_values": {
                    "type": "boolean",
                    "default": false
                }
            },
            "required": [
                "user_google_email",
                "spreadsheet_id",
                "range_name"
            ]
        }
    },
    {
        "name": "create_spreadsheet",
        "description": "Create a new Google Spreadsheet.",
        "parameters": {
            "type": "object",
            "properties": {
                "user_google_email": {
                    "type": "string"
                },
                "title": {
                    "type": "string"
                },
                "sheet_names": {
                    "type": "array",
                    "items": {
                        "type": "string"
                    }
                }
            },
            "required": [
                "user_google_email",
                "title"
            ]
        }
    },
    {
        "name": "create_sheet",
        "description": "Add a new sheet (tab) to an existing spreadsheet.",
        "parameters": {
            "type": "object",
            "properties": {
                "user_google_email": {
                    "type": "string"
                },
                "spreadsheet_id": {
                    "type": "string"
                },
                "sheet_name": {
                    "type": "string"
                }
            },
            "required": [
                "user_google_email",
                "spreadsheet_id",
                "sheet_name"
            ]
        }
    },
    {
        "name": "move_sheet_rows",
        "description": "Move rows from one sheet to another within the same spreadsheet.",
        "parameters": {
            "type": "object",
            "properties": {
                "user_google_email": {
                    "type": "string"
                },
                "spreadsheet_id": {
                    "type": "string"
                },
                "source_sheet": {
                    "type": "string"
                },
                "start_row": {
                    "type": "integer"
                },
                "end_row": {
                    "type": "integer"
                },
                "destination_sheet": {
                    "type": "string"
                }
            },
            "required": [
                "user_google_email",
                "spreadsheet_id",
                "source_sheet",
                "start_row",
                "end_row",
                "destination_sheet"
            ]
        }
    },
    {
        "name": "format_sheet_range",
        "description": "Apply visual formatting to a range.",
        "parameters": {
            "type": "object",
            "properties": {
                "user_google_email": {
                    "type": "string"
                },
                "spreadsheet_id": {
                    "type": "string"
                },
                "range_name": {
                    "type": "string"
                },
                "background_color": {
                    "type": "string"
                },
                "text_color": {
                    "type": "string"
                },
                "number_format_type": {
                    "type": "string"
                },
                "number_format_pattern": {
                    "type": "string"
                },
                "wrap_strategy": {
                    "type": "string"
                },
                "horizontal_alignment": {
                    "type": "string"
                },
                "vertical_alignment": {
                    "type": "string"
                },
                "bold": {
                    "type": "boolean"
                },
                "italic": {
                    "type": "boolean"
                },
                "font_size": {
                    "type": "integer"
                }
            },
            "required": [
                "user_google_email",
                "spreadsheet_id",
                "range_name"
            ]
        }
    },
    {
        "name": "manage_conditional_formatting",
        "description": "Add, update, or delete conditional formatting rules.",
        "parameters": {
            "type": "object",
            "properties": {
                "user_google_email": {
                    "type": "string"
                },
                "spreadsheet_id": {
                    "type": "string"
                },
                "action": {
                    "type": "string",
                    "enum": [
                        "add",
                        "update",
                        "delete"
                    ]
                },
                "range_name": {
                    "type": "string"
                },
                "condition_type": {
                    "type": "string"
                },
                "condition_values": {
                    "type": [
                        "array",
                        "string"
                    ]
                },
                "background_color": {
                    "type": "string"
                },
                "text_color": {
                    "type": "string"
                },
                "rule_index": {
                    "type": "integer"
                },
                "gradient_points": {
                    "type": [
                        "array",
                        "string"
                    ]
                },
                "sheet_name": {
                    "type": "string"
                }
            },
            "required": [
                "user_google_email",
                "spreadsheet_id",
                "action"
            ]
        }
    },
    {
        "name": "list_spreadsheet_comments",
        "description": "List all comments on a spreadsheet.",
        "parameters": {
            "type": "object",
            "properties": {
                "user_google_email": {
                    "type": "string"
                },
                "spreadsheet_id": {
                    "type": "string"
                }
            },
            "required": [
                "user_google_email",
                "spreadsheet_id"
            ]
        }
    },
    {
        "name": "manage_spreadsheet_comment",
        "description": "Create, reply to, or resolve a comment.",
        "parameters": {
            "type": "object",
            "properties": {
                "user_google_email": {
                    "type": "string"
                },
                "spreadsheet_id": {
                    "type": "string"
                },
                "action": {
                    "type": "string",
                    "enum": [
                        "create",
                        "reply",
                        "resolve"
                    ]
                },
                "comment_content": {
                    "type": "string"
                },
                "comment_id": {
                    "type": "string"
                }
            },
            "required": [
                "user_google_email",
                "spreadsheet_id",
                "action"
            ]
        }
    }
]''')

"""
Google Sheets Helper Functions

Shared utilities for Google Sheets operations including A1 parsing and
conditional formatting helpers.
"""



logger = logging.getLogger(__name__)

MAX_GRID_METADATA_CELLS = 5000

A1_PART_REGEX = re.compile(r"^([A-Za-z]*)(\d*)$")
SHEET_TITLE_SAFE_RE = re.compile(r"^[A-Za-z0-9_]+$")


def _column_to_index(column: str) -> Optional[int]:
    """Convert column letters (A, B, AA) to zero-based index."""
    if not column:
        return None
    result = 0
    for char in column.upper():
        result = result * 26 + (ord(char) - ord("A") + 1)
    return result - 1


def _parse_a1_part(
    part: str, pattern: re.Pattern[str] = A1_PART_REGEX
) -> tuple[Optional[int], Optional[int]]:
    """
    Parse a single A1 part like 'B2' or 'C' into zero-based column/row indexes.
    Supports anchors like '$A$1' by stripping the dollar signs.
    """
    clean_part = part.replace("$", "")
    match = pattern.match(clean_part)
    if not match:
        raise UserInputError(f"Invalid A1 range part: '{part}'.")
    col_letters, row_digits = match.groups()
    col_idx = _column_to_index(col_letters) if col_letters else None
    row_idx = int(row_digits) - 1 if row_digits else None
    return col_idx, row_idx


def _split_sheet_and_range(range_name: str) -> tuple[Optional[str], str]:
    """
    Split an A1 notation into (sheet_name, range_part), handling quoted sheet names.

    Examples:
    - "Sheet1!A1:B2" -> ("Sheet1", "A1:B2")
    - "'My Sheet'!$A$1:$B$10" -> ("My Sheet", "$A$1:$B$10")
    - "A1:B2" -> (None, "A1:B2")
    """
    if "!" not in range_name:
        return None, range_name

    if range_name.startswith("'"):
        closing = range_name.find("'!")
        if closing != -1:
            sheet_name = range_name[1:closing].replace("''", "'")
            a1_range = range_name[closing + 2 :]
            return sheet_name, a1_range

    sheet_name, a1_range = range_name.split("!", 1)
    return sheet_name.strip().strip("'"), a1_range


def _parse_a1_range(range_name: str, sheets: List[dict]) -> dict:
    """
    Convert an A1-style range (with optional sheet name) into a GridRange.

    Falls back to the first sheet if none is provided.
    """
    sheet_name, a1_range = _split_sheet_and_range(range_name)

    if not sheets:
        raise UserInputError("Spreadsheet has no sheets.")

    target_sheet = None
    if sheet_name:
        for sheet in sheets:
            if sheet.get("properties", {}).get("title") == sheet_name:
                target_sheet = sheet
                break
        if target_sheet is None:
            available_titles = [
                sheet.get("properties", {}).get("title", "Untitled") for sheet in sheets
            ]
            available_list = ", ".join(available_titles) if available_titles else "none"
            raise UserInputError(
                f"Sheet '{sheet_name}' not found in spreadsheet. Available sheets: {available_list}."
            )
    else:
        target_sheet = sheets[0]

    props = target_sheet.get("properties", {})
    sheet_id = props.get("sheetId")

    if not a1_range:
        raise UserInputError("A1-style range must not be empty (e.g., 'A1', 'A1:B10').")

    if ":" in a1_range:
        start, end = a1_range.split(":", 1)
    else:
        start = end = a1_range

    start_col, start_row = _parse_a1_part(start)
    end_col, end_row = _parse_a1_part(end)

    grid_range = {"sheetId": sheet_id}
    if start_row is not None:
        grid_range["startRowIndex"] = start_row
    if start_col is not None:
        grid_range["startColumnIndex"] = start_col
    if end_row is not None:
        grid_range["endRowIndex"] = end_row + 1
    if end_col is not None:
        grid_range["endColumnIndex"] = end_col + 1

    return grid_range


def _parse_hex_color(color: Optional[str]) -> Optional[dict]:
    """
    Convert a hex color like '#RRGGBB' to Sheets API color (0-1 floats).
    """
    if not color:
        return None

    trimmed = color.strip()
    if trimmed.startswith("#"):
        trimmed = trimmed[1:]

    if len(trimmed) != 6:
        raise UserInputError(f"Color '{color}' must be in format #RRGGBB or RRGGBB.")

    try:
        red = int(trimmed[0:2], 16) / 255
        green = int(trimmed[2:4], 16) / 255
        blue = int(trimmed[4:6], 16) / 255
    except ValueError as exc:
        raise UserInputError(f"Color '{color}' is not valid hex.") from exc

    return {"red": red, "green": green, "blue": blue}


def _index_to_column(index: int) -> str:
    """
    Convert a zero-based column index to column letters (0 -> A, 25 -> Z, 26 -> AA).
    """
    if index < 0:
        raise UserInputError(f"Column index must be non-negative, got {index}.")

    result = []
    index += 1  # Convert to 1-based for calculation
    while index:
        index, remainder = divmod(index - 1, 26)
        result.append(chr(ord("A") + remainder))
    return "".join(reversed(result))


def _quote_sheet_title_for_a1(sheet_title: str) -> str:
    """
    Quote a sheet title for use in A1 notation if necessary.

    If the sheet title contains special characters or spaces, it is wrapped in single quotes.
    Any single quotes in the title are escaped by doubling them, as required by Google Sheets.
    """
    if SHEET_TITLE_SAFE_RE.match(sheet_title or ""):
        return sheet_title
    escaped = (sheet_title or "").replace("'", "''")
    return f"'{escaped}'"


def _format_a1_cell(sheet_title: str, row_index: int, col_index: int) -> str:
    """
    Format a cell reference in A1 notation given a sheet title and zero-based row/column indices.

    Args:
        sheet_title: The title of the sheet.
        row_index: Zero-based row index (0 for first row).
        col_index: Zero-based column index (0 for column A).

    Returns:
        A string representing the cell reference in A1 notation, e.g., 'Sheet1!B2'.
    """
    return f"{_quote_sheet_title_for_a1(sheet_title)}!{_index_to_column(col_index)}{row_index + 1}"


def _coerce_int(value: object, default: int = 0) -> int:
    """
    Safely convert a value to an integer, returning a default value if conversion fails.

    Args:
        value: The value to convert to int.
        default: The value to return if conversion fails (default is 0).

    Returns:
        The integer value of `value`, or `default` if conversion fails.
    """
    try:
        return int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return default


def _is_sheets_error_token(value: object) -> bool:
    """
    Detect whether a cell value represents a Google Sheets error token (e.g., #ERROR!, #NAME?, #REF!, #N/A).

    Returns True if the value is a string that starts with '#' and ends with '!' or '?', or is exactly '#N/A'.
    """
    if not isinstance(value, str):
        return False
    candidate = value.strip()
    if not candidate.startswith("#"):
        return False
    upper_candidate = candidate.upper()
    if upper_candidate == "#N/A":
        return True
    return upper_candidate.endswith(("!", "?"))


def _values_contain_sheets_errors(values: List[List[object]]) -> bool:
    """
    Check whether a 2D array of cell values contains any Google Sheets error tokens.

    Args:
        values: A 2D list of cell values (as returned from the Sheets API).

    Returns:
        True if any cell contains a Google Sheets error token, False otherwise.
    """
    for row in values:
        for cell in row:
            if _is_sheets_error_token(cell):
                return True
    return False


def _a1_range_for_values(a1_range: str, values: List[List[object]]) -> Optional[str]:
    """
    Compute a tight A1 range for a returned values matrix.

    This helps keep follow-up includeGridData payloads small vs. using a wide requested range.
    Only applies when the A1 range has an explicit starting cell (e.g., 'Sheet1!B2:D10').
    """
    sheet_name, range_part = _split_sheet_and_range(a1_range)
    if not range_part:
        return None

    start_part = range_part.split(":", 1)[0]
    start_col, start_row = _parse_a1_part(start_part)
    if start_col is None or start_row is None:
        return None

    height = len(values)
    width = max((len(row) for row in values), default=0)
    if height <= 0 or width <= 0:
        return None

    end_row = start_row + height - 1
    end_col = start_col + width - 1

    start_label = f"{_index_to_column(start_col)}{start_row + 1}"
    end_label = f"{_index_to_column(end_col)}{end_row + 1}"
    range_ref = (
        start_label if start_label == end_label else f"{start_label}:{end_label}"
    )

    if sheet_name:
        return f"{_quote_sheet_title_for_a1(sheet_name)}!{range_ref}"
    return range_ref


def _a1_range_cell_count(a1_range: str) -> Optional[int]:
    """
    Return cell count for an explicit rectangular A1 range (e.g. A1:C10).

    Returns None when the range is open-ended or otherwise does not include
    both row and column bounds.
    """
    _, range_part = _split_sheet_and_range(a1_range)
    if not range_part:
        return None

    if ":" in range_part:
        start_part, end_part = range_part.split(":", 1)
    else:
        start_part = end_part = range_part

    try:
        start_col, start_row = _parse_a1_part(start_part)
        end_col, end_row = _parse_a1_part(end_part)
    except UserInputError:
        return None

    if None in (start_col, start_row, end_col, end_row):
        return None
    if end_col < start_col or end_row < start_row:
        return None

    return (end_col - start_col + 1) * (end_row - start_row + 1)


def _extract_cell_errors_from_grid(spreadsheet: dict) -> list[dict[str, Optional[str]]]:
    """
    Extracts error information from spreadsheet grid data.

    Iterates through the sheets and their grid data in the provided spreadsheet dictionary,
    collecting all cell errors. Returns a list of dictionaries, each containing:
        - "cell": the A1 notation of the cell with the error,
        - "type": the error type (e.g., "ERROR", "N/A"),
        - "message": the error message, if available.

    Args:
        spreadsheet (dict): The spreadsheet data as returned by the Sheets API with grid data included.

    Returns:
        list[dict[str, Optional[str]]]: List of error details for each cell with an error.
    """
    errors: list[dict[str, Optional[str]]] = []
    for sheet in spreadsheet.get("sheets", []) or []:
        sheet_title = sheet.get("properties", {}).get("title") or "Unknown"
        for grid in sheet.get("data", []) or []:
            start_row = _coerce_int(grid.get("startRow"), default=0)
            start_col = _coerce_int(grid.get("startColumn"), default=0)
            for row_offset, row_data in enumerate(grid.get("rowData", []) or []):
                if not row_data:
                    continue
                for col_offset, cell_data in enumerate(
                    row_data.get("values", []) or []
                ):
                    if not cell_data:
                        continue
                    error_value = (cell_data.get("effectiveValue") or {}).get(
                        "errorValue"
                    ) or None
                    if not error_value:
                        continue
                    errors.append(
                        {
                            "cell": _format_a1_cell(
                                sheet_title,
                                start_row + row_offset,
                                start_col + col_offset,
                            ),
                            "type": error_value.get("type"),
                            "message": error_value.get("message"),
                        }
                    )
    return errors


def _extract_cell_hyperlinks_from_grid(spreadsheet: dict) -> list[dict[str, str]]:
    """
    Extract hyperlink URLs from spreadsheet grid data.

    Returns a list of dictionaries with:
        - "cell": cell A1 reference
        - "url": hyperlink URL

    For rich text cells, this includes URLs from both `CellData.hyperlink`
    and `textFormatRuns[].format.link.uri`.
    """
    hyperlinks: list[dict[str, str]] = []
    for sheet in spreadsheet.get("sheets", []) or []:
        sheet_title = sheet.get("properties", {}).get("title") or "Unknown"
        for grid in sheet.get("data", []) or []:
            start_row = _coerce_int(grid.get("startRow"), default=0)
            start_col = _coerce_int(grid.get("startColumn"), default=0)
            for row_offset, row_data in enumerate(grid.get("rowData", []) or []):
                if not row_data:
                    continue
                for col_offset, cell_data in enumerate(
                    row_data.get("values", []) or []
                ):
                    if not cell_data:
                        continue
                    cell_urls: list[str] = []
                    seen_urls: set[str] = set()

                    hyperlink = cell_data.get("hyperlink")
                    if (
                        isinstance(hyperlink, str)
                        and hyperlink
                        and hyperlink not in seen_urls
                    ):
                        seen_urls.add(hyperlink)
                        cell_urls.append(hyperlink)

                    for text_run in cell_data.get("textFormatRuns", []) or []:
                        if not isinstance(text_run, dict):
                            continue
                        link_uri = (
                            (text_run.get("format") or {}).get("link") or {}
                        ).get("uri")
                        if not isinstance(link_uri, str) or not link_uri:
                            continue
                        if link_uri in seen_urls:
                            continue
                        seen_urls.add(link_uri)
                        cell_urls.append(link_uri)

                    if not cell_urls:
                        continue
                    cell_ref = _format_a1_cell(
                        sheet_title, start_row + row_offset, start_col + col_offset
                    )
                    for url in cell_urls:
                        hyperlinks.append({"cell": cell_ref, "url": url})
    return hyperlinks


async def _fetch_detailed_sheet_errors(
    service, spreadsheet_id: str, a1_range: str
) -> list[dict[str, Optional[str]]]:
    response = await asyncio.to_thread(
        service.spreadsheets()
        .get(
            spreadsheetId=spreadsheet_id,
            ranges=[a1_range],
            includeGridData=True,
            fields="sheets(properties(title),data(startRow,startColumn,rowData(values(effectiveValue(errorValue(type,message))))))",
        )
        .execute
    )
    return _extract_cell_errors_from_grid(response)


async def _fetch_sheet_hyperlinks(
    service, spreadsheet_id: str, a1_range: str
) -> list[dict[str, str]]:
    response = await asyncio.to_thread(
        service.spreadsheets()
        .get(
            spreadsheetId=spreadsheet_id,
            ranges=[a1_range],
            includeGridData=True,
            fields="sheets(properties(title),data(startRow,startColumn,rowData(values(hyperlink,textFormatRuns(format(link(uri)))))))",
        )
        .execute
    )
    return _extract_cell_hyperlinks_from_grid(response)


def _format_sheet_error_section(
    *, errors: list[dict[str, Optional[str]]], range_label: str, max_details: int = 25
) -> str:
    """
    Format a list of cell error information into a human-readable section.

    Args:
        errors: A list of dictionaries, each containing details about a cell error,
            including the cell location, error type, and message.
        range_label: A string label for the range in which the errors occurred.
        max_details: The maximum number of error details to include in the output.
            If the number of errors exceeds this value, the output will be truncated
            and a summary line will indicate how many additional errors were omitted.

    Returns:
        A formatted string listing the cell errors in a human-readable format.
        If there are no errors, returns an empty string.
    """
    # Limit the number of error details to 25 for performance and readability.
    if not errors:
        return ""

    lines = []
    for item in errors[:max_details]:
        cell = item.get("cell") or "(unknown cell)"
        error_type = item.get("type")
        message = item.get("message")
        if error_type and message:
            lines.append(f"- {cell}: {error_type} — {message}")
        elif message:
            lines.append(f"- {cell}: {message}")
        elif error_type:
            lines.append(f"- {cell}: {error_type}")
        else:
            lines.append(f"- {cell}: (unknown error)")

    suffix = (
        f"\n... and {len(errors) - max_details} more errors"
        if len(errors) > max_details
        else ""
    )
    return (
        f"\n\nDetailed cell errors in range '{range_label}':\n"
        + "\n".join(lines)
        + suffix
    )


def _format_sheet_hyperlink_section(
    *, hyperlinks: list[dict[str, str]], range_label: str, max_details: int = 25
) -> str:
    """
    Format a list of cell hyperlinks into a human-readable section.
    """
    if not hyperlinks:
        return ""

    lines = []
    for item in hyperlinks[:max_details]:
        cell = item.get("cell") or "(unknown cell)"
        url = item.get("url") or "(missing url)"
        lines.append(f"- {cell}: {url}")

    suffix = (
        f"\n... and {len(hyperlinks) - max_details} more hyperlinks"
        if len(hyperlinks) > max_details
        else ""
    )
    return f"\n\nHyperlinks in range '{range_label}':\n" + "\n".join(lines) + suffix


def _color_to_hex(color: Optional[dict]) -> Optional[str]:
    """
    Convert a Sheets color object back to #RRGGBB hex string for display.
    """
    if not color:
        return None

    def _component(value: Optional[float]) -> int:
        try:
            # Clamp and round to nearest integer in 0-255
            return max(0, min(255, int(round(float(value or 0) * 255))))
        except (TypeError, ValueError):
            return 0

    red = _component(color.get("red"))
    green = _component(color.get("green"))
    blue = _component(color.get("blue"))
    return f"#{red:02X}{green:02X}{blue:02X}"


def _grid_range_to_a1(grid_range: dict, sheet_titles: dict[int, str]) -> str:
    """
    Convert a GridRange to an A1-like string using known sheet titles.
    Falls back to the sheet ID if the title is unknown.
    """
    sheet_id = grid_range.get("sheetId")
    sheet_title = sheet_titles.get(sheet_id, f"Sheet {sheet_id}")

    start_row = grid_range.get("startRowIndex")
    end_row = grid_range.get("endRowIndex")
    start_col = grid_range.get("startColumnIndex")
    end_col = grid_range.get("endColumnIndex")

    # If nothing is specified, treat as the whole sheet.
    if start_row is None and end_row is None and start_col is None and end_col is None:
        return sheet_title

    def row_label(idx: Optional[int]) -> str:
        return str(idx + 1) if idx is not None else ""

    def col_label(idx: Optional[int]) -> str:
        return _index_to_column(idx) if idx is not None else ""

    start_label = f"{col_label(start_col)}{row_label(start_row)}"
    # end indices in GridRange are exclusive; subtract 1 for display
    end_label = f"{col_label(end_col - 1 if end_col is not None else None)}{row_label(end_row - 1 if end_row is not None else None)}"

    if start_label and end_label:
        range_ref = (
            start_label if start_label == end_label else f"{start_label}:{end_label}"
        )
    elif start_label:
        range_ref = start_label
    elif end_label:
        range_ref = end_label
    else:
        range_ref = ""

    return f"{sheet_title}!{range_ref}" if range_ref else sheet_title


def _summarize_conditional_rule(
    rule: dict, index: int, sheet_titles: dict[int, str]
) -> str:
    """
    Produce a concise human-readable summary of a conditional formatting rule.
    """
    ranges = rule.get("ranges", [])
    range_labels = [_grid_range_to_a1(rng, sheet_titles) for rng in ranges] or [
        "(no range)"
    ]

    if "booleanRule" in rule:
        boolean_rule = rule["booleanRule"]
        condition = boolean_rule.get("condition", {})
        cond_type = condition.get("type", "UNKNOWN")
        cond_values = [
            val.get("userEnteredValue")
            for val in condition.get("values", [])
            if isinstance(val, dict) and "userEnteredValue" in val
        ]
        value_desc = f" values={cond_values}" if cond_values else ""

        fmt = boolean_rule.get("format", {})
        fmt_parts = []
        bg_hex = _color_to_hex(fmt.get("backgroundColor"))
        if bg_hex:
            fmt_parts.append(f"bg {bg_hex}")
        fg_hex = _color_to_hex(fmt.get("textFormat", {}).get("foregroundColor"))
        if fg_hex:
            fmt_parts.append(f"text {fg_hex}")
        fmt_desc = ", ".join(fmt_parts) if fmt_parts else "no format"

        return f"[{index}] {cond_type}{value_desc} -> {fmt_desc} on {', '.join(range_labels)}"

    if "gradientRule" in rule:
        gradient_rule = rule["gradientRule"]
        points = []
        for point_name in ("minpoint", "midpoint", "maxpoint"):
            point = gradient_rule.get(point_name)
            if not point:
                continue
            color_hex = _color_to_hex(point.get("color"))
            type_desc = point.get("type", point_name)
            value_desc = point.get("value")
            point_desc = type_desc
            if value_desc:
                point_desc += f":{value_desc}"
            if color_hex:
                point_desc += f" {color_hex}"
            points.append(point_desc)
        gradient_desc = " | ".join(points) if points else "gradient"
        return f"[{index}] gradient -> {gradient_desc} on {', '.join(range_labels)}"

    return f"[{index}] (unknown rule) on {', '.join(range_labels)}"


def _format_conditional_rules_section(
    sheet_title: str,
    rules: List[dict],
    sheet_titles: dict[int, str],
    indent: str = "  ",
) -> str:
    """
    Build a multi-line string describing conditional formatting rules for a sheet.
    """
    if not rules:
        return f'{indent}Conditional formats for "{sheet_title}": none.'

    lines = [f'{indent}Conditional formats for "{sheet_title}" ({len(rules)}):']
    for idx, rule in enumerate(rules):
        lines.append(
            f"{indent}  {_summarize_conditional_rule(rule, idx, sheet_titles)}"
        )
    return "\n".join(lines)


CONDITION_TYPES = {
    "NUMBER_GREATER",
    "NUMBER_GREATER_THAN_EQ",
    "NUMBER_LESS",
    "NUMBER_LESS_THAN_EQ",
    "NUMBER_EQ",
    "NUMBER_NOT_EQ",
    "TEXT_CONTAINS",
    "TEXT_NOT_CONTAINS",
    "TEXT_STARTS_WITH",
    "TEXT_ENDS_WITH",
    "TEXT_EQ",
    "DATE_BEFORE",
    "DATE_ON_OR_BEFORE",
    "DATE_AFTER",
    "DATE_ON_OR_AFTER",
    "DATE_EQ",
    "DATE_NOT_EQ",
    "DATE_BETWEEN",
    "DATE_NOT_BETWEEN",
    "NOT_BLANK",
    "BLANK",
    "CUSTOM_FORMULA",
    "ONE_OF_RANGE",
}

GRADIENT_POINT_TYPES = {"MIN", "MAX", "NUMBER", "PERCENT", "PERCENTILE"}


async def _fetch_sheets_with_rules(
    service, spreadsheet_id: str
) -> tuple[List[dict], dict[int, str]]:
    """
    Fetch sheets with titles and conditional format rules in a single request.
    """
    response = await asyncio.to_thread(
        service.spreadsheets()
        .get(
            spreadsheetId=spreadsheet_id,
            fields="sheets(properties(sheetId,title),conditionalFormats)",
        )
        .execute
    )
    sheets = response.get("sheets", []) or []
    sheet_titles: dict[int, str] = {}
    for sheet in sheets:
        props = sheet.get("properties", {})
        sid = props.get("sheetId")
        if sid is not None:
            sheet_titles[sid] = props.get("title", f"Sheet {sid}")
    return sheets, sheet_titles


def _select_sheet(sheets: List[dict], sheet_name: Optional[str]) -> dict:
    """
    Select a sheet by name, or default to the first sheet if name is not provided.
    """
    if not sheets:
        raise UserInputError("Spreadsheet has no sheets.")

    if sheet_name is None:
        return sheets[0]

    for sheet in sheets:
        if sheet.get("properties", {}).get("title") == sheet_name:
            return sheet

    available_titles = [
        sheet.get("properties", {}).get("title", "Untitled") for sheet in sheets
    ]
    raise UserInputError(
        f"Sheet '{sheet_name}' not found. Available sheets: {', '.join(available_titles)}."
    )


def _parse_condition_values(
    condition_values: Optional[Union[str, List[Union[str, int, float]]]],
) -> Optional[List[Union[str, int, float]]]:
    """
    Normalize and validate condition_values into a list of strings/numbers.
    """
    parsed = condition_values
    if isinstance(parsed, str):
        try:
            parsed = json.loads(parsed)
        except json.JSONDecodeError as exc:
            raise UserInputError(
                "condition_values must be a list or a JSON-encoded list (e.g., '[\"=$B2>1000\"]')."
            ) from exc

    if parsed is not None and not isinstance(parsed, list):
        parsed = [parsed]

    if parsed:
        for idx, val in enumerate(parsed):
            if not isinstance(val, (str, int, float)):
                raise UserInputError(
                    f"condition_values[{idx}] must be a string or number, got {type(val).__name__}."
                )

    return parsed


def _parse_gradient_points(
    gradient_points: Optional[Union[str, List[dict]]],
) -> Optional[List[dict]]:
    """
    Normalize gradient points into a list of dicts with type/value/color.
    Each point must have a 'type' (MIN, MAX, NUMBER, PERCENT, PERCENTILE) and a color.
    """
    if gradient_points is None:
        return None

    parsed = gradient_points
    if isinstance(parsed, str):
        try:
            parsed = json.loads(parsed)
        except json.JSONDecodeError as exc:
            raise UserInputError(
                "gradient_points must be a list or JSON-encoded list of points "
                '(e.g., \'[{"type":"MIN","color":"#ffffff"}, {"type":"MAX","color":"#ff0000"}]\').'
            ) from exc

    if not isinstance(parsed, list):
        raise UserInputError("gradient_points must be a list of point objects.")

    if len(parsed) < 2 or len(parsed) > 3:
        raise UserInputError("Provide 2 or 3 gradient points (min/max or min/mid/max).")

    normalized_points: List[dict] = []
    for idx, point in enumerate(parsed):
        if not isinstance(point, dict):
            raise UserInputError(
                f"gradient_points[{idx}] must be an object with type/color."
            )

        point_type = point.get("type")
        if not point_type or point_type.upper() not in GRADIENT_POINT_TYPES:
            raise UserInputError(
                f"gradient_points[{idx}].type must be one of {sorted(GRADIENT_POINT_TYPES)}."
            )
        color_raw = point.get("color")
        color_dict = (
            _parse_hex_color(color_raw)
            if not isinstance(color_raw, dict)
            else color_raw
        )
        if not color_dict:
            raise UserInputError(f"gradient_points[{idx}].color is required.")

        normalized = {"type": point_type.upper(), "color": color_dict}
        if "value" in point and point["value"] is not None:
            normalized["value"] = str(point["value"])
        normalized_points.append(normalized)

    return normalized_points


def _build_boolean_rule(
    ranges: List[dict],
    condition_type: str,
    condition_values: Optional[List[Union[str, int, float]]],
    background_color: Optional[str],
    text_color: Optional[str],
) -> tuple[dict, str]:
    """
    Build a Sheets boolean conditional formatting rule payload.
    Returns the rule and the normalized condition type.
    """
    if not background_color and not text_color:
        raise UserInputError(
            "Provide at least one of background_color or text_color for the rule format."
        )

    cond_type_normalized = condition_type.upper()
    if cond_type_normalized not in CONDITION_TYPES:
        raise UserInputError(
            f"condition_type must be one of {sorted(CONDITION_TYPES)}."
        )

    condition = {"type": cond_type_normalized}
    if condition_values:
        condition["values"] = [
            {"userEnteredValue": str(value)} for value in condition_values
        ]

    bg_color_parsed = _parse_hex_color(background_color)
    text_color_parsed = _parse_hex_color(text_color)

    format_obj = {}
    if bg_color_parsed:
        format_obj["backgroundColor"] = bg_color_parsed
    if text_color_parsed:
        format_obj["textFormat"] = {"foregroundColor": text_color_parsed}

    return (
        {
            "ranges": ranges,
            "booleanRule": {
                "condition": condition,
                "format": format_obj,
            },
        },
        cond_type_normalized,
    )


def _build_gradient_rule(
    ranges: List[dict],
    gradient_points: List[dict],
) -> dict:
    """
    Build a Sheets gradient conditional formatting rule payload.
    """
    rule_body: dict = {"ranges": ranges, "gradientRule": {}}
    if len(gradient_points) == 2:
        rule_body["gradientRule"]["minpoint"] = gradient_points[0]
        rule_body["gradientRule"]["maxpoint"] = gradient_points[1]
    else:
        rule_body["gradientRule"]["minpoint"] = gradient_points[0]
        rule_body["gradientRule"]["midpoint"] = gradient_points[1]
        rule_body["gradientRule"]["maxpoint"] = gradient_points[2]
    return rule_body


def _extract_cell_notes_from_grid(spreadsheet: dict) -> list[dict[str, str]]:
    """
    Extract cell notes from spreadsheet grid data.

    Returns a list of dictionaries with:
        - "cell": cell A1 reference
        - "note": the note text
    """
    notes: list[dict[str, str]] = []
    for sheet in spreadsheet.get("sheets", []) or []:
        sheet_title = sheet.get("properties", {}).get("title") or "Unknown"
        for grid in sheet.get("data", []) or []:
            start_row = _coerce_int(grid.get("startRow"), default=0)
            start_col = _coerce_int(grid.get("startColumn"), default=0)
            for row_offset, row_data in enumerate(grid.get("rowData", []) or []):
                if not row_data:
                    continue
                for col_offset, cell_data in enumerate(
                    row_data.get("values", []) or []
                ):
                    if not cell_data:
                        continue
                    note = cell_data.get("note")
                    if not note:
                        continue
                    notes.append(
                        {
                            "cell": _format_a1_cell(
                                sheet_title,
                                start_row + row_offset,
                                start_col + col_offset,
                            ),
                            "note": note,
                        }
                    )
    return notes


async def _fetch_sheet_notes(
    service, spreadsheet_id: str, a1_range: str
) -> list[dict[str, str]]:
    """Fetch cell notes for the given range via spreadsheets.get with includeGridData."""
    response = await asyncio.to_thread(
        service.spreadsheets()
        .get(
            spreadsheetId=spreadsheet_id,
            ranges=[a1_range],
            includeGridData=True,
            fields="sheets(properties(title),data(startRow,startColumn,rowData(values(note))))",
        )
        .execute
    )
    return _extract_cell_notes_from_grid(response)


def _format_sheet_notes_section(
    *, notes: list[dict[str, str]], range_label: str, max_details: int = 25
) -> str:
    """
    Format a list of cell notes into a human-readable section.
    """
    if not notes:
        return ""

    lines = []
    for item in notes[:max_details]:
        cell = item.get("cell") or "(unknown cell)"
        note = item.get("note") or "(empty note)"
        lines.append(f"- {cell}: {note}")

    suffix = (
        f"\n... and {len(notes) - max_details} more notes"
        if len(notes) > max_details
        else ""
    )
    return f"\n\nCell notes in range '{range_label}':\n" + "\n".join(lines) + suffix


async def _fetch_cell_formulas(
    service,
    spreadsheet_id: str,
    resolved_range: str,
) -> tuple[str, List[List[object]]]:
    """Fetch formula strings for cells in the given range.

    Makes a second values().get() call with valueRenderOption="FORMULA" and
    returns a formatted section listing any cells whose value starts with "=".
    Cells containing plain values are silently skipped.

    Returns an empty section and empty values list if the request fails.
    """
    try:
        result = await asyncio.to_thread(
            service.spreadsheets()
            .values()
            .get(
                spreadsheetId=spreadsheet_id,
                range=resolved_range,
                valueRenderOption="FORMULA",
            )
            .execute
        )
    except Exception as exc:
        logger.warning(
            "[read_sheet_values] Failed fetching formula values for range '%s': %s",
            resolved_range,
            exc,
        )
        return "", []

    formula_values = result.get("values", [])
    formulas: list[dict[str, str]] = []

    sheet_name, range_part = _split_sheet_and_range(resolved_range)
    start_part = range_part.split(":")[0] if ":" in range_part else range_part
    start_col_idx, start_row_idx = _parse_a1_part(start_part)
    base_col = start_col_idx if start_col_idx is not None else 0
    base_row = start_row_idx if start_row_idx is not None else 0

    for row_offset, formula_row in enumerate(formula_values):
        for col_offset, cell_value in enumerate(formula_row):
            if isinstance(cell_value, str) and cell_value.startswith("="):
                abs_col = base_col + col_offset
                abs_row = base_row + row_offset
                cell_ref = f"{_index_to_column(abs_col)}{abs_row + 1}"
                if sheet_name:
                    cell_ref = f"{_quote_sheet_title_for_a1(sheet_name)}!{cell_ref}"
                formulas.append({"cell": cell_ref, "formula": cell_value})

    return (
        _format_sheet_formula_section(formulas=formulas, range_label=resolved_range),
        formula_values,
    )


def _format_sheet_formula_section(
    *, formulas: list[dict[str, str]], range_label: str, max_details: int = 50
) -> str:
    """Format a list of formula cells into a human-readable section."""
    if not formulas:
        return ""

    lines = []
    for item in formulas[:max_details]:
        cell = item.get("cell") or "(unknown cell)"
        formula = item.get("formula") or "(empty formula)"
        lines.append(f"- {cell}: {formula}")

    suffix = (
        f"\n... and {len(formulas) - max_details} more formula cells"
        if len(formulas) > max_details
        else ""
    )
    return f"\n\nFormula cells in range '{range_label}':\n" + "\n".join(lines) + suffix


async def _fetch_grid_metadata(
    service,
    spreadsheet_id: str,
    resolved_range: str,
    values: List[List[object]],
    include_hyperlinks: bool = False,
    include_notes: bool = False,
) -> tuple[str, str]:
    """Fetch hyperlinks and/or notes for a range via a single spreadsheets.get call.

    Computes tight range bounds, enforces the cell-count cap, builds a combined
    ``fields`` selector so only one API round-trip is needed when both flags are
    ``True``, then parses the response into formatted output sections.

    Returns:
        (hyperlink_section, notes_section) — each is an empty string when the
        corresponding flag is ``False`` or no data was found.
    """
    if not include_hyperlinks and not include_notes:
        return "", ""

    tight_range = _a1_range_for_values(resolved_range, values)
    if not tight_range:
        logger.info(
            "[read_sheet_values] Skipping grid metadata fetch for range '%s': "
            "unable to determine tight bounds",
            resolved_range,
        )
        return "", ""

    cell_count = _a1_range_cell_count(tight_range) or sum(len(row) for row in values)
    if cell_count > MAX_GRID_METADATA_CELLS:
        logger.info(
            "[read_sheet_values] Skipping grid metadata fetch for large range "
            "'%s' (%d cells > %d limit)",
            tight_range,
            cell_count,
            MAX_GRID_METADATA_CELLS,
        )
        return "", ""

    # Build a combined fields selector so we hit the API at most once.
    value_fields: list[str] = []
    if include_hyperlinks:
        value_fields.extend(["hyperlink", "textFormatRuns(format(link(uri)))"])
    if include_notes:
        value_fields.append("note")

    fields = (
        "sheets(properties(title),data(startRow,startColumn,"
        f"rowData(values({','.join(value_fields)}))))"
    )

    try:
        response = await asyncio.to_thread(
            service.spreadsheets()
            .get(
                spreadsheetId=spreadsheet_id,
                ranges=[tight_range],
                includeGridData=True,
                fields=fields,
            )
            .execute
        )
    except Exception as exc:
        logger.warning(
            "[read_sheet_values] Failed fetching grid metadata for range '%s': %s",
            tight_range,
            exc,
        )
        return "", ""

    hyperlink_section = ""
    if include_hyperlinks:
        hyperlinks = _extract_cell_hyperlinks_from_grid(response)
        hyperlink_section = _format_sheet_hyperlink_section(
            hyperlinks=hyperlinks, range_label=tight_range
        )

    notes_section = ""
    if include_notes:
        notes = _extract_cell_notes_from_grid(response)
        notes_section = _format_sheet_notes_section(
            notes=notes, range_label=tight_range
        )

    return hyperlink_section, notes_section


"""
Core Comments Module

This module provides reusable comment management functions for Google Workspace applications.
All Google Workspace apps (Docs, Sheets, Slides) use the Drive API for comment operations.
"""




logger = logging.getLogger(__name__)


READ_COMMENT_ANNOTATIONS = ToolAnnotations(
    readOnlyHint=True,
    destructiveHint=False,
    idempotentHint=True,
    openWorldHint=True,
)

MANAGE_COMMENT_ANNOTATIONS = ToolAnnotations(
    readOnlyHint=False,
    destructiveHint=False,
    idempotentHint=False,
    openWorldHint=True,
)


async def _manage_comment_dispatch(
    service,
    app_name: str,
    file_id: str,
    action: str,
    comment_content: Optional[str] = None,
    comment_id: Optional[str] = None,
) -> str:
    """Route comment management actions to the appropriate implementation."""
    action_lower = action.lower().strip()
    if action_lower == "create":
        if not comment_content:
            raise ValueError("comment_content is required for create action")
        return await _create_comment_impl(service, app_name, file_id, comment_content)
    elif action_lower == "reply":
        if not comment_id or not comment_content:
            raise ValueError(
                "comment_id and comment_content are required for reply action"
            )
        return await _reply_to_comment_impl(
            service, app_name, file_id, comment_id, comment_content
        )
    elif action_lower == "resolve":
        if not comment_id:
            raise ValueError("comment_id is required for resolve action")
        return await _resolve_comment_impl(service, app_name, file_id, comment_id)
    else:
        raise ValueError(
            f"Invalid action '{action_lower}'. Must be 'create', 'reply', or 'resolve'."
        )


async def _read_comments_impl(
    service, app_name: str, file_id: str, max_comments: int | None = None
) -> str:
    """Implementation for reading comments from any Google Workspace file."""
    logger.info(f"[read_{app_name}_comments] Reading comments for {app_name} {file_id}")

    if max_comments is None:
        try:
            max_comments = int(os.getenv("WORKSPACE_MCP_COMMENTS_MAX", "100"))
        except (ValueError, TypeError):
            max_comments = 100

    if max_comments < 0:
        max_comments = 100
    if max_comments == 0:
        return f"No comments found in {app_name} {file_id}"

    comments: list = []
    page_token: str | None = None

    while len(comments) < max_comments:
        remaining = max_comments - len(comments)
        page_size = min(100, remaining)

        kwargs: dict = {
            "fileId": file_id,
            "fields": "nextPageToken,comments(id,content,author,createdTime,modifiedTime,resolved,quotedFileContent,replies(content,author,id,createdTime,modifiedTime))",
            "pageSize": page_size,
        }
        if page_token is not None:
            kwargs["pageToken"] = page_token

        response = await asyncio.to_thread(service.comments().list(**kwargs).execute)

        page_comments = response.get("comments", [])
        take = min(len(page_comments), max_comments - len(comments))
        comments.extend(page_comments[:take])

        page_token = response.get("nextPageToken")
        if not page_token or len(comments) >= max_comments:
            break

    if not comments:
        return f"No comments found in {app_name} {file_id}"

    output = [f"Found {len(comments)} comments in {app_name} {file_id}:\\n"]

    for comment in comments:
        author = comment.get("author", {}).get("displayName", "Unknown")
        content = comment.get("content", "")
        created = comment.get("createdTime", "")
        resolved = comment.get("resolved", False)
        comment_id = comment.get("id", "")
        status = " [RESOLVED]" if resolved else ""

        quoted_text = comment.get("quotedFileContent", {}).get("value", "")

        output.append(f"Comment ID: {comment_id}")
        output.append(f"Author: {author}")
        output.append(f"Created: {created}{status}")
        if quoted_text:
            output.append(f"Quoted text: {quoted_text}")
        output.append(f"Content: {content}")

        replies = comment.get("replies", [])
        if replies:
            output.append(f"  Replies ({len(replies)}):")
            for reply in replies:
                reply_author = reply.get("author", {}).get("displayName", "Unknown")
                reply_content = reply.get("content", "")
                reply_created = reply.get("createdTime", "")
                reply_id = reply.get("id", "")
                output.append(f"    Reply ID: {reply_id}")
                output.append(f"    Author: {reply_author}")
                output.append(f"    Created: {reply_created}")
                output.append(f"    Content: {reply_content}")

        output.append("")  # Empty line between comments

    return "\\n".join(output)


async def _create_comment_impl(
    service, app_name: str, file_id: str, comment_content: str
) -> str:
    """Implementation for creating a comment on any Google Workspace file.

    Note: Comments created via the Drive API appear as document-level comments.
    The Google Drive API does not support anchoring comments to specific text in
    Google Docs; only the Docs UI can create anchored comments.
    """
    logger.info(f"[create_{app_name}_comment] Creating comment in {app_name} {file_id}")

    body = {"content": comment_content}

    comment = await asyncio.to_thread(
        service.comments()
        .create(
            fileId=file_id,
            body=body,
            fields="id,content,author,createdTime,modifiedTime",
        )
        .execute
    )

    comment_id = comment.get("id", "")
    author = comment.get("author", {}).get("displayName", "Unknown")
    created = comment.get("createdTime", "")

    return f"Comment created successfully!\\nComment ID: {comment_id}\\nAuthor: {author}\\nCreated: {created}\\nContent: {comment_content}"


async def _reply_to_comment_impl(
    service, app_name: str, file_id: str, comment_id: str, reply_content: str
) -> str:
    """Implementation for replying to a comment on any Google Workspace file."""
    logger.info(
        f"[reply_to_{app_name}_comment] Replying to comment {comment_id} in {app_name} {file_id}"
    )

    body = {"content": reply_content}

    reply = await asyncio.to_thread(
        service.replies()
        .create(
            fileId=file_id,
            commentId=comment_id,
            body=body,
            fields="id,content,author,createdTime,modifiedTime",
        )
        .execute
    )

    reply_id = reply.get("id", "")
    author = reply.get("author", {}).get("displayName", "Unknown")
    created = reply.get("createdTime", "")

    return f"Reply posted successfully!\\nReply ID: {reply_id}\\nAuthor: {author}\\nCreated: {created}\\nContent: {reply_content}"


async def _resolve_comment_impl(
    service, app_name: str, file_id: str, comment_id: str
) -> str:
    """Implementation for resolving a comment on any Google Workspace file."""
    logger.info(
        f"[resolve_{app_name}_comment] Resolving comment {comment_id} in {app_name} {file_id}"
    )

    body = {"content": "This comment has been resolved.", "action": "resolve"}

    reply = await asyncio.to_thread(
        service.replies()
        .create(
            fileId=file_id,
            commentId=comment_id,
            body=body,
            fields="id,content,author,createdTime,modifiedTime",
        )
        .execute
    )

    reply_id = reply.get("id", "")
    author = reply.get("author", {}).get("displayName", "Unknown")
    created = reply.get("createdTime", "")

    return f"Comment {comment_id} has been resolved successfully.\\nResolve reply ID: {reply_id}\\nAuthor: {author}\\nCreated: {created}"


"""
Google Sheets MCP Tools

This module provides MCP tools for interacting with Google Sheets API.
"""




# Configure module logger
logger = logging.getLogger(__name__)
async def list_spreadsheets(
    service,
    user_google_email: str,
    max_results: int = 25,
) -> str:
    """
    Lists spreadsheets from Google Drive that the user has access to.

    Args:
        user_google_email (str): The user's Google email address. Required.
        max_results (int): Maximum number of spreadsheets to return. Defaults to 25.

    Returns:
        str: A formatted list of spreadsheet files (name, ID, modified time).
    """
    logger.info(f"[list_spreadsheets] Invoked. Email: '{user_google_email}'")

    files_response = await asyncio.to_thread(
        service.files()
        .list(
            q="mimeType='application/vnd.google-apps.spreadsheet'",
            pageSize=max_results,
            fields="files(id,name,modifiedTime,webViewLink)",
            orderBy="modifiedTime desc",
            supportsAllDrives=True,
            includeItemsFromAllDrives=True,
        )
        .execute
    )

    files = files_response.get("files", [])
    if not files:
        return f"No spreadsheets found for {user_google_email}."

    spreadsheets_list = [
        f'- "{file["name"]}" (ID: {file["id"]}) | Modified: {file.get("modifiedTime", "Unknown")} | Link: {file.get("webViewLink", "No link")}'
        for file in files
    ]

    text_output = (
        f"Successfully listed {len(files)} spreadsheets for {user_google_email}:\n"
        + "\n".join(spreadsheets_list)
    )

    logger.info(
        f"Successfully listed {len(files)} spreadsheets for {user_google_email}."
    )
    return text_output
async def get_spreadsheet_info(
    service,
    user_google_email: str,
    spreadsheet_id: str,
) -> str:
    """
    Gets information about a specific spreadsheet including its sheets.

    Args:
        user_google_email (str): The user's Google email address. Required.
        spreadsheet_id (str): The ID of the spreadsheet to get info for. Required.

    Returns:
        str: Formatted spreadsheet information including title, locale, and sheets list.
    """
    logger.info(
        f"[get_spreadsheet_info] Invoked. Email: '{user_google_email}', Spreadsheet ID: {spreadsheet_id}"
    )

    spreadsheet = await asyncio.to_thread(
        service.spreadsheets()
        .get(
            spreadsheetId=spreadsheet_id,
            fields="spreadsheetId,properties(title,locale),sheets(properties(title,sheetId,gridProperties(rowCount,columnCount)),conditionalFormats)",
        )
        .execute
    )

    properties = spreadsheet.get("properties", {})
    title = properties.get("title", "Unknown")
    locale = properties.get("locale", "Unknown")
    sheets = spreadsheet.get("sheets", [])

    sheet_titles = {}
    for sheet in sheets:
        sheet_props = sheet.get("properties", {})
        sid = sheet_props.get("sheetId")
        if sid is not None:
            sheet_titles[sid] = sheet_props.get("title", f"Sheet {sid}")

    sheets_info = []
    for sheet in sheets:
        sheet_props = sheet.get("properties", {})
        sheet_name = sheet_props.get("title", "Unknown")
        sheet_id = sheet_props.get("sheetId", "Unknown")
        grid_props = sheet_props.get("gridProperties", {})
        rows = grid_props.get("rowCount", "Unknown")
        cols = grid_props.get("columnCount", "Unknown")
        rules = sheet.get("conditionalFormats", []) or []

        sheets_info.append(
            f'  - "{sheet_name}" (ID: {sheet_id}) | Size: {rows}x{cols} | Conditional formats: {len(rules)}'
        )
        if rules:
            sheets_info.append(
                _format_conditional_rules_section(
                    sheet_name, rules, sheet_titles, indent="    "
                )
            )

    sheets_section = "\n".join(sheets_info) if sheets_info else "  No sheets found"
    text_output = "\n".join(
        [
            f'Spreadsheet: "{title}" (ID: {spreadsheet_id}) | Locale: {locale}',
            f"Sheets ({len(sheets)}):",
            sheets_section,
        ]
    )

    logger.info(
        f"Successfully retrieved info for spreadsheet {spreadsheet_id} for {user_google_email}."
    )
    return text_output
async def read_sheet_values(
    service,
    user_google_email: str,
    spreadsheet_id: str,
    range_name: str = "A1:Z1000",
    include_hyperlinks: bool = False,
    include_notes: bool = False,
    include_formulas: bool = False,
) -> str:
    """
    Reads values from a specific range in a Google Sheet.

    Args:
        user_google_email (str): The user's Google email address. Required.
        spreadsheet_id (str): The ID of the spreadsheet. Required.
        range_name (str): The range to read (e.g., "Sheet1!A1:D10", "A1:D10"). Defaults to "A1:Z1000".
        include_hyperlinks (bool): If True, also fetch hyperlink metadata for the range.
            Defaults to False to avoid expensive includeGridData requests.
        include_notes (bool): If True, also fetch cell notes for the range.
            Defaults to False to avoid expensive includeGridData requests.
        include_formulas (bool): If True, also fetch raw formula strings for cells that
            contain formulas. Useful for identifying cross-sheet references before writing
            back to a range. Defaults to False to avoid an extra API request.

    Returns:
        str: The formatted values from the specified range.
    """
    logger.info(
        f"[read_sheet_values] Invoked. Email: '{user_google_email}', Spreadsheet: {spreadsheet_id}, Range: {range_name}"
    )

    result = await asyncio.to_thread(
        service.spreadsheets()
        .values()
        .get(spreadsheetId=spreadsheet_id, range=range_name)
        .execute
    )

    values = result.get("values", [])
    resolved_range = result.get("range", range_name)

    hyperlink_section, notes_section = await _fetch_grid_metadata(
        service,
        spreadsheet_id,
        resolved_range,
        values,
        include_hyperlinks=include_hyperlinks,
        include_notes=include_notes,
    )

    formula_section = ""
    formula_values = []
    if include_formulas:
        formula_section, formula_values = await _fetch_cell_formulas(
            service, spreadsheet_id, resolved_range
        )

    if not values and not formula_values:
        return f"No data found in range '{range_name}' for {user_google_email}."

    if not values:
        logger.info(
            "[read_sheet_values] Range '%s' has formula cells but no displayed values",
            resolved_range,
        )
        return (
            f"No displayed values found in range '{range_name}' in spreadsheet {spreadsheet_id} "
            f"for {user_google_email}. The range contains formula cells."
            + formula_section
        )

    detailed_range = _a1_range_for_values(resolved_range, values) or resolved_range

    detailed_errors_section = ""
    if _values_contain_sheets_errors(values):
        try:
            errors = await _fetch_detailed_sheet_errors(
                service, spreadsheet_id, detailed_range
            )
            detailed_errors_section = _format_sheet_error_section(
                errors=errors, range_label=detailed_range
            )
        except Exception as exc:
            logger.warning(
                "[read_sheet_values] Failed fetching detailed error messages for range '%s': %s",
                detailed_range,
                exc,
            )

    # Format the output as a readable table
    formatted_rows = []
    for i, row in enumerate(values, 1):
        # Pad row with empty strings to show structure
        padded_row = row + [""] * max(0, len(values[0]) - len(row)) if values else row
        formatted_rows.append(f"Row {i:2d}: {padded_row}")

    text_output = (
        f"Successfully read {len(values)} rows from range '{range_name}' in spreadsheet {spreadsheet_id} for {user_google_email}:\n"
        + "\n".join(formatted_rows[:50])  # Limit to first 50 rows for readability
        + (f"\n... and {len(values) - 50} more rows" if len(values) > 50 else "")
    )

    logger.info(f"Successfully read {len(values)} rows for {user_google_email}.")
    return (
        text_output
        + hyperlink_section
        + notes_section
        + formula_section
        + detailed_errors_section
    )
async def modify_sheet_values(
    service,
    user_google_email: str,
    spreadsheet_id: str,
    range_name: str,
    values: Optional[Union[str, List[List[str]]]] = None,
    value_input_option: str = "USER_ENTERED",
    clear_values: bool = False,
) -> str:
    """
    Modifies values in a specific range of a Google Sheet - can write, update, or clear values.

    Args:
        user_google_email (str): The user's Google email address. Required.
        spreadsheet_id (str): The ID of the spreadsheet. Required.
        range_name (str): The range to modify (e.g., "Sheet1!A1:D10", "A1:D10"). Required.
        values (Optional[Union[str, List[List[str]]]]): 2D array of values to write/update. Can be a JSON string or Python list. Required unless clear_values=True.
        value_input_option (str): How to interpret input values ("RAW" or "USER_ENTERED"). Defaults to "USER_ENTERED".
        clear_values (bool): If True, clears the range instead of writing values. Defaults to False.

    Returns:
        str: Confirmation message of the successful modification operation.
    """
    operation = "clear" if clear_values else "write"
    logger.info(
        f"[modify_sheet_values] Invoked. Operation: {operation}, Email: '{user_google_email}', Spreadsheet: {spreadsheet_id}, Range: {range_name}"
    )

    # Parse values if it's a JSON string (MCP passes parameters as JSON strings)
    if values is not None and isinstance(values, str):
        try:
            parsed_values = json.loads(values)
            if not isinstance(parsed_values, list):
                raise ValueError(
                    f"Values must be a list, got {type(parsed_values).__name__}"
                )
            # Validate it's a list of lists
            for i, row in enumerate(parsed_values):
                if not isinstance(row, list):
                    raise ValueError(
                        f"Row {i} must be a list, got {type(row).__name__}"
                    )
            values = parsed_values
            logger.info(
                f"[modify_sheet_values] Parsed JSON string to Python list with {len(values)} rows"
            )
        except json.JSONDecodeError as e:
            raise UserInputError(f"Invalid JSON format for values: {e}")
        except ValueError as e:
            raise UserInputError(f"Invalid values structure: {e}")

    if not clear_values and not values:
        raise UserInputError(
            "Either 'values' must be provided or 'clear_values' must be True."
        )

    if clear_values:
        result = await asyncio.to_thread(
            service.spreadsheets()
            .values()
            .clear(spreadsheetId=spreadsheet_id, range=range_name)
            .execute
        )

        cleared_range = result.get("clearedRange", range_name)
        text_output = f"Successfully cleared range '{cleared_range}' in spreadsheet {spreadsheet_id} for {user_google_email}."
        logger.info(
            f"Successfully cleared range '{cleared_range}' for {user_google_email}."
        )
    else:
        body = {"values": values}

        result = await asyncio.to_thread(
            service.spreadsheets()
            .values()
            .update(
                spreadsheetId=spreadsheet_id,
                range=range_name,
                valueInputOption=value_input_option,
                # NOTE: This increases response payload/shape by including `updatedData`, but lets
                # us detect Sheets error tokens (e.g. "#VALUE!", "#REF!") without an extra read.
                includeValuesInResponse=True,
                responseValueRenderOption="FORMATTED_VALUE",
                body=body,
            )
            .execute
        )

        updated_cells = result.get("updatedCells", 0)
        updated_rows = result.get("updatedRows", 0)
        updated_columns = result.get("updatedColumns", 0)

        detailed_errors_section = ""
        updated_data = result.get("updatedData") or {}
        updated_values = updated_data.get("values", []) or []
        if updated_values and _values_contain_sheets_errors(updated_values):
            updated_range = result.get("updatedRange", range_name)
            detailed_range = (
                _a1_range_for_values(updated_range, updated_values) or updated_range
            )
            try:
                errors = await _fetch_detailed_sheet_errors(
                    service, spreadsheet_id, detailed_range
                )
                detailed_errors_section = _format_sheet_error_section(
                    errors=errors, range_label=detailed_range
                )
            except Exception as exc:
                logger.warning(
                    "[modify_sheet_values] Failed fetching detailed error messages for range '%s': %s",
                    detailed_range,
                    exc,
                )

        text_output = (
            f"Successfully updated range '{range_name}' in spreadsheet {spreadsheet_id} for {user_google_email}. "
            f"Updated: {updated_cells} cells, {updated_rows} rows, {updated_columns} columns."
        )
        text_output += detailed_errors_section
        logger.info(
            f"Successfully updated {updated_cells} cells for {user_google_email}."
        )

    return text_output


# Internal implementation function for testing
async def _format_sheet_range_impl(
    service,
    spreadsheet_id: str,
    range_name: str,
    background_color: Optional[str] = None,
    text_color: Optional[str] = None,
    number_format_type: Optional[str] = None,
    number_format_pattern: Optional[str] = None,
    wrap_strategy: Optional[str] = None,
    horizontal_alignment: Optional[str] = None,
    vertical_alignment: Optional[str] = None,
    bold: Optional[bool] = None,
    italic: Optional[bool] = None,
    font_size: Optional[int] = None,
) -> str:
    """Internal implementation for format_sheet_range.

    Applies formatting to a Google Sheets range including colors, number formats,
    text wrapping, alignment, and text styling.

    Args:
        service: Google Sheets API service client.
        spreadsheet_id: The ID of the spreadsheet.
        range_name: A1-style range (optionally with sheet name).
        background_color: Hex background color (e.g., "#FFEECC").
        text_color: Hex text color (e.g., "#000000").
        number_format_type: Sheets number format type (e.g., "DATE").
        number_format_pattern: Optional custom pattern for the number format.
        wrap_strategy: Text wrap strategy (WRAP, CLIP, OVERFLOW_CELL).
        horizontal_alignment: Horizontal alignment (LEFT, CENTER, RIGHT).
        vertical_alignment: Vertical alignment (TOP, MIDDLE, BOTTOM).
        bold: Whether to apply bold formatting.
        italic: Whether to apply italic formatting.
        font_size: Font size in points.

    Returns:
        Dictionary with keys: range_name, spreadsheet_id, summary.
    """
    # Validate at least one formatting option is provided
    has_any_format = any(
        [
            background_color,
            text_color,
            number_format_type,
            wrap_strategy,
            horizontal_alignment,
            vertical_alignment,
            bold is not None,
            italic is not None,
            font_size is not None,
        ]
    )
    if not has_any_format:
        raise UserInputError(
            "Provide at least one formatting option (background_color, text_color, "
            "number_format_type, wrap_strategy, horizontal_alignment, vertical_alignment, "
            "bold, italic, or font_size)."
        )

    # Parse colors
    bg_color_parsed = _parse_hex_color(background_color)
    text_color_parsed = _parse_hex_color(text_color)

    # Validate and normalize number format
    number_format = None
    if number_format_type:
        allowed_number_formats = {
            "NUMBER",
            "NUMBER_WITH_GROUPING",
            "CURRENCY",
            "PERCENT",
            "SCIENTIFIC",
            "DATE",
            "TIME",
            "DATE_TIME",
            "TEXT",
        }
        normalized_type = number_format_type.upper()
        if normalized_type not in allowed_number_formats:
            raise UserInputError(
                f"number_format_type must be one of {sorted(allowed_number_formats)}."
            )
        number_format = {"type": normalized_type}
        if number_format_pattern:
            number_format["pattern"] = number_format_pattern

    # Validate and normalize wrap_strategy
    wrap_strategy_normalized = None
    if wrap_strategy:
        allowed_wrap_strategies = {"WRAP", "CLIP", "OVERFLOW_CELL"}
        wrap_strategy_normalized = wrap_strategy.upper()
        if wrap_strategy_normalized not in allowed_wrap_strategies:
            raise UserInputError(
                f"wrap_strategy must be one of {sorted(allowed_wrap_strategies)}."
            )

    # Validate and normalize horizontal_alignment
    h_align_normalized = None
    if horizontal_alignment:
        allowed_h_alignments = {"LEFT", "CENTER", "RIGHT"}
        h_align_normalized = horizontal_alignment.upper()
        if h_align_normalized not in allowed_h_alignments:
            raise UserInputError(
                f"horizontal_alignment must be one of {sorted(allowed_h_alignments)}."
            )

    # Validate and normalize vertical_alignment
    v_align_normalized = None
    if vertical_alignment:
        allowed_v_alignments = {"TOP", "MIDDLE", "BOTTOM"}
        v_align_normalized = vertical_alignment.upper()
        if v_align_normalized not in allowed_v_alignments:
            raise UserInputError(
                f"vertical_alignment must be one of {sorted(allowed_v_alignments)}."
            )

    # Get sheet metadata for range parsing
    metadata = await asyncio.to_thread(
        service.spreadsheets()
        .get(
            spreadsheetId=spreadsheet_id,
            fields="sheets(properties(sheetId,title))",
        )
        .execute
    )
    sheets = metadata.get("sheets", [])
    grid_range = _parse_a1_range(range_name, sheets)

    # Build userEnteredFormat and fields list
    user_entered_format = {}
    fields = []

    # Background color
    if bg_color_parsed:
        user_entered_format["backgroundColor"] = bg_color_parsed
        fields.append("userEnteredFormat.backgroundColor")

    # Text format (color, bold, italic, fontSize)
    text_format = {}
    text_format_fields = []

    if text_color_parsed:
        text_format["foregroundColor"] = text_color_parsed
        text_format_fields.append("userEnteredFormat.textFormat.foregroundColor")

    if bold is not None:
        text_format["bold"] = bold
        text_format_fields.append("userEnteredFormat.textFormat.bold")

    if italic is not None:
        text_format["italic"] = italic
        text_format_fields.append("userEnteredFormat.textFormat.italic")

    if font_size is not None:
        text_format["fontSize"] = font_size
        text_format_fields.append("userEnteredFormat.textFormat.fontSize")

    if text_format:
        user_entered_format["textFormat"] = text_format
        fields.extend(text_format_fields)

    # Number format
    if number_format:
        user_entered_format["numberFormat"] = number_format
        fields.append("userEnteredFormat.numberFormat")

    # Wrap strategy
    if wrap_strategy_normalized:
        user_entered_format["wrapStrategy"] = wrap_strategy_normalized
        fields.append("userEnteredFormat.wrapStrategy")

    # Horizontal alignment
    if h_align_normalized:
        user_entered_format["horizontalAlignment"] = h_align_normalized
        fields.append("userEnteredFormat.horizontalAlignment")

    # Vertical alignment
    if v_align_normalized:
        user_entered_format["verticalAlignment"] = v_align_normalized
        fields.append("userEnteredFormat.verticalAlignment")

    if not user_entered_format:
        raise UserInputError(
            "No formatting applied. Verify provided formatting options."
        )

    # Build and execute request
    request_body = {
        "requests": [
            {
                "repeatCell": {
                    "range": grid_range,
                    "cell": {"userEnteredFormat": user_entered_format},
                    "fields": ",".join(fields),
                }
            }
        ]
    }

    await asyncio.to_thread(
        service.spreadsheets()
        .batchUpdate(spreadsheetId=spreadsheet_id, body=request_body)
        .execute
    )

    # Build confirmation message
    applied_parts = []
    if bg_color_parsed:
        applied_parts.append(f"background {background_color}")
    if text_color_parsed:
        applied_parts.append(f"text color {text_color}")
    if number_format:
        nf_desc = number_format["type"]
        if number_format_pattern:
            nf_desc += f" (pattern: {number_format_pattern})"
        applied_parts.append(f"number format {nf_desc}")
    if wrap_strategy_normalized:
        applied_parts.append(f"wrap {wrap_strategy_normalized}")
    if h_align_normalized:
        applied_parts.append(f"horizontal align {h_align_normalized}")
    if v_align_normalized:
        applied_parts.append(f"vertical align {v_align_normalized}")
    if bold is not None:
        applied_parts.append("bold" if bold else "not bold")
    if italic is not None:
        applied_parts.append("italic" if italic else "not italic")
    if font_size is not None:
        applied_parts.append(f"font size {font_size}")

    summary = ", ".join(applied_parts)

    # Return structured data for the wrapper to format
    return {
        "range_name": range_name,
        "spreadsheet_id": spreadsheet_id,
        "summary": summary,
    }
async def format_sheet_range(
    service,
    user_google_email: str,
    spreadsheet_id: str,
    range_name: str,
    background_color: Optional[str] = None,
    text_color: Optional[str] = None,
    number_format_type: Optional[str] = None,
    number_format_pattern: Optional[str] = None,
    wrap_strategy: Optional[str] = None,
    horizontal_alignment: Optional[str] = None,
    vertical_alignment: Optional[str] = None,
    bold: Optional[bool] = None,
    italic: Optional[bool] = None,
    font_size: Optional[int] = None,
) -> str:
    """
    Applies formatting to a range: colors, number formats, text wrapping,
    alignment, and text styling.

    Colors accept hex strings (#RRGGBB). Number formats follow Sheets types
    (e.g., NUMBER, CURRENCY, DATE, PERCENT). If no sheet name is provided,
    the first sheet is used.

    Args:
        user_google_email (str): The user's Google email address. Required.
        spreadsheet_id (str): The ID of the spreadsheet. Required.
        range_name (str): A1-style range (optionally with sheet name). Required.
        background_color (Optional[str]): Hex background color (e.g., "#FFEECC").
        text_color (Optional[str]): Hex text color (e.g., "#000000").
        number_format_type (Optional[str]): Sheets number format type (e.g., "DATE").
        number_format_pattern (Optional[str]): Custom pattern for the number format.
        wrap_strategy (Optional[str]): Text wrap strategy - WRAP (wrap text within
            cell), CLIP (clip text at cell boundary), or OVERFLOW_CELL (allow text
            to overflow into adjacent empty cells).
        horizontal_alignment (Optional[str]): Horizontal text alignment - LEFT,
            CENTER, or RIGHT.
        vertical_alignment (Optional[str]): Vertical text alignment - TOP, MIDDLE,
            or BOTTOM.
        bold (Optional[bool]): Whether to apply bold formatting.
        italic (Optional[bool]): Whether to apply italic formatting.
        font_size (Optional[int]): Font size in points.

    Returns:
        str: Confirmation of the applied formatting.
    """
    logger.info(
        "[format_sheet_range] Invoked. Email: '%s', Spreadsheet: %s, Range: %s",
        user_google_email,
        spreadsheet_id,
        range_name,
    )

    result = await _format_sheet_range_impl(
        service=service,
        spreadsheet_id=spreadsheet_id,
        range_name=range_name,
        background_color=background_color,
        text_color=text_color,
        number_format_type=number_format_type,
        number_format_pattern=number_format_pattern,
        wrap_strategy=wrap_strategy,
        horizontal_alignment=horizontal_alignment,
        vertical_alignment=vertical_alignment,
        bold=bold,
        italic=italic,
        font_size=font_size,
    )

    # Build confirmation message with user email
    return (
        f"Applied formatting to range '{result['range_name']}' in spreadsheet "
        f"{result['spreadsheet_id']} for {user_google_email}: {result['summary']}."
    )
async def manage_conditional_formatting(
    service,
    user_google_email: str,
    spreadsheet_id: str,
    action: str,
    range_name: Optional[str] = None,
    condition_type: Optional[str] = None,
    condition_values: Optional[Union[str, List[Union[str, int, float]]]] = None,
    background_color: Optional[str] = None,
    text_color: Optional[str] = None,
    rule_index: Optional[int] = None,
    gradient_points: Optional[Union[str, List[dict]]] = None,
    sheet_name: Optional[str] = None,
) -> str:
    """
    Manages conditional formatting rules on a Google Sheet. Supports adding,
    updating, and deleting conditional formatting rules via a single tool.

    Args:
        user_google_email (str): The user's Google email address. Required.
        spreadsheet_id (str): The ID of the spreadsheet. Required.
        action (str): The operation to perform. Must be one of "add", "update",
            or "delete".
        range_name (Optional[str]): A1-style range (optionally with sheet name).
            Required for "add". Optional for "update" (preserves existing ranges
            if omitted). Not used for "delete".
        condition_type (Optional[str]): Sheets condition type (e.g., NUMBER_GREATER,
            TEXT_CONTAINS, DATE_BEFORE, CUSTOM_FORMULA). Required for "add".
            Optional for "update" (preserves existing type if omitted).
        condition_values (Optional[Union[str, List[Union[str, int, float]]]]): Values
            for the condition; accepts a list or a JSON string representing a list.
            Depends on condition_type. Used by "add" and "update".
        background_color (Optional[str]): Hex background color to apply when
            condition matches. Used by "add" and "update".
        text_color (Optional[str]): Hex text color to apply when condition matches.
            Used by "add" and "update".
        rule_index (Optional[int]): 0-based index of the rule. For "add", optionally
            specifies insertion position. Required for "update" and "delete".
        gradient_points (Optional[Union[str, List[dict]]]): List (or JSON list) of
            gradient points for a color scale. If provided, a gradient rule is created
            and boolean parameters are ignored. Used by "add" and "update".
        sheet_name (Optional[str]): Sheet name to locate the rule when range_name is
            omitted. Defaults to the first sheet. Used by "update" and "delete".

    Returns:
        str: Confirmation of the operation and the current rule state.
    """
    allowed_actions = {"add", "update", "delete"}
    action_normalized = action.strip().lower()
    if action_normalized not in allowed_actions:
        raise UserInputError(
            f"action must be one of {sorted(allowed_actions)}, got '{action}'."
        )

    logger.info(
        "[manage_conditional_formatting] Invoked. Action: '%s', Email: '%s', Spreadsheet: %s",
        action_normalized,
        user_google_email,
        spreadsheet_id,
    )

    if action_normalized == "add":
        if not range_name:
            raise UserInputError("range_name is required for action 'add'.")
        if not condition_type and not gradient_points:
            raise UserInputError(
                "condition_type (or gradient_points) is required for action 'add'."
            )

        if rule_index is not None and (
            not isinstance(rule_index, int) or rule_index < 0
        ):
            raise UserInputError(
                "rule_index must be a non-negative integer when provided."
            )

        gradient_points_list = _parse_gradient_points(gradient_points)
        condition_values_list = (
            None if gradient_points_list else _parse_condition_values(condition_values)
        )

        sheets, sheet_titles = await _fetch_sheets_with_rules(service, spreadsheet_id)
        grid_range = _parse_a1_range(range_name, sheets)

        target_sheet = None
        for sheet in sheets:
            if sheet.get("properties", {}).get("sheetId") == grid_range.get("sheetId"):
                target_sheet = sheet
                break
        if target_sheet is None:
            raise UserInputError(
                "Target sheet not found while adding conditional formatting."
            )

        current_rules = target_sheet.get("conditionalFormats", []) or []

        insert_at = rule_index if rule_index is not None else len(current_rules)
        if insert_at > len(current_rules):
            raise UserInputError(
                f"rule_index {insert_at} is out of range for sheet "
                f"'{target_sheet.get('properties', {}).get('title', 'Unknown')}' "
                f"(current count: {len(current_rules)})."
            )

        if gradient_points_list:
            new_rule = _build_gradient_rule([grid_range], gradient_points_list)
            rule_desc = "gradient"
            values_desc = ""
            applied_parts = [f"gradient points {len(gradient_points_list)}"]
        else:
            rule, cond_type_normalized = _build_boolean_rule(
                [grid_range],
                condition_type,
                condition_values_list,
                background_color,
                text_color,
            )
            new_rule = rule
            rule_desc = cond_type_normalized
            values_desc = ""
            if condition_values_list:
                values_desc = f" with values {condition_values_list}"
            applied_parts = []
            if background_color:
                applied_parts.append(f"background {background_color}")
            if text_color:
                applied_parts.append(f"text {text_color}")

        new_rules_state = copy.deepcopy(current_rules)
        new_rules_state.insert(insert_at, new_rule)

        add_rule_request = {"rule": new_rule}
        if rule_index is not None:
            add_rule_request["index"] = rule_index

        request_body = {"requests": [{"addConditionalFormatRule": add_rule_request}]}

        await asyncio.to_thread(
            service.spreadsheets()
            .batchUpdate(spreadsheetId=spreadsheet_id, body=request_body)
            .execute
        )

        format_desc = ", ".join(applied_parts) if applied_parts else "format applied"

        sheet_title = target_sheet.get("properties", {}).get("title", "Unknown")
        state_text = _format_conditional_rules_section(
            sheet_title, new_rules_state, sheet_titles, indent=""
        )

        return "\n".join(
            [
                f"Added conditional format on '{range_name}' in spreadsheet "
                f"{spreadsheet_id} for {user_google_email}: "
                f"{rule_desc}{values_desc}; format: {format_desc}.",
                state_text,
            ]
        )

    elif action_normalized == "update":
        if rule_index is None:
            raise UserInputError("rule_index is required for action 'update'.")
        if not isinstance(rule_index, int) or rule_index < 0:
            raise UserInputError("rule_index must be a non-negative integer.")

        gradient_points_list = _parse_gradient_points(gradient_points)
        condition_values_list = (
            None
            if gradient_points_list is not None
            else _parse_condition_values(condition_values)
        )

        sheets, sheet_titles = await _fetch_sheets_with_rules(service, spreadsheet_id)

        target_sheet = None
        grid_range = None
        if range_name:
            grid_range = _parse_a1_range(range_name, sheets)
            for sheet in sheets:
                if sheet.get("properties", {}).get("sheetId") == grid_range.get(
                    "sheetId"
                ):
                    target_sheet = sheet
                    break
        else:
            target_sheet = _select_sheet(sheets, sheet_name)

        if target_sheet is None:
            raise UserInputError(
                "Target sheet not found while updating conditional formatting."
            )

        sheet_props = target_sheet.get("properties", {})
        sheet_id = sheet_props.get("sheetId")
        sheet_title = sheet_props.get("title", f"Sheet {sheet_id}")

        rules = target_sheet.get("conditionalFormats", []) or []
        if rule_index >= len(rules):
            raise UserInputError(
                f"rule_index {rule_index} is out of range for sheet "
                f"'{sheet_title}' (current count: {len(rules)})."
            )

        existing_rule = rules[rule_index]
        ranges_to_use = existing_rule.get("ranges", [])
        if range_name:
            ranges_to_use = [grid_range]
        if not ranges_to_use:
            ranges_to_use = [{"sheetId": sheet_id}]

        new_rule = None
        rule_desc = ""
        values_desc = ""
        format_desc = ""

        if gradient_points_list is not None:
            new_rule = _build_gradient_rule(ranges_to_use, gradient_points_list)
            rule_desc = "gradient"
            format_desc = f"gradient points {len(gradient_points_list)}"
        elif "gradientRule" in existing_rule:
            if any(
                [
                    background_color,
                    text_color,
                    condition_type,
                    condition_values_list,
                ]
            ):
                raise UserInputError(
                    "Existing rule is a gradient rule. Provide gradient_points "
                    "to update it, or omit formatting/condition parameters to "
                    "keep it unchanged."
                )
            new_rule = {
                "ranges": ranges_to_use,
                "gradientRule": existing_rule.get("gradientRule", {}),
            }
            rule_desc = "gradient"
            format_desc = "gradient (unchanged)"
        else:
            existing_boolean = existing_rule.get("booleanRule", {})
            existing_condition = existing_boolean.get("condition", {})
            existing_format = copy.deepcopy(existing_boolean.get("format", {}))

            cond_type = (condition_type or existing_condition.get("type", "")).upper()
            if not cond_type:
                raise UserInputError("condition_type is required for boolean rules.")
            if cond_type not in CONDITION_TYPES:
                raise UserInputError(
                    f"condition_type must be one of {sorted(CONDITION_TYPES)}."
                )

            if condition_values_list is not None:
                cond_values = [
                    {"userEnteredValue": str(val)} for val in condition_values_list
                ]
            else:
                cond_values = existing_condition.get("values")

            new_format = copy.deepcopy(existing_format) if existing_format else {}
            if background_color is not None:
                bg_color_parsed = _parse_hex_color(background_color)
                if bg_color_parsed:
                    new_format["backgroundColor"] = bg_color_parsed
                elif "backgroundColor" in new_format:
                    del new_format["backgroundColor"]
            if text_color is not None:
                text_color_parsed = _parse_hex_color(text_color)
                text_format = copy.deepcopy(new_format.get("textFormat", {}))
                if text_color_parsed:
                    text_format["foregroundColor"] = text_color_parsed
                elif "foregroundColor" in text_format:
                    del text_format["foregroundColor"]
                if text_format:
                    new_format["textFormat"] = text_format
                elif "textFormat" in new_format:
                    del new_format["textFormat"]

            if not new_format:
                raise UserInputError(
                    "At least one format option must remain on the rule."
                )

            new_rule = {
                "ranges": ranges_to_use,
                "booleanRule": {
                    "condition": {"type": cond_type},
                    "format": new_format,
                },
            }
            if cond_values:
                new_rule["booleanRule"]["condition"]["values"] = cond_values

            rule_desc = cond_type
            if condition_values_list:
                values_desc = f" with values {condition_values_list}"
            format_parts = []
            if "backgroundColor" in new_format:
                format_parts.append("background updated")
            if "textFormat" in new_format and new_format["textFormat"].get(
                "foregroundColor"
            ):
                format_parts.append("text color updated")
            format_desc = (
                ", ".join(format_parts) if format_parts else "format preserved"
            )

        new_rules_state = copy.deepcopy(rules)
        new_rules_state[rule_index] = new_rule

        request_body = {
            "requests": [
                {
                    "updateConditionalFormatRule": {
                        "index": rule_index,
                        "sheetId": sheet_id,
                        "rule": new_rule,
                    }
                }
            ]
        }

        await asyncio.to_thread(
            service.spreadsheets()
            .batchUpdate(spreadsheetId=spreadsheet_id, body=request_body)
            .execute
        )

        state_text = _format_conditional_rules_section(
            sheet_title, new_rules_state, sheet_titles, indent=""
        )

        return "\n".join(
            [
                f"Updated conditional format at index {rule_index} on sheet "
                f"'{sheet_title}' in spreadsheet {spreadsheet_id} "
                f"for {user_google_email}: "
                f"{rule_desc}{values_desc}; format: {format_desc}.",
                state_text,
            ]
        )

    else:  # action_normalized == "delete"
        if rule_index is None:
            raise UserInputError("rule_index is required for action 'delete'.")
        if not isinstance(rule_index, int) or rule_index < 0:
            raise UserInputError("rule_index must be a non-negative integer.")

        sheets, sheet_titles = await _fetch_sheets_with_rules(service, spreadsheet_id)
        target_sheet = _select_sheet(sheets, sheet_name)

        sheet_props = target_sheet.get("properties", {})
        sheet_id = sheet_props.get("sheetId")
        target_sheet_name = sheet_props.get("title", f"Sheet {sheet_id}")
        rules = target_sheet.get("conditionalFormats", []) or []
        if rule_index >= len(rules):
            raise UserInputError(
                f"rule_index {rule_index} is out of range for sheet "
                f"'{target_sheet_name}' (current count: {len(rules)})."
            )

        new_rules_state = copy.deepcopy(rules)
        del new_rules_state[rule_index]

        request_body = {
            "requests": [
                {
                    "deleteConditionalFormatRule": {
                        "index": rule_index,
                        "sheetId": sheet_id,
                    }
                }
            ]
        }

        await asyncio.to_thread(
            service.spreadsheets()
            .batchUpdate(spreadsheetId=spreadsheet_id, body=request_body)
            .execute
        )

        state_text = _format_conditional_rules_section(
            target_sheet_name, new_rules_state, sheet_titles, indent=""
        )

        return "\n".join(
            [
                f"Deleted conditional format at index {rule_index} on sheet "
                f"'{target_sheet_name}' in spreadsheet {spreadsheet_id} "
                f"for {user_google_email}.",
                state_text,
            ]
        )
async def create_spreadsheet(
    service,
    user_google_email: str,
    title: str,
    sheet_names: Optional[List[str]] = None,
) -> str:
    """
    Creates a new Google Spreadsheet.

    Args:
        user_google_email (str): The user's Google email address. Required.
        title (str): The title of the new spreadsheet. Required.
        sheet_names (Optional[List[str]]): List of sheet names to create. If not provided, creates one sheet with default name.

    Returns:
        str: Information about the newly created spreadsheet including ID, URL, and locale.
    """
    logger.info(
        f"[create_spreadsheet] Invoked. Email: '{user_google_email}', Title: {title}"
    )

    spreadsheet_body = {"properties": {"title": title}}

    if sheet_names:
        spreadsheet_body["sheets"] = [
            {"properties": {"title": sheet_name}} for sheet_name in sheet_names
        ]

    spreadsheet = await asyncio.to_thread(
        service.spreadsheets()
        .create(
            body=spreadsheet_body,
            fields="spreadsheetId,spreadsheetUrl,properties(title,locale)",
        )
        .execute
    )

    properties = spreadsheet.get("properties", {})
    spreadsheet_id = spreadsheet.get("spreadsheetId")
    spreadsheet_url = spreadsheet.get("spreadsheetUrl")
    locale = properties.get("locale", "Unknown")

    text_output = (
        f"Successfully created spreadsheet '{title}' for {user_google_email}. "
        f"ID: {spreadsheet_id} | URL: {spreadsheet_url} | Locale: {locale}"
    )

    logger.info(
        f"Successfully created spreadsheet for {user_google_email}. ID: {spreadsheet_id}"
    )
    return text_output
async def create_sheet(
    service,
    user_google_email: str,
    spreadsheet_id: str,
    sheet_name: Optional[str] = None,
    source_sheet_name: Optional[str] = None,
    insert_sheet_index: Optional[int] = None,
) -> str:
    """Creates a new sheet or duplicates an existing sheet (user_google_email: str, spreadsheet_id: str, sheet_name: Optional[str] = None, source_sheet_name: Optional[str] = None, insert_sheet_index: Optional[int] = None)."""
    if insert_sheet_index is not None and (
        isinstance(insert_sheet_index, bool)
        or not isinstance(insert_sheet_index, int)
        or insert_sheet_index < 0
    ):
        raise UserInputError("insert_sheet_index must be a non-negative integer.")

    if source_sheet_name is not None:
        source_sheet_name = source_sheet_name.strip()
        if not source_sheet_name:
            raise UserInputError("source_sheet_name must be a non-empty string")

        logger.info(
            f"[create_sheet] Duplicate invoked. Email: '{user_google_email}', "
            f"Spreadsheet: {spreadsheet_id}, Source: {source_sheet_name}"
        )

        spreadsheet = await asyncio.to_thread(
            service.spreadsheets()
            .get(spreadsheetId=spreadsheet_id, fields="sheets.properties")
            .execute
        )

        sheets = spreadsheet.get("sheets", [])
        source_sheet = _select_sheet(sheets, source_sheet_name)
        source_sheet_id = source_sheet["properties"]["sheetId"]

        dup_request = {"sourceSheetId": source_sheet_id}
        if sheet_name is not None:
            dup_request["newSheetName"] = sheet_name
        if insert_sheet_index is not None:
            dup_request["insertSheetIndex"] = insert_sheet_index

        request_body = {"requests": [{"duplicateSheet": dup_request}]}

        response = await asyncio.to_thread(
            service.spreadsheets()
            .batchUpdate(spreadsheetId=spreadsheet_id, body=request_body)
            .execute
        )

        new_props = response["replies"][0]["duplicateSheet"]["properties"]
        new_id = new_props["sheetId"]
        new_title = new_props["title"]

        text_output = (
            f"Successfully duplicated '{source_sheet_name}' to '{new_title}' "
            f"(ID: {new_id}) in spreadsheet {spreadsheet_id} for {user_google_email}."
        )

        logger.info(
            f"Successfully duplicated sheet for {user_google_email}. "
            f"New sheet: '{new_title}' (ID: {new_id})"
        )
        return text_output

    logger.info(
        f"[create_sheet] Invoked. Email: '{user_google_email}', Spreadsheet: {spreadsheet_id}, Sheet: {sheet_name}"
    )

    add_request: dict = {"properties": {}}
    if sheet_name is not None:
        add_request["properties"]["title"] = sheet_name
    if insert_sheet_index is not None:
        add_request["properties"]["index"] = insert_sheet_index

    request_body = {"requests": [{"addSheet": add_request}]}

    response = await asyncio.to_thread(
        service.spreadsheets()
        .batchUpdate(spreadsheetId=spreadsheet_id, body=request_body)
        .execute
    )

    sheet_props = response["replies"][0]["addSheet"]["properties"]
    sheet_id = sheet_props["sheetId"]
    created_sheet_name = sheet_props.get("title", sheet_name or "Untitled")

    text_output = f"Successfully created sheet '{created_sheet_name}' (ID: {sheet_id}) in spreadsheet {spreadsheet_id} for {user_google_email}."

    logger.info(
        f"Successfully created sheet for {user_google_email}. Sheet ID: {sheet_id}"
    )
    return text_output


def _to_extended_value(val) -> dict:
    """Convert a Python value to a Sheets API ExtendedValue dict."""
    if isinstance(val, bool):
        return {"boolValue": val}
    if isinstance(val, (int, float)):
        return {"numberValue": val}
    s = str(val)
    if s.startswith("="):
        return {"formulaValue": s}
    return {"stringValue": s}
async def list_sheet_tables(
    service,
    user_google_email: str,
    spreadsheet_id: str,
) -> str:
    """
    Lists all structured tables in a spreadsheet with their IDs, names, ranges,
    and column details. Use this to find table IDs for append_table_rows.

    Args:
        user_google_email (str): The user's Google email address. Required.
        spreadsheet_id (str): The ID of the spreadsheet. Required.

    Returns:
        str: Formatted list of tables with their IDs, names, ranges, and columns.
    """
    logger.info(
        f"[list_sheet_tables] Invoked. Email: '{user_google_email}', "
        f"Spreadsheet: {spreadsheet_id}"
    )

    spreadsheet = await asyncio.to_thread(
        service.spreadsheets()
        .get(
            spreadsheetId=spreadsheet_id,
            fields="sheets(properties(title,sheetId),tables)",
        )
        .execute
    )

    tables_found = []
    for sheet in spreadsheet.get("sheets", []):
        sheet_title = sheet.get("properties", {}).get("title", "Unknown")
        for table in sheet.get("tables", []):
            table_id = table.get("tableId")
            name = table.get("name", "Unnamed")
            range_info = table.get("range", {})

            start_row = range_info.get("startRowIndex", 0)
            end_row = range_info.get("endRowIndex", "?")
            start_col = range_info.get("startColumnIndex", 0)
            end_col = range_info.get("endColumnIndex", "?")

            columns = []
            for col in table.get("columnProperties", []):
                col_name = col.get("columnName", "")
                columns.append(col_name)

            tables_found.append(
                f"  Table ID: {table_id}\n"
                f"  Name: {name}\n"
                f"  Sheet: {sheet_title}\n"
                f"  Range: rows {start_row}-{end_row}, cols {start_col}-{end_col}\n"
                f"  Columns: {', '.join(columns) if columns else 'N/A'}"
            )

    if not tables_found:
        text_output = (
            f"No structured tables found in spreadsheet {spreadsheet_id} "
            f"for {user_google_email}."
        )
    else:
        text_output = (
            f"Found {len(tables_found)} table(s) in spreadsheet {spreadsheet_id} "
            f"for {user_google_email}:\n\n" + "\n\n".join(tables_found)
        )

    logger.info(
        f"[list_sheet_tables] Found {len(tables_found)} tables for {user_google_email}"
    )
    return text_output
async def append_table_rows(
    service,
    user_google_email: str,
    spreadsheet_id: str,
    table_id: str,
    values: Union[str, List[List]],
) -> str:
    """
    Appends rows to a structured table in a Google Sheet. The rows are added
    to the end of the table body, automatically extending the table range.

    Use list_sheet_tables first to find the table ID.

    Args:
        user_google_email (str): The user's Google email address. Required.
        spreadsheet_id (str): The ID of the spreadsheet. Required.
        table_id (str): The ID of the table to append to (get from list_sheet_tables). Required.
        values (Union[str, List[List]]): 2D array of values to append. Each inner
            list is one row. Can be a JSON string or Python list. Required.

    Returns:
        str: Confirmation message with the number of rows appended.
    """
    logger.info(
        f"[append_table_rows] Invoked. Email: '{user_google_email}', "
        f"Spreadsheet: {spreadsheet_id}, Table: {table_id}"
    )

    # Parse values if JSON string
    if isinstance(values, str):
        try:
            values = json.loads(values)
        except json.JSONDecodeError as e:
            raise UserInputError(f"Invalid JSON in values parameter: {e}")

    if not values or not isinstance(values, list):
        raise UserInputError("values must be a non-empty 2D list of cell values.")

    # Resolve the sheet ID for the table before building the request
    spreadsheet = await asyncio.to_thread(
        service.spreadsheets()
        .get(
            spreadsheetId=spreadsheet_id,
            fields="sheets(properties(sheetId),tables(tableId))",
        )
        .execute
    )

    sheet_id = None
    for sheet in spreadsheet.get("sheets", []):
        for table in sheet.get("tables", []):
            if table.get("tableId") == table_id:
                sheet_id = sheet["properties"]["sheetId"]
                break
        if sheet_id is not None:
            break

    if sheet_id is None:
        raise UserInputError(
            f"Table '{table_id}' not found in spreadsheet {spreadsheet_id}. "
            f"Use list_sheet_tables to find valid table IDs."
        )

    # Build cell data for appendCells
    rows = []
    for row_values in values:
        if not isinstance(row_values, list):
            raise UserInputError(
                "Each row in values must be a list. "
                'Expected format: [["val1", "val2"], ["val3", "val4"]]'
            )
        cells = []
        for val in row_values:
            cells.append({"userEnteredValue": _to_extended_value(val)})
        rows.append({"values": cells})

    request_body = {
        "requests": [
            {
                "appendCells": {
                    "sheetId": sheet_id,
                    "tableId": table_id,
                    "rows": rows,
                    "fields": "userEnteredValue",
                }
            }
        ]
    }

    await asyncio.to_thread(
        service.spreadsheets()
        .batchUpdate(spreadsheetId=spreadsheet_id, body=request_body)
        .execute
    )

    num_rows = len(values)
    text_output = (
        f"Successfully appended {num_rows} row(s) to table '{table_id}' "
        f"in spreadsheet {spreadsheet_id} for {user_google_email}."
    )

    logger.info(f"[append_table_rows] Appended {num_rows} rows for {user_google_email}")
    return text_output


def _build_column_visibility_requests(sheet_id, letters, hidden, label):
    """Build updateDimensionProperties requests to hide/unhide columns."""
    if not isinstance(letters, list):
        raise UserInputError(f"{label} must be a list of column letters.")
    reqs = []
    for col_letter in letters:
        col_idx = _column_to_index(str(col_letter).upper())
        if col_idx is None:
            raise UserInputError(f"Invalid column letter in {label}: '{col_letter}'.")
        reqs.append(
            {
                "updateDimensionProperties": {
                    "range": {
                        "sheetId": sheet_id,
                        "dimension": "COLUMNS",
                        "startIndex": col_idx,
                        "endIndex": col_idx + 1,
                    },
                    "properties": {"hiddenByUser": hidden},
                    "fields": "hiddenByUser",
                }
            }
        )
    return reqs


def _build_row_visibility_requests(sheet_id, row_nums, hidden, label):
    """Build updateDimensionProperties requests to hide/unhide rows."""
    if not isinstance(row_nums, list):
        raise UserInputError(f"{label} must be a list of row numbers.")
    reqs = []
    for row_num in row_nums:
        try:
            row_num = int(row_num)
        except ValueError as exc:
            raise UserInputError(
                f"Row number must be an integer in {label}, got {row_num}."
            ) from exc
        if row_num < 1:
            raise UserInputError(f"Row number must be >= 1 in {label}, got {row_num}.")
        reqs.append(
            {
                "updateDimensionProperties": {
                    "range": {
                        "sheetId": sheet_id,
                        "dimension": "ROWS",
                        "startIndex": row_num - 1,
                        "endIndex": row_num,
                    },
                    "properties": {"hiddenByUser": hidden},
                    "fields": "hiddenByUser",
                }
            }
        )
    return reqs


async def _resize_sheet_dimensions_impl(
    service,
    spreadsheet_id: str,
    sheet_name: Optional[str] = None,
    column_sizes: Optional[Union[str, dict]] = None,
    row_sizes: Optional[Union[str, dict]] = None,
    auto_resize_columns: Optional[Union[str, List[str]]] = None,
    auto_resize_rows: Optional[Union[str, List[int]]] = None,
    frozen_row_count: Optional[int] = None,
    frozen_column_count: Optional[int] = None,
    hide_columns: Optional[Union[str, List[str]]] = None,
    unhide_columns: Optional[Union[str, List[str]]] = None,
    hide_rows: Optional[Union[str, List[int]]] = None,
    unhide_rows: Optional[Union[str, List[int]]] = None,
    insert_rows: Optional[int] = None,
    insert_rows_at: Optional[int] = None,
    insert_columns: Optional[int] = None,
    insert_columns_at: Optional[str] = None,
    delete_rows: Optional[Union[str, List[int]]] = None,
    delete_row_range: Optional[str] = None,
    delete_columns: Optional[Union[str, List[str]]] = None,
) -> dict:
    """Internal implementation for resize_sheet_dimensions.

    Manages sheet-level dimension properties: resize columns/rows, auto-resize
    to fit content, freeze rows/columns, hide/unhide rows/columns, and
    insert/delete rows/columns.

    Args:
        service: Google Sheets API service client.
        spreadsheet_id: The ID of the spreadsheet.
        sheet_name: Sheet name to target. Defaults to the first sheet.
        column_sizes: Dict mapping column letters to pixel widths.
        row_sizes: Dict mapping 1-based row numbers to pixel heights.
        auto_resize_columns: List of column letters to auto-resize to fit content.
        auto_resize_rows: List of 1-based row numbers to auto-resize to fit content.
        frozen_row_count: Number of rows to freeze from the top (0 to unfreeze).
        frozen_column_count: Number of columns to freeze from the left (0 to unfreeze).
        hide_columns: List of column letters to hide.
        unhide_columns: List of column letters to unhide.
        hide_rows: List of 1-based row numbers to hide.
        unhide_rows: List of 1-based row numbers to unhide.
        insert_rows: Number of rows to insert.
        insert_rows_at: 1-based row number to insert before. Appends to end if omitted.
        insert_columns: Number of columns to insert.
        insert_columns_at: Column letter to insert before (e.g. "C"). Appends to end if omitted.
        delete_rows: List of 1-based row numbers to delete.
        delete_row_range: Contiguous range of rows to delete, as "start:end"
            (1-based, inclusive). Example: "5:10". More efficient than
            delete_rows for large contiguous ranges.
        delete_columns: List of column letters to delete.

    Returns:
        Dictionary with keys: spreadsheet_id, summary.
    """
    has_any = any(
        [
            column_sizes,
            row_sizes,
            auto_resize_columns,
            auto_resize_rows,
            frozen_row_count is not None,
            frozen_column_count is not None,
            hide_columns,
            unhide_columns,
            hide_rows,
            unhide_rows,
            insert_rows is not None,
            insert_columns is not None,
            delete_rows,
            delete_row_range,
            delete_columns,
        ]
    )
    if not has_any:
        raise UserInputError(
            "Provide at least one of: column_sizes, row_sizes, "
            "auto_resize_columns, auto_resize_rows, frozen_row_count, "
            "frozen_column_count, hide_columns, unhide_columns, "
            "hide_rows, unhide_rows, insert_rows, insert_columns, "
            "delete_rows, delete_row_range, or delete_columns."
        )

    # Parse JSON string parameters
    def _parse_json(value, name):
        if not isinstance(value, str):
            return value
        try:
            return json.loads(value)
        except json.JSONDecodeError as e:
            raise UserInputError(f"Invalid JSON for {name}: {e}")

    column_sizes = _parse_json(column_sizes, "column_sizes")
    row_sizes = _parse_json(row_sizes, "row_sizes")
    auto_resize_columns = _parse_json(auto_resize_columns, "auto_resize_columns")
    auto_resize_rows = _parse_json(auto_resize_rows, "auto_resize_rows")
    hide_columns = _parse_json(hide_columns, "hide_columns")
    unhide_columns = _parse_json(unhide_columns, "unhide_columns")
    hide_rows = _parse_json(hide_rows, "hide_rows")
    unhide_rows = _parse_json(unhide_rows, "unhide_rows")
    delete_rows = _parse_json(delete_rows, "delete_rows")
    delete_columns = _parse_json(delete_columns, "delete_columns")

    # Get sheet metadata to resolve sheet ID
    metadata = await asyncio.to_thread(
        service.spreadsheets()
        .get(
            spreadsheetId=spreadsheet_id,
            fields="sheets(properties(sheetId,title))",
        )
        .execute
    )
    sheets = metadata.get("sheets", [])
    if not sheets:
        raise UserInputError("No sheets found in spreadsheet.")

    # Find target sheet
    target_sheet = None
    if sheet_name:
        for sheet in sheets:
            if sheet.get("properties", {}).get("title") == sheet_name:
                target_sheet = sheet
                break
        if not target_sheet:
            raise UserInputError(f"Sheet '{sheet_name}' not found.")
    else:
        target_sheet = sheets[0]

    sheet_id = target_sheet["properties"]["sheetId"]

    requests = []
    applied_parts = []

    # Build column resize requests
    if column_sizes:
        if not isinstance(column_sizes, dict):
            raise UserInputError(
                "column_sizes must be a dict mapping column letters to pixel widths."
            )
        for col_letter, pixel_size in column_sizes.items():
            col_idx = _column_to_index(col_letter.upper())
            if col_idx is None:
                raise UserInputError(f"Invalid column letter: '{col_letter}'.")
            if not isinstance(pixel_size, (int, float)) or pixel_size <= 0:
                raise UserInputError(
                    f"Pixel size for column '{col_letter}' must be a positive number."
                )
            requests.append(
                {
                    "updateDimensionProperties": {
                        "range": {
                            "sheetId": sheet_id,
                            "dimension": "COLUMNS",
                            "startIndex": col_idx,
                            "endIndex": col_idx + 1,
                        },
                        "properties": {"pixelSize": int(pixel_size)},
                        "fields": "pixelSize",
                    }
                }
            )
        applied_parts.append(
            f"resized columns: {', '.join(f'{k}={v}px' for k, v in column_sizes.items())}"
        )

    # Build row resize requests
    if row_sizes:
        if not isinstance(row_sizes, dict):
            raise UserInputError(
                "row_sizes must be a dict mapping row numbers to pixel heights."
            )
        for row_num_str, pixel_size in row_sizes.items():
            try:
                row_num = int(row_num_str)
            except ValueError as exc:
                raise UserInputError(
                    f"Row number must be an integer >= 1, got {row_num_str}."
                ) from exc
            if row_num < 1:
                raise UserInputError(f"Row number must be >= 1, got {row_num}.")
            if not isinstance(pixel_size, (int, float)) or pixel_size <= 0:
                raise UserInputError(
                    f"Pixel size for row {row_num} must be a positive number."
                )
            requests.append(
                {
                    "updateDimensionProperties": {
                        "range": {
                            "sheetId": sheet_id,
                            "dimension": "ROWS",
                            "startIndex": row_num - 1,
                            "endIndex": row_num,
                        },
                        "properties": {"pixelSize": int(pixel_size)},
                        "fields": "pixelSize",
                    }
                }
            )
        applied_parts.append(
            f"resized rows: {', '.join(f'{k}={v}px' for k, v in row_sizes.items())}"
        )

    # Build auto-resize column requests
    if auto_resize_columns:
        if not isinstance(auto_resize_columns, list):
            raise UserInputError(
                "auto_resize_columns must be a list of column letters."
            )
        for col_letter in auto_resize_columns:
            col_idx = _column_to_index(str(col_letter).upper())
            if col_idx is None:
                raise UserInputError(f"Invalid column letter: '{col_letter}'.")
            requests.append(
                {
                    "autoResizeDimensions": {
                        "dimensions": {
                            "sheetId": sheet_id,
                            "dimension": "COLUMNS",
                            "startIndex": col_idx,
                            "endIndex": col_idx + 1,
                        }
                    }
                }
            )
        applied_parts.append(
            f"auto-resized columns: {', '.join(str(c) for c in auto_resize_columns)}"
        )

    # Build auto-resize row requests
    if auto_resize_rows:
        if not isinstance(auto_resize_rows, list):
            raise UserInputError("auto_resize_rows must be a list of row numbers.")
        for row_num in auto_resize_rows:
            try:
                parsed_row_num = int(row_num)
            except ValueError as exc:
                raise UserInputError(
                    f"Row number must be an integer >= 1, got {row_num}."
                ) from exc
            if parsed_row_num < 1:
                raise UserInputError(f"Row number must be >= 1, got {parsed_row_num}.")
            requests.append(
                {
                    "autoResizeDimensions": {
                        "dimensions": {
                            "sheetId": sheet_id,
                            "dimension": "ROWS",
                            "startIndex": parsed_row_num - 1,
                            "endIndex": parsed_row_num,
                        }
                    }
                }
            )
        applied_parts.append(
            f"auto-resized rows: {', '.join(str(r) for r in auto_resize_rows)}"
        )

    # Build freeze requests
    grid_properties = {}
    grid_fields = []
    if frozen_row_count is not None:
        if not isinstance(frozen_row_count, int) or frozen_row_count < 0:
            raise UserInputError("frozen_row_count must be a non-negative integer.")
        grid_properties["frozenRowCount"] = frozen_row_count
        grid_fields.append("gridProperties.frozenRowCount")
        applied_parts.append(
            f"froze {frozen_row_count} row(s)"
            if frozen_row_count > 0
            else "unfroze rows"
        )

    if frozen_column_count is not None:
        if not isinstance(frozen_column_count, int) or frozen_column_count < 0:
            raise UserInputError("frozen_column_count must be a non-negative integer.")
        grid_properties["frozenColumnCount"] = frozen_column_count
        grid_fields.append("gridProperties.frozenColumnCount")
        applied_parts.append(
            f"froze {frozen_column_count} column(s)"
            if frozen_column_count > 0
            else "unfroze columns"
        )

    if grid_properties:
        requests.append(
            {
                "updateSheetProperties": {
                    "properties": {
                        "sheetId": sheet_id,
                        "gridProperties": grid_properties,
                    },
                    "fields": ",".join(grid_fields),
                }
            }
        )

    # Build hide/unhide column requests
    if hide_columns:
        requests.extend(
            _build_column_visibility_requests(
                sheet_id, hide_columns, True, "hide_columns"
            )
        )
        applied_parts.append(f"hid columns: {', '.join(str(c) for c in hide_columns)}")

    if unhide_columns:
        requests.extend(
            _build_column_visibility_requests(
                sheet_id, unhide_columns, False, "unhide_columns"
            )
        )
        applied_parts.append(
            f"unhid columns: {', '.join(str(c) for c in unhide_columns)}"
        )

    # Build hide/unhide row requests
    if hide_rows:
        requests.extend(
            _build_row_visibility_requests(sheet_id, hide_rows, True, "hide_rows")
        )
        applied_parts.append(f"hid rows: {', '.join(str(r) for r in hide_rows)}")

    if unhide_rows:
        requests.extend(
            _build_row_visibility_requests(sheet_id, unhide_rows, False, "unhide_rows")
        )
        applied_parts.append(f"unhid rows: {', '.join(str(r) for r in unhide_rows)}")

    # Build insert row requests
    if insert_rows is not None:
        if not isinstance(insert_rows, int) or insert_rows < 1:
            raise UserInputError("insert_rows must be a positive integer.")
        if insert_rows_at is not None:
            if not isinstance(insert_rows_at, int) or insert_rows_at < 1:
                raise UserInputError(
                    "insert_rows_at must be a positive integer (1-based)."
                )
            start_idx = insert_rows_at - 1
        else:
            start_idx = None

        if start_idx is not None:
            requests.append(
                {
                    "insertDimension": {
                        "range": {
                            "sheetId": sheet_id,
                            "dimension": "ROWS",
                            "startIndex": start_idx,
                            "endIndex": start_idx + insert_rows,
                        },
                        "inheritFromBefore": start_idx > 0,
                    }
                }
            )
            applied_parts.append(
                f"inserted {insert_rows} row(s) at row {insert_rows_at}"
            )
        else:
            requests.append(
                {
                    "appendDimension": {
                        "sheetId": sheet_id,
                        "dimension": "ROWS",
                        "length": insert_rows,
                    }
                }
            )
            applied_parts.append(f"appended {insert_rows} row(s)")

    # Build insert column requests
    if insert_columns is not None:
        if not isinstance(insert_columns, int) or insert_columns < 1:
            raise UserInputError("insert_columns must be a positive integer.")
        if insert_columns_at is not None:
            col_idx = _column_to_index(str(insert_columns_at).upper())
            if col_idx is None:
                raise UserInputError(
                    f"Invalid column letter for insert_columns_at: '{insert_columns_at}'."
                )
            requests.append(
                {
                    "insertDimension": {
                        "range": {
                            "sheetId": sheet_id,
                            "dimension": "COLUMNS",
                            "startIndex": col_idx,
                            "endIndex": col_idx + insert_columns,
                        },
                        "inheritFromBefore": col_idx > 0,
                    }
                }
            )
            applied_parts.append(
                f"inserted {insert_columns} column(s) at column {insert_columns_at}"
            )
        else:
            requests.append(
                {
                    "appendDimension": {
                        "sheetId": sheet_id,
                        "dimension": "COLUMNS",
                        "length": insert_columns,
                    }
                }
            )
            applied_parts.append(f"appended {insert_columns} column(s)")

    # Reject mixing delete_rows and delete_row_range — their interleaved
    # deleteDimension requests shift indices unpredictably.
    if delete_rows and delete_row_range:
        raise UserInputError(
            "delete_rows and delete_row_range cannot be used together. "
            "Specify one or the other."
        )

    # Build delete row requests (process in reverse to keep indices stable)
    if delete_rows:
        if not isinstance(delete_rows, list):
            raise UserInputError("delete_rows must be a list of row numbers.")
        parsed_delete_rows = []
        for row_num in delete_rows:
            try:
                parsed_delete_rows.append(int(row_num))
            except ValueError as exc:
                raise UserInputError(
                    f"Row number must be an integer >= 1 in delete_rows, got {row_num}."
                ) from exc
        sorted_rows = sorted(parsed_delete_rows, reverse=True)
        for row_num in sorted_rows:
            if row_num < 1:
                raise UserInputError(
                    f"Row number must be >= 1 in delete_rows, got {row_num}."
                )
            requests.append(
                {
                    "deleteDimension": {
                        "range": {
                            "sheetId": sheet_id,
                            "dimension": "ROWS",
                            "startIndex": row_num - 1,
                            "endIndex": row_num,
                        }
                    }
                }
            )
        applied_parts.append(f"deleted rows: {', '.join(str(r) for r in delete_rows)}")

    # Build delete row range request (contiguous range, single API call)
    if delete_row_range:
        if isinstance(delete_row_range, str) and ":" in delete_row_range:
            parts = delete_row_range.split(":", 1)
            try:
                range_start = int(parts[0])
                range_end = int(parts[1])
            except ValueError as exc:
                raise UserInputError(
                    f"Invalid delete_row_range format: '{delete_row_range}'. "
                    f"Expected 'start:end' with integer row numbers."
                ) from exc
        else:
            raise UserInputError(
                f"delete_row_range must be a 'start:end' string (e.g. '5:10'), "
                f"got: '{delete_row_range}'."
            )
        if range_start < 1 or range_end < range_start:
            raise UserInputError(
                f"Invalid row range: start={range_start}, end={range_end}. "
                f"Rows are 1-based and end must be >= start."
            )
        requests.append(
            {
                "deleteDimension": {
                    "range": {
                        "sheetId": sheet_id,
                        "dimension": "ROWS",
                        "startIndex": range_start - 1,
                        "endIndex": range_end,
                    }
                }
            }
        )
        num_range_deleted = range_end - range_start + 1
        applied_parts.append(
            f"deleted row range {range_start}-{range_end} ({num_range_deleted} row(s))"
        )

    # Build delete column requests (process in reverse to keep indices stable)
    if delete_columns:
        if not isinstance(delete_columns, list):
            raise UserInputError("delete_columns must be a list of column letters.")
        col_indices = []
        for col_letter in delete_columns:
            col_idx = _column_to_index(str(col_letter).upper())
            if col_idx is None:
                raise UserInputError(
                    f"Invalid column letter in delete_columns: '{col_letter}'."
                )
            col_indices.append((col_letter, col_idx))
        # Sort by index descending to keep indices stable during deletion
        col_indices.sort(key=lambda x: x[1], reverse=True)
        for _, col_idx in col_indices:
            requests.append(
                {
                    "deleteDimension": {
                        "range": {
                            "sheetId": sheet_id,
                            "dimension": "COLUMNS",
                            "startIndex": col_idx,
                            "endIndex": col_idx + 1,
                        }
                    }
                }
            )
        applied_parts.append(
            f"deleted columns: {', '.join(str(c) for c in delete_columns)}"
        )

    # Execute batch update
    await asyncio.to_thread(
        service.spreadsheets()
        .batchUpdate(spreadsheetId=spreadsheet_id, body={"requests": requests})
        .execute
    )

    return {
        "spreadsheet_id": spreadsheet_id,
        "summary": "; ".join(applied_parts),
    }
async def resize_sheet_dimensions(
    service,
    user_google_email: str,
    spreadsheet_id: str,
    sheet_name: Optional[str] = None,
    column_sizes: Optional[Union[str, dict]] = None,
    row_sizes: Optional[Union[str, dict]] = None,
    auto_resize_columns: Optional[Union[str, List[str]]] = None,
    auto_resize_rows: Optional[Union[str, List[int]]] = None,
    frozen_row_count: Optional[int] = None,
    frozen_column_count: Optional[int] = None,
    hide_columns: Optional[Union[str, List[str]]] = None,
    unhide_columns: Optional[Union[str, List[str]]] = None,
    hide_rows: Optional[Union[str, List[int]]] = None,
    unhide_rows: Optional[Union[str, List[int]]] = None,
    insert_rows: Optional[int] = None,
    insert_rows_at: Optional[int] = None,
    insert_columns: Optional[int] = None,
    insert_columns_at: Optional[str] = None,
    delete_rows: Optional[Union[str, List[int]]] = None,
    delete_row_range: Optional[str] = None,
    delete_columns: Optional[Union[str, List[str]]] = None,
) -> str:
    """
    Manages sheet-level dimension properties: resize columns/rows, auto-resize
    to fit content, freeze rows/columns, hide/unhide rows/columns, and
    insert/delete rows/columns.

    Args:
        user_google_email (str): The user's Google email address. Required.
        spreadsheet_id (str): The ID of the spreadsheet. Required.
        sheet_name (Optional[str]): Sheet name to target. Defaults to the
            first sheet if not provided.
        column_sizes (Optional[Union[str, dict]]): Dict mapping column letters
            to pixel widths. Example: {"A": 200, "C": 300}. Can be a JSON
            string or Python dict.
        row_sizes (Optional[Union[str, dict]]): Dict mapping 1-based row
            numbers to pixel heights. Example: {"1": 40, "3": 60}. Can be
            a JSON string or Python dict.
        auto_resize_columns (Optional[Union[str, List[str]]]): List of column
            letters to auto-resize to fit content. Example: ["A", "B"].
        auto_resize_rows (Optional[Union[str, List[int]]]): List of 1-based
            row numbers to auto-resize to fit content. Example: [1, 2].
        frozen_row_count (Optional[int]): Number of rows to freeze from the
            top. Use 0 to unfreeze all rows.
        frozen_column_count (Optional[int]): Number of columns to freeze from
            the left. Use 0 to unfreeze all columns.
        hide_columns (Optional[Union[str, List[str]]]): List of column letters
            to hide. Example: ["C", "D"].
        unhide_columns (Optional[Union[str, List[str]]]): List of column
            letters to unhide. Example: ["C", "D"].
        hide_rows (Optional[Union[str, List[int]]]): List of 1-based row
            numbers to hide. Example: [3, 4].
        unhide_rows (Optional[Union[str, List[int]]]): List of 1-based row
            numbers to unhide. Example: [3, 4].
        insert_rows (Optional[int]): Number of rows to insert.
        insert_rows_at (Optional[int]): 1-based row number to insert before.
            Appends to the end of the sheet if omitted.
        insert_columns (Optional[int]): Number of columns to insert.
        insert_columns_at (Optional[str]): Column letter to insert before
            (e.g. "C"). Appends to the end if omitted.
        delete_rows (Optional[Union[str, List[int]]]): List of 1-based row
            numbers to delete. Example: [5, 6]. Best for non-contiguous rows.
        delete_row_range (Optional[str]): Contiguous range of rows to delete,
            as "start:end" (1-based, inclusive). Example: "5:10" deletes rows
            5 through 10. More efficient than delete_rows for large contiguous
            ranges.
        delete_columns (Optional[Union[str, List[str]]]): List of column
            letters to delete. Example: ["E", "F"].

    Returns:
        str: Confirmation of the applied dimension changes.
    """
    logger.info(
        "[resize_sheet_dimensions] Invoked. Email: '%s', Spreadsheet: %s",
        user_google_email,
        spreadsheet_id,
    )

    result = await _resize_sheet_dimensions_impl(
        service=service,
        spreadsheet_id=spreadsheet_id,
        sheet_name=sheet_name,
        column_sizes=column_sizes,
        row_sizes=row_sizes,
        auto_resize_columns=auto_resize_columns,
        auto_resize_rows=auto_resize_rows,
        frozen_row_count=frozen_row_count,
        frozen_column_count=frozen_column_count,
        hide_columns=hide_columns,
        unhide_columns=unhide_columns,
        hide_rows=hide_rows,
        unhide_rows=unhide_rows,
        insert_rows=insert_rows,
        insert_rows_at=insert_rows_at,
        insert_columns=insert_columns,
        insert_columns_at=insert_columns_at,
        delete_rows=delete_rows,
        delete_row_range=delete_row_range,
        delete_columns=delete_columns,
    )

    return (
        f"Applied dimension changes in spreadsheet {result['spreadsheet_id']} "
        f"for {user_google_email}: {result['summary']}."
    )
async def move_sheet_rows(
    service,
    user_google_email: str,
    spreadsheet_id: str,
    source_sheet: str,
    start_row: int,
    end_row: int,
    destination_sheet: str,
) -> str:
    """
    Moves rows from one sheet to another within the same spreadsheet. The move
    is performed in a single batchUpdate (copyPaste followed by
    deleteDimension). Note: batchUpdate executes requests sequentially but does
    not roll back on partial failure — if the copy succeeds but the delete
    fails, rows may be duplicated. Formulas, data types, and formatting are
    preserved (unlike a values.get/append round-trip).
    Row numbers are 1-based (matching the spreadsheet UI).

    Args:
        user_google_email (str): The user's Google email address. Required.
        spreadsheet_id (str): The ID of the spreadsheet. Required.
        source_sheet (str): Name of the sheet to move rows from. Required.
        start_row (int): First row to move (1-based, inclusive). Required.
        end_row (int): Last row to move (1-based, inclusive). Required.
        destination_sheet (str): Name of the sheet to move rows to. Required.

    Returns:
        str: Confirmation message with the number of rows moved.
    """
    logger.info(
        f"[move_sheet_rows] Invoked. Email: '{user_google_email}', "
        f"Spreadsheet: {spreadsheet_id}, "
        f"From: {source_sheet}!{start_row}-{end_row}, To: {destination_sheet}"
    )

    if start_row < 1 or end_row < start_row:
        raise UserInputError(
            f"Invalid row range: start_row={start_row}, end_row={end_row}. "
            f"Rows are 1-based and end_row must be >= start_row."
        )

    if source_sheet == destination_sheet:
        raise UserInputError("source_sheet and destination_sheet must be different.")

    spreadsheet = await asyncio.to_thread(
        service.spreadsheets()
        .get(
            spreadsheetId=spreadsheet_id,
            fields="sheets(properties(sheetId,title,gridProperties))",
        )
        .execute
    )
    sheets = spreadsheet.get("sheets", [])
    src = _select_sheet(sheets, source_sheet)
    dst = _select_sheet(sheets, destination_sheet)
    src_id = src["properties"]["sheetId"]
    dst_id = dst["properties"]["sheetId"]
    dst_grid_rows = dst["properties"].get("gridProperties", {}).get("rowCount", 0)

    # Validate that the source row block actually contains data.
    safe_source = source_sheet.replace("'", "''")
    src_range = f"'{safe_source}'!{start_row}:{end_row}"
    src_values = await asyncio.to_thread(
        service.spreadsheets()
        .values()
        .get(spreadsheetId=spreadsheet_id, range=src_range)
        .execute
    )
    if not src_values.get("values"):
        raise UserInputError(
            f"Source range '{source_sheet}' rows {start_row}-{end_row} "
            f"contains no data. Nothing to move."
        )

    # Find the last row with actual data in the destination sheet.
    # gridProperties.rowCount is the allocated grid size (e.g. 1000 for a new
    # sheet), not the count of rows containing data.  Fetch all columns so the
    # append position reflects any non-empty cell, not just column A.
    safe_destination = destination_sheet.replace("'", "''")
    dst_values = await asyncio.to_thread(
        service.spreadsheets()
        .values()
        .get(
            spreadsheetId=spreadsheet_id,
            range=f"'{safe_destination}'",
            majorDimension="ROWS",
        )
        .execute
    )
    dst_data_rows = len(dst_values.get("values", []))

    num_rows = end_row - start_row + 1
    paste_start = dst_data_rows

    # If pasting beyond the current grid, expand the destination sheet first.
    requests = []
    if paste_start + num_rows > dst_grid_rows:
        requests.append(
            {
                "appendDimension": {
                    "sheetId": dst_id,
                    "dimension": "ROWS",
                    "length": (paste_start + num_rows) - dst_grid_rows,
                }
            }
        )

    requests.extend(
        [
            {
                "copyPaste": {
                    "source": {
                        "sheetId": src_id,
                        "startRowIndex": start_row - 1,
                        "endRowIndex": end_row,
                    },
                    "destination": {
                        "sheetId": dst_id,
                        "startRowIndex": paste_start,
                        "endRowIndex": paste_start + num_rows,
                    },
                    "pasteType": "PASTE_NORMAL",
                }
            },
            {
                "deleteDimension": {
                    "range": {
                        "sheetId": src_id,
                        "dimension": "ROWS",
                        "startIndex": start_row - 1,
                        "endIndex": end_row,
                    }
                }
            },
        ]
    )

    await asyncio.to_thread(
        service.spreadsheets()
        .batchUpdate(spreadsheetId=spreadsheet_id, body={"requests": requests})
        .execute
    )

    text_output = (
        f"Successfully moved {num_rows} row(s) from '{source_sheet}' "
        f"(rows {start_row}-{end_row}) to '{destination_sheet}' "
        f"in spreadsheet {spreadsheet_id} for {user_google_email}."
    )

    logger.info(f"[move_sheet_rows] Moved {num_rows} rows for {user_google_email}")
    return text_output


# Create comment management tools for sheets
_comment_tools = create_comment_tools("spreadsheet", "spreadsheet_id")

# Extract and register the functions
list_spreadsheet_comments = _comment_tools["list_comments"]
manage_spreadsheet_comment = _comment_tools["manage_comment"]



async def execute_tool(tool_name: str, arguments: dict, access_token: str) -> str:
    creds = Credentials(token=access_token)
    service_sheets = build("sheets", "v4", credentials=creds)
    service_drive = build("drive", "v3", credentials=creds)
    
    if tool_name == "list_spreadsheets":
        return await list_spreadsheets(service_drive, **arguments)
    elif tool_name == "get_spreadsheet_info":
        return await get_spreadsheet_info(service_sheets, **arguments)
    elif tool_name == "read_sheet_values":
        return await read_sheet_values(service_sheets, **arguments)
    elif tool_name == "modify_sheet_values":
        return await modify_sheet_values(service_sheets, **arguments)
    elif tool_name == "create_spreadsheet":
        return await create_spreadsheet(service_sheets, **arguments)
    elif tool_name == "create_sheet":
        return await create_sheet(service_sheets, **arguments)
    elif tool_name == "move_sheet_rows":
        return await move_sheet_rows(service_sheets, **arguments)
    elif tool_name == "format_sheet_range":
        return await format_sheet_range(service_sheets, **arguments)
    elif tool_name == "manage_conditional_formatting":
        return await manage_conditional_formatting(service_sheets, **arguments)
    elif tool_name == "list_spreadsheet_comments":
        return await _read_comments_impl(service_drive, "spreadsheet", arguments.get("spreadsheet_id"), 100)
    elif tool_name == "manage_spreadsheet_comment":
        return await _manage_comment_dispatch(
            service_drive, "spreadsheet", arguments.get("spreadsheet_id"),
            arguments.get("action"), arguments.get("comment_content"), arguments.get("comment_id")
        )
    else:
        raise ValueError(f"Unknown tool: {tool_name}")
