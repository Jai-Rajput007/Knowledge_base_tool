"""Markdown document loader with support for all MD elements."""

from pathlib import Path
from typing import Union, Optional, List
import io
import re

from app.services.document_loaders.base import (
    DocumentLoader, DocumentContent, ContentElement,
    ContentType, DocumentMetadata, ElementType
)
from app.core.logging import logger
from app.core.exceptions import DocumentProcessingError


class MarkdownLoader(DocumentLoader):
    """Markdown loader with full syntax support."""
    
    supported_extensions = [".md", ".markdown"]
    
    def load(self, file_path: Union[str, Path]) -> DocumentContent:
        """Load Markdown from file path."""
        file_path = Path(file_path)
        logger.info(f"Loading Markdown: {file_path}")
        
        try:
            with open(file_path, 'rb') as f:
                content = f.read()
            return self.load_from_bytes(content, file_path.name)
        except Exception as e:
            logger.error(f"Failed to load Markdown file: {str(e)}")
            raise DocumentProcessingError(f"Markdown load failed: {str(e)}")
    
    def load_from_bytes(self, content: bytes, filename: Optional[str] = None) -> DocumentContent:
        """Load Markdown from bytes."""
        try:
            text = content.decode('utf-8')
            elements = self._parse_markdown(text)
            
            metadata = self._extract_metadata(text, filename, len(content))
            
            doc_content = DocumentContent(
                elements=elements,
                metadata=metadata,
                raw_text=text
            )
            
            logger.info(f"Markdown loaded successfully: {len(elements)} elements")
            return doc_content
            
        except Exception as e:
            logger.error(f"Markdown processing failed: {str(e)}")
            raise DocumentProcessingError(f"Markdown processing failed: {str(e)}")
    
    def _extract_metadata(self, text: str, filename: Optional[str], file_size: int) -> DocumentMetadata:
        """Extract YAML frontmatter metadata."""
        custom_meta = {}
        title = Path(filename).stem if filename else None
        
        # Check for YAML frontmatter
        frontmatter_match = re.match(r'^---\s*\n(.*?)\n---\s*\n', text, re.DOTALL)
        if frontmatter_match:
            try:
                import yaml
                custom_meta = yaml.safe_load(frontmatter_match.group(1))
                if isinstance(custom_meta, dict):
                    title = custom_meta.get('title', title)
            except ImportError:
                # Simple parsing without YAML
                lines = frontmatter_match.group(1).split('\n')
                for line in lines:
                    if ':' in line:
                        key, value = line.split(':', 1)
                        custom_meta[key.strip()] = value.strip()
                        if key.strip().lower() == 'title':
                            title = value.strip()
            except Exception:
                pass
        
        # Also try to extract title from first heading
        if not title:
            title_match = re.search(r'^#\s+(.+)$', text, re.MULTILINE)
            if title_match:
                title = title_match.group(1)
        
        return DocumentMetadata(
            title=title,
            source_file=filename,
            file_size=file_size,
            word_count=len(text.split()),
            custom=custom_meta
        )
    
    def _parse_markdown(self, text: str) -> List[ContentElement]:
        """Parse Markdown into structured elements."""
        elements = []
        lines = text.split('\n')
        i = 0
        
        while i < len(lines):
            line = lines[i]
            
            # Skip frontmatter
            if i == 0 and line.strip() == '---':
                j = i + 1
                while j < len(lines) and lines[j].strip() != '---':
                    j += 1
                i = j + 1
                continue
            
            # Empty line
            if not line.strip():
                i += 1
                continue
            
            # Heading
            if line.strip().startswith('#'):
                elements.append(self._parse_heading(line))
                i += 1
                continue
            
            # Code block
            if line.strip().startswith('```'):
                code_block, i = self._parse_code_block(lines, i)
                elements.append(code_block)
                continue
            
            # Table
            if self._is_table_line(line):
                table, i = self._parse_table(lines, i)
                if table:
                    elements.append(table)
                continue
            
            # List
            if self._is_list_line(line):
                list_element, i = self._parse_list(lines, i)
                elements.append(list_element)
                continue
            
            # Quote
            if line.strip().startswith('>'):
                quote, i = self._parse_quote(lines, i)
                elements.append(quote)
                continue
            
            # Image
            image = self._parse_image(line)
            if image:
                elements.append(image)
                i += 1
                continue
            
            # Paragraph
            paragraph, i = self._parse_paragraph(lines, i)
            if paragraph:
                elements.append(paragraph)
            else:
                i += 1
        
        return elements
    
    def _parse_heading(self, line: str) -> ContentElement:
        """Parse heading."""
        stripped = line.lstrip()
        level = 0
        for char in stripped:
            if char == '#':
                level += 1
            else:
                break
        content = stripped[level:].strip()
        return self._create_heading_element(content, min(level, 6))
    
    def _parse_code_block(self, lines: List[str], start: int) -> tuple:
        """Parse code block."""
        fence = lines[start].strip()
        language = fence[3:].strip() if len(fence) > 3 else ''
        
        content_lines = []
        i = start + 1
        while i < len(lines):
            if lines[i].strip().startswith('```'):
                break
            content_lines.append(lines[i])
            i += 1
        
        return ContentElement(
            type=ContentType.CODE_BLOCK,
            content='\n'.join(content_lines),
            metadata={"language": language}
        ), i + 1
    
    def _is_table_line(self, line: str) -> bool:
        """Check if line is part of a table."""
        return '|' in line
    
    def _parse_table(self, lines: List[str], start: int) -> tuple:
        """Parse table."""
        rows = []
        i = start
        
        while i < len(lines) and '|' in lines[i]:
            # Skip separator line
            if re.match(r'^[\|\-\:\s]+$', lines[i].strip()):
                i += 1
                continue
            
            cells = [cell.strip() for cell in lines[i].split('|')]
            # Remove empty cells from start/end
            cells = [c for c in cells if c]
            if cells:
                rows.append(cells)
            i += 1
        
        if len(rows) >= 1:
            headers = rows[0]
            data_rows = rows[1:] if len(rows) > 1 else []
            return self._create_table_element(data_rows, headers), i
        
        return None, i
    
    def _is_list_line(self, line: str) -> bool:
        """Check if line is a list item."""
        stripped = line.lstrip()
        return bool(re.match(r'^[\*\-\+]\s', stripped)) or bool(re.match(r'^\d+[\.\)]\s', stripped))
    
    def _parse_list(self, lines: List[str], start: int) -> tuple:
        """Parse list."""
        items = []
        i = start
        
        # Determine if ordered
        first_line = lines[start].lstrip()
        is_ordered = bool(re.match(r'^\d+[\.\)]\s', first_line))
        
        while i < len(lines):
            line = lines[i]
            if not line.strip():
                i += 1
                continue
            
            stripped = line.lstrip()
            if self._is_list_line(stripped):
                # Remove list marker
                content = re.sub(r'^[\*\-\+\d\.]\)?\s*', '', stripped)
                items.append(content)
                i += 1
            else:
                break
        
        return self._create_list_element(items, is_ordered), i
    
    def _parse_quote(self, lines: List[str], start: int) -> tuple:
        """Parse blockquote."""
        content_lines = []
        i = start
        
        while i < len(lines) and lines[i].strip().startswith('>'):
            content_lines.append(lines[i].lstrip('>').strip())
            i += 1
        
        return ContentElement(
            type=ContentType.QUOTE,
            content=' '.join(content_lines)
        ), i
    
    def _parse_image(self, line: str) -> Optional[ContentElement]:
        """Parse image reference."""
        match = re.match(r'^!\[(.*?)\]\((.+?)\)', line.strip())
        if match:
            alt_text = match.group(1)
            source = match.group(2)
            return self._create_image_element(alt_text, source)
        return None
    
    def _parse_paragraph(self, lines: List[str], start: int) -> tuple:
        """Parse paragraph."""
        content_lines = []
        i = start
        
        while i < len(lines):
            line = lines[i]
            if not line.strip():
                break
            # Check for other element types
            if line.strip().startswith(('#', '```', '>', '|', '- ', '* ', '+ ', '1. ')):
                break
            if self._is_list_line(line):
                break
            content_lines.append(line)
            i += 1
        
        if content_lines:
            return self._create_text_element(
                ' '.join(content_lines),
                ContentType.PARAGRAPH
            ), i
        
        return None, i
