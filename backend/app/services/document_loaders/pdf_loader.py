"""PDF document loader using pdfplumber for accurate text and table extraction."""

from pathlib import Path
from typing import Union, Optional, List, Any
import io
import re

from app.services.document_loaders.base import (
    DocumentLoader, DocumentContent, ContentElement,
    ContentType, DocumentMetadata, ElementType
)
from app.core.logging import logger
from app.core.exceptions import DocumentProcessingError


class PDFLoader(DocumentLoader):
    """PDF loader using pdfplumber for text and table extraction."""

    supported_extensions = [".pdf"]

    def load(self, file_path: Union[str, Path]) -> DocumentContent:
        file_path = Path(file_path)
        logger.info(f"Loading PDF: {file_path}")
        try:
            with open(file_path, "rb") as f:
                content = f.read()
            return self.load_from_bytes(content, file_path.name)
        except Exception as e:
            logger.error(f"Failed to load PDF file: {str(e)}")
            raise DocumentProcessingError(f"PDF load failed: {str(e)}")

    def load_from_bytes(self, content: bytes, filename: Optional[str] = None) -> DocumentContent:
        try:
            import pdfplumber
        except ImportError:
            raise DocumentProcessingError("pdfplumber not installed. Run: pip install pdfplumber")

        try:
            elements: List[ContentElement] = []

            with pdfplumber.open(io.BytesIO(content)) as pdf:
                metadata = self._extract_metadata(pdf, filename, len(content))

                for page_num, page in enumerate(pdf.pages, 1):
                    page_elements = self._extract_page(page, page_num)
                    elements.extend(page_elements)

                    if page_num < len(pdf.pages):
                        elements.append(ContentElement(
                            type=ContentType.PAGE_BREAK,
                            content=f"--- Page {page_num} ---",
                            metadata={"page_number": page_num}
                        ))

            doc_content = DocumentContent(elements=elements, metadata=metadata)
            metadata.word_count = len(doc_content.to_text().split())
            logger.info(f"PDF loaded: {len(elements)} elements from {filename}")
            return doc_content

        except DocumentProcessingError:
            raise
        except Exception as e:
            logger.error(f"PDF processing failed: {str(e)}")
            raise DocumentProcessingError(f"PDF processing failed: {str(e)}")

    def _extract_metadata(self, pdf, filename: Optional[str], file_size: int) -> DocumentMetadata:
        meta = pdf.metadata or {}
        return DocumentMetadata(
            title=meta.get("Title"),
            author=meta.get("Author"),
            subject=meta.get("Subject"),
            keywords=self._parse_keywords(meta.get("Keywords")),
            created_at=str(meta.get("CreationDate")) if meta.get("CreationDate") else None,
            modified_at=str(meta.get("ModDate")) if meta.get("ModDate") else None,
            page_count=len(pdf.pages),
            source_file=filename,
            file_size=file_size,
            custom=dict(meta),
        )

    def _parse_keywords(self, keywords: Any) -> List[str]:
        if not keywords:
            return []
        if isinstance(keywords, str):
            return [k.strip() for k in keywords.split(",") if k.strip()]
        return []

    def _extract_page(self, page, page_num: int) -> List[ContentElement]:
        """Extract text and tables from a page, keeping tables structured."""
        elements: List[ContentElement] = []

        # Get table bounding boxes so we can exclude their area from text extraction
        tables = page.find_tables()
        table_bboxes = [t.bbox for t in tables]

        # ── Tables ────────────────────────────────────────────────────────────
        for table_obj in tables:
            try:
                rows = table_obj.extract()
                if not rows:
                    continue
                table_text = self._format_table(rows, page_num)
                if table_text:
                    elements.append(ContentElement(
                        type=ContentType.TABLE,
                        content=table_text,
                        metadata={"page": page_num, "source": "pdfplumber"},
                    ))
            except Exception as e:
                logger.debug(f"Table extraction error page {page_num}: {e}")

        # ── Text outside tables ───────────────────────────────────────────────
        try:
            if table_bboxes:
                # Crop page to exclude table areas and extract remaining text
                text_page = page
                for bbox in table_bboxes:
                    try:
                        # Use outside_bbox to get text not in the table region
                        text_page = text_page.outside_bbox(bbox)
                    except Exception:
                        pass
                text = text_page.extract_text(x_tolerance=3, y_tolerance=3)
            else:
                text = page.extract_text(x_tolerance=3, y_tolerance=3)

            if text and text.strip():
                for element in self._parse_text_block(text, page_num):
                    elements.append(element)
        except Exception as e:
            logger.debug(f"Text extraction error page {page_num}: {e}")

        return elements

    def _format_table(self, rows: List[List], page_num: int) -> str:
        """
        Convert a table to context-rich text.

        Strategy:
        - First non-empty row is treated as headers.
        - Each subsequent row is formatted as "Header: Value | Header: Value"
        - If no clear headers, format as pipe-separated rows.
        """
        if not rows:
            return ""

        # Clean cells — replace None with ""
        cleaned = [[str(c).strip() if c is not None else "" for c in row] for row in rows]

        # Filter completely empty rows
        cleaned = [row for row in cleaned if any(c for c in row)]
        if not cleaned:
            return ""

        # Detect if first row looks like a header (mostly text, no numbers)
        def is_header_row(row: List[str]) -> bool:
            non_empty = [c for c in row if c]
            if not non_empty:
                return False
            numeric_count = sum(1 for c in non_empty if re.match(r'^[\d,.\-% ]+$', c))
            return numeric_count < len(non_empty) / 2

        lines = []
        if len(cleaned) > 1 and is_header_row(cleaned[0]):
            headers = cleaned[0]
            lines.append(f"[Table - Page {page_num}]")
            for row in cleaned[1:]:
                parts = []
                for h, v in zip(headers, row):
                    if h or v:
                        label = h if h else f"Col{headers.index(h)+1}"
                        parts.append(f"{label}: {v}")
                if parts:
                    lines.append(" | ".join(parts))
        else:
            # No clear header — just join each row
            lines.append(f"[Table - Page {page_num}]")
            for row in cleaned:
                lines.append(" | ".join(c for c in row if c))

        return "\n".join(lines)

    def _parse_text_block(self, text: str, page_num: int) -> List[ContentElement]:
        """Split text into headings and paragraphs."""
        elements = []
        current_para: List[str] = []

        for line in text.split("\n"):
            line = line.strip()
            if not line:
                if current_para:
                    elements.append(self._create_text_element(
                        " ".join(current_para), ContentType.PARAGRAPH
                    ))
                    current_para = []
                continue

            if self._is_heading(line):
                if current_para:
                    elements.append(self._create_text_element(
                        " ".join(current_para), ContentType.PARAGRAPH
                    ))
                    current_para = []
                level = self._detect_heading_level(line)
                elements.append(self._create_heading_element(line, level))
            else:
                current_para.append(line)

        if current_para:
            elements.append(self._create_text_element(
                " ".join(current_para), ContentType.PARAGRAPH
            ))

        return elements

    def _is_heading(self, line: str) -> bool:
        if len(line) > 100:
            return False
        if line.isupper() and len(line) > 3:
            return True
        if re.match(r'^[\d.]+\s+\w', line):
            return True
        if len(line) < 60 and line and line[-1] not in ".!?," and not line.islower():
            return True
        return False

    def _detect_heading_level(self, line: str) -> int:
        match = re.match(r'^(\d+(?:\.\d+)*)', line)
        if match:
            return min(len(match.group(1).split(".")), 6)
        if line.isupper():
            return 1
        return 2

    def _create_text_element(self, text: str, content_type: ContentType) -> ContentElement:
        return ContentElement(type=content_type, content=text)

    def _create_heading_element(self, text: str, level: int) -> ContentElement:
        return ContentElement(type=ContentType.HEADING, content=text, level=level)

    # Keep extract_tables() for any external callers
    def extract_tables(self, file_path: Union[str, Path]) -> List[ContentElement]:
        content = self.load(file_path)
        return [e for e in content.elements if e.type == ContentType.TABLE]
