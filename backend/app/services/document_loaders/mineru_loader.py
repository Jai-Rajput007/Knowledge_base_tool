"""
MinerU-based document loader with LLM table descriptions.

Handles PDF (directly) and Office formats (via LibreOffice → PDF → MinerU).
Excel files are intentionally excluded — use ExcelLoader for those.
Falls back gracefully to None if MinerU CLI is not installed.
"""

import json
import subprocess
import tempfile
from pathlib import Path
from typing import List, Optional, Union

import requests

from app.services.document_loaders.base import (
    ContentElement, ContentType, DocumentContent,
    DocumentLoader, DocumentMetadata,
)
from app.core.config import settings
from app.core.logging import logger
from app.core.exceptions import DocumentProcessingError


# Formats this loader handles
_PDF_EXTS = {".pdf"}
_OFFICE_EXTS = {".docx", ".doc", ".pptx", ".ppt"}


def is_mineru_available() -> bool:
    """Return True if the mineru CLI is on PATH."""
    return subprocess.run(
        ["mineru", "--version"],
        capture_output=True,
    ).returncode == 0


class MineruLoader(DocumentLoader):
    """High-quality document loader using MinerU + LLM table descriptions."""

    supported_extensions = list(_PDF_EXTS | _OFFICE_EXTS)

    # ------------------------------------------------------------------ #
    # Public API                                                           #
    # ------------------------------------------------------------------ #

    def load(self, file_path: Union[str, Path]) -> DocumentContent:
        file_path = Path(file_path)
        return self.load_from_bytes(file_path.read_bytes(), file_path.name)

    def load_from_bytes(
        self, content: bytes, filename: Optional[str] = None
    ) -> DocumentContent:
        ext = Path(filename or "doc.pdf").suffix.lower()

        with tempfile.TemporaryDirectory() as _tmpdir:
            tmpdir = Path(_tmpdir)
            input_path = tmpdir / (filename or f"document{ext}")
            input_path.write_bytes(content)

            # Office → PDF conversion
            if ext in _OFFICE_EXTS:
                input_path = self._convert_to_pdf(input_path, tmpdir)

            content_list = self._run_mineru(input_path, tmpdir)
            return self._build_document_content(content_list, filename, len(content))

    # ------------------------------------------------------------------ #
    # Internal helpers                                                     #
    # ------------------------------------------------------------------ #

    def _convert_to_pdf(self, doc_path: Path, output_dir: Path) -> Path:
        """LibreOffice headless conversion to PDF."""
        result = subprocess.run(
            [
                "libreoffice", "--headless",
                "--convert-to", "pdf",
                "--outdir", str(output_dir),
                str(doc_path),
            ],
            capture_output=True, text=True, timeout=120,
            errors="ignore",
        )
        if result.returncode != 0:
            raise DocumentProcessingError(
                f"LibreOffice conversion failed: {result.stderr[:400]}"
            )
        pdfs = list(output_dir.glob("*.pdf"))
        if not pdfs:
            raise DocumentProcessingError("LibreOffice produced no PDF output")
        return pdfs[0]

    def _run_mineru(self, pdf_path: Path, output_dir: Path) -> List[dict]:
        """Run MinerU CLI and return the parsed content_list."""
        mineru_out = output_dir / "mineru_out"
        mineru_out.mkdir()

        result = subprocess.run(
            ["mineru", "-p", str(pdf_path), "-o", str(mineru_out), "-m", "auto"],
            capture_output=True, text=True, timeout=600,
            errors="ignore",
        )
        if result.returncode != 0:
            raise DocumentProcessingError(
                f"MinerU failed (rc={result.returncode}): {result.stderr[:400]}"
            )

        # MinerU writes: mineru_out/{stem}/{method}/{stem}_content_list.json
        json_files = list(mineru_out.rglob("*_content_list.json"))
        if not json_files:
            raise DocumentProcessingError(
                "MinerU produced no content_list.json — check MinerU installation"
            )

        with open(json_files[0], "r", encoding="utf-8") as f:
            content_list = json.load(f)

        # Normalise MinerU 2.0 field renames for backward compat
        _ALIASES = {"img_caption": "image_caption", "img_footnote": "image_footnote"}
        for item in content_list:
            if isinstance(item, dict):
                for old, new in _ALIASES.items():
                    if old in item and new not in item:
                        item[new] = item[old]
                    elif new in item and old not in item:
                        item[old] = item[new]

        logger.info(
            f"MinerU parsed {pdf_path.name}: {len(content_list)} content items"
        )
        return content_list

    def _describe_table(self, table_md: str, caption: str) -> str:
        """
        Ask the local LLM to convert a markdown table into natural language sentences.
        Falls back to the raw markdown if the call fails.
        """
        cap_hint = f'Table caption: "{caption}"\n\n' if caption else ""
        prompt = (
            f"{cap_hint}"
            "Convert this markdown table into clear, complete natural language sentences. "
            "Include every column name and all cell values — do not omit any rows or data:\n\n"
            f"{table_md}"
        )
        try:
            resp = requests.post(
                "http://localhost:11434/api/generate",
                json={
                    "model": settings.LLM_MODEL,
                    "prompt": prompt,
                    "stream": False,
                    "options": {"num_predict": 512, "temperature": 0.1},
                },
                timeout=60,
            )
            resp.raise_for_status()
            description = resp.json().get("response", "").strip()
            if description:
                return description
        except Exception as e:
            logger.warning(f"LLM table description failed: {e}")
        return table_md

    def _build_document_content(
        self,
        content_list: List[dict],
        filename: Optional[str],
        file_size: int,
    ) -> DocumentContent:
        elements: List[ContentElement] = []

        for item in content_list:
            if not isinstance(item, dict):
                continue
            item_type = item.get("type", "text")
            page = item.get("page_idx", 0)

            if item_type == "text":
                text = item.get("text", "").strip()
                if not text:
                    continue
                level = item.get("text_level")
                if level:
                    elements.append(ContentElement(
                        type=ContentType.HEADING,
                        content=text,
                        level=int(level),
                        metadata={"page": page},
                    ))
                else:
                    elements.append(ContentElement(
                        type=ContentType.PARAGRAPH,
                        content=text,
                        metadata={"page": page},
                    ))

            elif item_type == "table":
                table_md = item.get("table_body", "").strip()
                if not table_md:
                    continue

                raw_captions = item.get("image_caption", item.get("img_caption", []))
                if isinstance(raw_captions, list):
                    caption = " ".join(raw_captions).strip()
                else:
                    caption = str(raw_captions).strip()

                logger.info(
                    f"Generating LLM description for table on page {page} "
                    f"({len(table_md)} chars)…"
                )
                description = self._describe_table(table_md, caption)

                # Combine: description first (embeds well), raw table appended for accuracy
                parts = []
                if caption:
                    parts.append(f"Table: {caption}")
                parts.append(description)
                if description != table_md:
                    parts.append(f"Raw table:\n{table_md}")
                full_content = "\n\n".join(parts)

                elements.append(ContentElement(
                    type=ContentType.TABLE,
                    content=full_content,
                    metadata={
                        "page": page,
                        "caption": caption,
                        "has_llm_description": True,
                    },
                ))

            elif item_type == "image":
                raw_captions = item.get("image_caption", item.get("img_caption", []))
                if isinstance(raw_captions, list):
                    caption = " ".join(raw_captions).strip()
                else:
                    caption = str(raw_captions).strip()
                if caption:
                    elements.append(ContentElement(
                        type=ContentType.IMAGE,
                        content=f"[Image] {caption}",
                        metadata={"page": page},
                    ))

            elif item_type == "equation":
                eq_text = (item.get("text") or item.get("latex") or "").strip()
                if eq_text:
                    elements.append(ContentElement(
                        type=ContentType.CODE_BLOCK,
                        content=f"[Equation] {eq_text}",
                        metadata={"page": page},
                    ))

        max_page = max(
            (item.get("page_idx", 0) for item in content_list if isinstance(item, dict)),
            default=0,
        )
        metadata = DocumentMetadata(
            title=filename,
            source_file=filename,
            file_size=file_size,
            page_count=max_page + 1,
        )
        doc = DocumentContent(elements=elements, metadata=metadata)
        metadata.word_count = len(doc.to_text().split())

        logger.info(
            f"MineruLoader: {filename} — {len(elements)} elements, "
            f"{metadata.word_count} words, {metadata.page_count} pages"
        )
        return doc
