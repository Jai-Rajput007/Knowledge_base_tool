"""
MinerU-based document loader using the Python API (in-process).

Models are loaded once via ModelSingleton when the first document is processed
and stay in memory for the lifetime of the server process. Subsequent uploads
only pay inference cost (~5-10s), not model-load cost (~60-120s on ARM).

Supports: PDF, DOCX, XLSX, PPTX (native — no LibreOffice needed).
Falls back gracefully to None if mineru is not installed.
"""

import json
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


_PDF_EXTS = {".pdf"}
_OFFICE_EXTS = {".docx", ".doc", ".pptx", ".ppt", ".xlsx", ".xls"}


def is_mineru_available() -> bool:
    try:
        from mineru.cli.common import do_parse  # noqa: F401
        return True
    except Exception:
        return False


class MineruLoader(DocumentLoader):
    """Document loader using MinerU Python API — models load once, stay in memory."""

    supported_extensions = list(_PDF_EXTS | _OFFICE_EXTS)

    def load(self, file_path: Union[str, Path]) -> DocumentContent:
        file_path = Path(file_path)
        return self.load_from_bytes(file_path.read_bytes(), file_path.name)

    def load_from_bytes(
        self, content: bytes, filename: Optional[str] = None
    ) -> DocumentContent:
        ext = Path(filename or "doc.pdf").suffix.lower()

        with tempfile.TemporaryDirectory() as _tmp:
            tmpdir = Path(_tmp)
            content_list = self._parse(content, filename or f"document{ext}", tmpdir)
            return self._build_document_content(content_list, filename, len(content))

    # ------------------------------------------------------------------ #

    def _parse(self, file_bytes: bytes, filename: str, tmpdir: Path) -> List[dict]:
        """Call MinerU in-process via do_parse. Models stay loaded between calls."""
        from mineru.cli.common import do_parse

        stem = Path(filename).stem
        ext = Path(filename).suffix.lower()

        # Office files without ML models (pure XML parsing — instant)
        if ext in {".docx", ".doc"}:
            return self._parse_office_docx(file_bytes)
        if ext in {".xlsx", ".xls"}:
            return self._parse_office_xlsx(file_bytes)
        if ext in {".pptx", ".ppt"}:
            return self._parse_office_pptx(file_bytes)

        # PDF — goes through the ML pipeline (models cached by ModelSingleton)
        outdir = tmpdir / "out"
        outdir.mkdir()

        logger.info(f"MinerU parsing {filename} via pipeline (models cache in memory)…")
        do_parse(
            output_dir=str(outdir),
            pdf_file_names=[stem],
            pdf_bytes_list=[file_bytes],
            p_lang_list=["en"],
            backend="pipeline",
            parse_method="auto",
            formula_enable=False,   # skip formula OCR — not needed for KB docs
            table_enable=True,
            f_draw_layout_bbox=False,
            f_draw_span_bbox=False,
            f_dump_md=False,
            f_dump_middle_json=False,
            f_dump_model_output=False,
            f_dump_orig_pdf=False,
            f_dump_content_list=True,
        )

        json_files = list(outdir.rglob("*_content_list.json"))
        if not json_files:
            raise DocumentProcessingError("MinerU produced no content_list.json")

        with open(json_files[0], "r", encoding="utf-8") as f:
            content_list = json.load(f)

        logger.info(f"MinerU parsed {filename}: {len(content_list)} items")
        return self._normalise_field_names(content_list)

    def _parse_office_docx(self, file_bytes: bytes) -> List[dict]:
        from mineru.backend.office.docx_analyze import office_docx_analyze
        from mineru.backend.office.office_middle_json_mkcontent import make_blocks_to_content_list
        middle_json, _ = office_docx_analyze(file_bytes)
        return self._middle_json_to_content_list(middle_json, make_blocks_to_content_list)

    def _parse_office_xlsx(self, file_bytes: bytes) -> List[dict]:
        from mineru.backend.office.xlsx_analyze import office_xlsx_analyze
        from mineru.backend.office.office_middle_json_mkcontent import make_blocks_to_content_list
        middle_json, _ = office_xlsx_analyze(file_bytes)
        return self._middle_json_to_content_list(middle_json, make_blocks_to_content_list)

    def _parse_office_pptx(self, file_bytes: bytes) -> List[dict]:
        from mineru.backend.office.pptx_analyze import office_pptx_analyze
        from mineru.backend.office.office_middle_json_mkcontent import make_blocks_to_content_list
        middle_json, _ = office_pptx_analyze(file_bytes)
        return self._middle_json_to_content_list(middle_json, make_blocks_to_content_list)

    def _middle_json_to_content_list(self, middle_json: dict, make_fn) -> List[dict]:
        """Extract content_list from middle_json pdf_info structure."""
        content_list = []
        for page_idx, page_info in enumerate(middle_json.get("pdf_info", [])):
            blocks = page_info.get("para_blocks", [])
            try:
                page_items = make_fn(blocks, page_idx)
                if isinstance(page_items, list):
                    content_list.extend(page_items)
            except Exception as e:
                logger.warning(f"make_blocks_to_content_list failed page {page_idx}: {e}")
                # fallback: extract text directly from blocks
                for block in blocks:
                    text = self._extract_text_from_block(block)
                    if text:
                        content_list.append({
                            "type": "text",
                            "text": text,
                            "page_idx": page_idx,
                        })
        return content_list

    def _extract_text_from_block(self, block: dict) -> str:
        """Fallback plain-text extraction from a para_block."""
        parts = []
        for line in block.get("lines", []):
            for span in line.get("spans", []):
                c = span.get("content", "")
                if c:
                    parts.append(c)
        return " ".join(parts).strip()

    @staticmethod
    def _normalise_field_names(content_list: List[dict]) -> List[dict]:
        for item in content_list:
            if isinstance(item, dict):
                if "img_caption" in item and "image_caption" not in item:
                    item["image_caption"] = item["img_caption"]
                if "image_caption" in item and "img_caption" not in item:
                    item["img_caption"] = item["image_caption"]
        return content_list

    # ------------------------------------------------------------------ #
    # LLM table description                                               #
    # ------------------------------------------------------------------ #

    def _describe_table(self, table_md: str, caption: str) -> str:
        cap_hint = f'Table caption: "{caption}"\n\n' if caption else ""
        prompt = (
            f"{cap_hint}"
            "Convert this markdown table into clear, complete natural language sentences. "
            "Include every column name and all cell values — do not omit any rows:\n\n"
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

    # ------------------------------------------------------------------ #
    # Build DocumentContent                                               #
    # ------------------------------------------------------------------ #

    def _build_document_content(
        self, content_list: List[dict], filename: Optional[str], file_size: int
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
                        type=ContentType.HEADING, content=text,
                        level=int(level), metadata={"page": page},
                    ))
                else:
                    elements.append(ContentElement(
                        type=ContentType.PARAGRAPH, content=text,
                        metadata={"page": page},
                    ))

            elif item_type == "table":
                table_md = item.get("table_body", "").strip()
                if not table_md:
                    continue
                raw_cap = item.get("image_caption", item.get("img_caption", []))
                caption = (" ".join(raw_cap) if isinstance(raw_cap, list) else str(raw_cap)).strip()

                logger.info(f"Generating LLM description for table (page {page})…")
                description = self._describe_table(table_md, caption)

                parts = []
                if caption:
                    parts.append(f"Table: {caption}")
                parts.append(description)
                if description != table_md:
                    parts.append(f"Raw table:\n{table_md}")

                elements.append(ContentElement(
                    type=ContentType.TABLE,
                    content="\n\n".join(parts),
                    metadata={"page": page, "caption": caption, "has_llm_description": True},
                ))

            elif item_type == "image":
                raw_cap = item.get("image_caption", item.get("img_caption", []))
                caption = (" ".join(raw_cap) if isinstance(raw_cap, list) else str(raw_cap)).strip()
                if caption:
                    elements.append(ContentElement(
                        type=ContentType.IMAGE, content=f"[Image] {caption}",
                        metadata={"page": page},
                    ))

            elif item_type == "equation":
                eq = (item.get("text") or item.get("latex") or "").strip()
                if eq:
                    elements.append(ContentElement(
                        type=ContentType.CODE_BLOCK, content=f"[Equation] {eq}",
                        metadata={"page": page},
                    ))

        max_page = max(
            (item.get("page_idx", 0) for item in content_list if isinstance(item, dict)),
            default=0,
        )
        metadata = DocumentMetadata(
            title=filename, source_file=filename,
            file_size=file_size, page_count=max_page + 1,
        )
        doc = DocumentContent(elements=elements, metadata=metadata)
        metadata.word_count = len(doc.to_text().split())
        logger.info(
            f"MineruLoader: {filename} — {len(elements)} elements, "
            f"{metadata.word_count} words"
        )
        return doc
