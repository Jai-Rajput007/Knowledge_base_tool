"""Structure-aware document chunking service with hierarchy preservation."""

from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Iterator, AsyncIterator, Callable, Tuple
from enum import Enum
import asyncio
from datetime import datetime

from app.services.document_loaders.base import (
    DocumentContent, ContentElement, ContentType, DocumentMetadata
)
from app.core.logging import logger
from app.core.config import settings


class ChunkBoundaryType(Enum):
    """Types of chunk boundaries."""
    HEADING = "heading"
    PARAGRAPH = "paragraph"
    SENTENCE = "sentence"
    WORD = "word"
    CHARACTER = "character"
    TABLE_END = "table_end"
    LIST_END = "list_end"
    CODE_BLOCK_END = "code_block_end"


@dataclass
class ChunkMetadata:
    """Rich metadata for a document chunk."""
    # Source info
    filename: str
    file_type: str
    
    # Document metadata
    title: Optional[str] = None
    author: Optional[str] = None
    created_at: Optional[str] = None
    modified_at: Optional[str] = None
    
    # Position info
    chunk_index: int = 0
    total_chunks: int = 0
    page_number: Optional[int] = None
    section_level: Optional[int] = None
    
    # Hierarchy
    headings_hierarchy: List[Dict[str, Any]] = field(default_factory=list)
    parent_section: Optional[str] = None
    section_path: str = ""  # Full path like "Chapter 1 > Section 1.2 > Subsection"
    
    # Content type
    contains_table: bool = False
    contains_list: bool = False
    contains_code: bool = False
    contains_image: bool = False
    content_types: List[str] = field(default_factory=list)
    
    # Stats
    char_count: int = 0
    word_count: int = 0
    sentence_count: int = 0
    token_estimate: int = 0  # Rough estimate
    
    # Boundaries
    starts_with_heading: bool = False
    ends_at_boundary: str = ""
    
    # Tags and keywords
    tags: List[str] = field(default_factory=list)
    keywords: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "filename": self.filename,
            "file_type": self.file_type,
            "title": self.title,
            "author": self.author,
            "created_at": self.created_at,
            "modified_at": self.modified_at,
            "chunk_index": self.chunk_index,
            "total_chunks": self.total_chunks,
            "page_number": self.page_number,
            "section_level": self.section_level,
            "headings_hierarchy": self.headings_hierarchy,
            "parent_section": self.parent_section,
            "section_path": self.section_path,
            "contains_table": self.contains_table,
            "contains_list": self.contains_list,
            "contains_code": self.contains_code,
            "contains_image": self.contains_image,
            "content_types": self.content_types,
            "char_count": self.char_count,
            "word_count": self.word_count,
            "sentence_count": self.sentence_count,
            "token_estimate": self.token_estimate,
            "starts_with_heading": self.starts_with_heading,
            "ends_at_boundary": self.ends_at_boundary,
            "tags": self.tags,
            "keywords": self.keywords,
        }


@dataclass
class DocumentChunk:
    """A document chunk with rich metadata."""
    content: str
    metadata: ChunkMetadata
    elements: List[ContentElement] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "content": self.content,
            "metadata": self.metadata.to_dict(),
            "element_types": [e.type.value for e in self.elements],
        }


class StructureAwareChunker:
    """Advanced chunking that preserves document structure and hierarchy."""
    
    def __init__(
        self,
        chunk_size: int = None,
        chunk_overlap: int = None,
        preserve_structure: bool = True,
        min_chunk_size: int = 100,
        max_chunk_size: int = None,
        respect_boundaries: bool = True,
    ):
        self.chunk_size = chunk_size or settings.CHUNK_SIZE
        self.chunk_overlap = chunk_overlap or settings.CHUNK_OVERLAP
        self.preserve_structure = preserve_structure
        self.min_chunk_size = min_chunk_size
        self.max_chunk_size = max_chunk_size or self.chunk_size * 2
        self.respect_boundaries = respect_boundaries
        
        # Priority of boundaries (highest to lowest)
        self.boundary_priority = [
            ContentType.TABLE,
            ContentType.LIST,
            ContentType.CODE_BLOCK,
            ContentType.HEADING,
            ContentType.QUOTE,
            ContentType.PARAGRAPH,
        ]
    
    async def chunk_document_streaming(
        self,
        document: DocumentContent,
        progress_callback: Optional[Callable[[int, int, str], None]] = None
    ) -> AsyncIterator[DocumentChunk]:
        """
        Stream chunks with progress updates.
        
        Args:
            document: The document to chunk
            progress_callback: Function(current, total, status_message)
        
        Yields:
            DocumentChunk: Each chunk with rich metadata
        """
        elements = document.elements
        total_elements = len(elements)
        
        # Build hierarchy context
        hierarchy = self._build_hierarchy_context(elements)
        current_section_path = []
        current_headings = []
        
        chunk_buffer = []
        buffer_size = 0
        chunk_index = 0
        
        for idx, element in enumerate(elements):
            # Update progress
            if progress_callback and idx % 5 == 0:
                progress_callback(idx, total_elements, f"Processing element {idx}/{total_elements}")
            
            # Update hierarchy tracking
            if element.type == ContentType.HEADING:
                current_headings, current_section_path = self._update_heading_context(
                    element, current_headings, current_section_path
                )
            
            # Check if element is a structure boundary
            is_boundary = element.type in [
                ContentType.HEADING, ContentType.TABLE, 
                ContentType.LIST, ContentType.CODE_BLOCK
            ]
            
            element_text = element.to_text()
            element_size = len(element_text)
            
            # Handle large single elements (tables, code blocks)
            if element_size > self.chunk_size and is_boundary:
                # Flush current buffer first
                if chunk_buffer:
                    chunk = self._create_chunk(
                        chunk_buffer, chunk_index, document.metadata,
                        current_headings, current_section_path, len(elements)
                    )
                    yield chunk
                    chunk_index += 1
                    chunk_buffer = self._get_overlap_elements(chunk_buffer)
                    buffer_size = sum(len(e.to_text()) for e in chunk_buffer)
                
                # Handle the large element specially
                async for sub_chunk in self._chunk_large_element(
                    element, chunk_index, document.metadata,
                    current_headings, current_section_path, len(elements)
                ):
                    yield sub_chunk
                    chunk_index += 1
                
                continue
            
            # Check if adding this element would exceed chunk size
            if buffer_size + element_size > self.chunk_size and chunk_buffer:
                # Create chunk from buffer
                chunk = self._create_chunk(
                    chunk_buffer, chunk_index, document.metadata,
                    current_headings, current_section_path, len(elements)
                )
                yield chunk
                chunk_index += 1
                
                # Get overlap elements for next chunk
                chunk_buffer = self._get_overlap_elements(chunk_buffer)
                buffer_size = sum(len(e.to_text()) for e in chunk_buffer)
            
            # Add element to buffer
            chunk_buffer.append(element)
            buffer_size += element_size
            
            # If this is a strong boundary and we have enough content, create chunk
            if is_boundary and buffer_size >= self.min_chunk_size:
                chunk = self._create_chunk(
                    chunk_buffer, chunk_index, document.metadata,
                    current_headings, current_section_path, len(elements)
                )
                yield chunk
                chunk_index += 1
                chunk_buffer = self._get_overlap_elements(chunk_buffer)
                buffer_size = sum(len(e.to_text()) for e in chunk_buffer)
            
            # Small delay for streaming effect
            await asyncio.sleep(0.001)
        
        # Flush remaining buffer
        if chunk_buffer:
            if progress_callback:
                progress_callback(total_elements, total_elements, "Finalizing chunks...")
            
            chunk = self._create_chunk(
                chunk_buffer, chunk_index, document.metadata,
                current_headings, current_section_path, len(elements)
            )
            yield chunk
    
    def chunk_document(
        self,
        document: DocumentContent,
        progress_callback: Optional[Callable[[int, int, str], None]] = None
    ) -> List[DocumentChunk]:
        """
        Chunk document synchronously (for non-streaming use).
        
        Returns:
            List of DocumentChunk with rich metadata
        """
        chunks = []
        
        async def collect_chunks():
            async for chunk in self.chunk_document_streaming(document, progress_callback):
                chunks.append(chunk)
        
        asyncio.run(collect_chunks())
        
        # Update total_chunks in metadata
        total = len(chunks)
        for i, chunk in enumerate(chunks):
            chunk.metadata.chunk_index = i
            chunk.metadata.total_chunks = total
        
        return chunks
    
    def _build_hierarchy_context(self, elements: List[ContentElement]) -> Dict[int, List[Dict]]:
        """Build heading hierarchy for each element position."""
        hierarchy_map = {}
        current_hierarchy = []
        
        for idx, element in enumerate(elements):
            if element.type == ContentType.HEADING:
                level = element.level or 1
                # Remove lower or equal level headings
                current_hierarchy = [h for h in current_hierarchy if h["level"] < level]
                current_hierarchy.append({
                    "level": level,
                    "text": element.content,
                    "index": idx
                })
            hierarchy_map[idx] = current_hierarchy.copy()
        
        return hierarchy_map
    
    def _update_heading_context(
        self,
        element: ContentElement,
        current_headings: List[Dict],
        current_path: List[str]
    ) -> Tuple[List[Dict], List[str]]:
        """Update heading context when encountering a heading."""
        level = element.level or 1
        text = element.content
        
        # Remove headings of same or lower level
        filtered = [h for h in current_headings if h["level"] < level]
        filtered.append({"level": level, "text": text})
        
        # Update path
        path = [h["text"] for h in filtered]
        
        return filtered, path
    
    def _create_chunk(
        self,
        elements: List[ContentElement],
        chunk_index: int,
        doc_metadata: DocumentMetadata,
        headings: List[Dict],
        section_path: List[str],
        total_elements: int
    ) -> DocumentChunk:
        """Create a DocumentChunk from elements."""
        # Build content
        content_parts = []
        for elem in elements:
            text = elem.to_text()
            if text.strip():
                content_parts.append(text)
        
        content = "\n\n".join(content_parts)
        
        # Analyze content
        content_types = list(set(e.type.value for e in elements))
        contains_table = any(e.type == ContentType.TABLE for e in elements)
        contains_list = any(e.type == ContentType.LIST for e in elements)
        contains_code = any(e.type == ContentType.CODE_BLOCK for e in elements)
        contains_image = any(e.type == ContentType.IMAGE for e in elements)
        
        # Check if starts with heading
        starts_with_heading = elements[0].type == ContentType.HEADING if elements else False
        
        # Determine boundary type
        last_element = elements[-1] if elements else None
        ends_at_boundary = last_element.type.value if last_element else ""
        
        # Get page number from metadata
        page_number = None
        for elem in elements:
            if "page" in elem.metadata:
                page_number = elem.metadata["page"]
                break
        
        # Get section level
        section_level = headings[-1]["level"] if headings else None
        parent_section = headings[-2]["text"] if len(headings) >= 2 else None
        
        # Calculate stats
        char_count = len(content)
        word_count = len(content.split())
        sentence_count = content.count('.') + content.count('!') + content.count('?')
        token_estimate = word_count * 1.3  # Rough estimate
        
        # Create metadata
        metadata = ChunkMetadata(
            filename=doc_metadata.source_file or "unknown",
            file_type=self._get_file_type(doc_metadata.source_file),
            title=doc_metadata.title,
            author=doc_metadata.author,
            created_at=doc_metadata.created_at,
            modified_at=doc_metadata.modified_at,
            chunk_index=chunk_index,
            total_chunks=0,  # Updated later
            page_number=page_number,
            section_level=section_level,
            headings_hierarchy=headings.copy(),
            parent_section=parent_section,
            section_path=" > ".join(section_path) if section_path else "",
            contains_table=contains_table,
            contains_list=contains_list,
            contains_code=contains_code,
            contains_image=contains_image,
            content_types=content_types,
            char_count=char_count,
            word_count=word_count,
            sentence_count=sentence_count,
            token_estimate=int(token_estimate),
            starts_with_heading=starts_with_heading,
            ends_at_boundary=ends_at_boundary,
            tags=self._extract_tags(elements, headings),
            keywords=doc_metadata.keywords if doc_metadata.keywords else [],
        )
        
        return DocumentChunk(
            content=content,
            metadata=metadata,
            elements=elements.copy()
        )
    
    async def _chunk_large_element(
        self,
        element: ContentElement,
        start_index: int,
        doc_metadata: DocumentMetadata,
        headings: List[Dict],
        section_path: List[str],
        total_elements: int
    ) -> AsyncIterator[DocumentChunk]:
        """Chunk large elements like tables or code blocks."""
        element_text = element.to_text()
        
        if element.type == ContentType.TABLE:
            # For tables, try to split by rows
            async for chunk in self._chunk_table(
                element, start_index, doc_metadata, headings, section_path, total_elements
            ):
                yield chunk
        elif element.type == ContentType.CODE_BLOCK:
            # For code blocks, split by logical sections or lines
            async for chunk in self._chunk_code_block(
                element, start_index, doc_metadata, headings, section_path, total_elements
            ):
                yield chunk
        else:
            # Fall back to text chunking
            sub_chunks = self._recursive_text_chunking(element_text)
            
            for i, sub_text in enumerate(sub_chunks):
                metadata = ChunkMetadata(
                    filename=doc_metadata.source_file or "unknown",
                    file_type=self._get_file_type(doc_metadata.source_file),
                    title=doc_metadata.title,
                    author=doc_metadata.author,
                    chunk_index=start_index + i,
                    total_chunks=0,
                    headings_hierarchy=headings.copy(),
                    section_path=" > ".join(section_path) if section_path else "",
                    content_types=[element.type.value],
                    char_count=len(sub_text),
                    word_count=len(sub_text.split()),
                    token_estimate=int(len(sub_text.split()) * 1.3),
                    ends_at_boundary=element.type.value,
                )
                
                yield DocumentChunk(
                    content=sub_text,
                    metadata=metadata,
                    elements=[element]  # Reference original element
                )
                
                await asyncio.sleep(0.001)
    
    async def _chunk_table(
        self,
        table_element: ContentElement,
        start_index: int,
        doc_metadata: DocumentMetadata,
        headings: List[Dict],
        section_path: List[str],
        total_elements: int
    ) -> AsyncIterator[DocumentChunk]:
        """Chunk tables intelligently, preserving headers."""
        children = table_element.children
        headers = table_element.metadata.get("headers", [])
        
        if not children:
            # Fallback to text chunking
            text = table_element.to_text()
            metadata = ChunkMetadata(
                filename=doc_metadata.source_file or "unknown",
                file_type=self._get_file_type(doc_metadata.source_file),
                title=doc_metadata.title,
                chunk_index=start_index,
                total_chunks=0,
                headings_hierarchy=headings.copy(),
                section_path=" > ".join(section_path) if section_path else "",
                contains_table=True,
                content_types=["table"],
                char_count=len(text),
                word_count=len(text.split()),
                token_estimate=int(len(text.split()) * 1.3),
                ends_at_boundary="table_end",
            )
            yield DocumentChunk(content=text, metadata=metadata, elements=[table_element])
            return
        
        # Group rows into chunks
        rows_per_chunk = max(1, self.chunk_size // 200)  # Estimate rows per chunk
        row_groups = [
            children[i:i + rows_per_chunk] 
            for i in range(0, len(children), rows_per_chunk)
        ]
        
        for group_idx, row_group in enumerate(row_groups):
            # Build table content with headers
            content_parts = []
            if headers and group_idx > 0:  # Include headers in subsequent chunks
                content_parts.append(" | ".join(headers))
                content_parts.append("-" * (len(" | ".join(headers))))
            
            for row in row_group:
                row_text = " | ".join(cell.to_text() for cell in row.children)
                content_parts.append(row_text)
            
            content = "\n".join(content_parts)
            
            metadata = ChunkMetadata(
                filename=doc_metadata.source_file or "unknown",
                file_type=self._get_file_type(doc_metadata.source_file),
                title=doc_metadata.title,
                chunk_index=start_index + group_idx,
                total_chunks=0,
                headings_hierarchy=headings.copy(),
                section_path=" > ".join(section_path) if section_path else "",
                contains_table=True,
                content_types=["table"],
                char_count=len(content),
                word_count=len(content.split()),
                token_estimate=int(len(content.split()) * 1.3),
                ends_at_boundary="table_row",
            )
            
            yield DocumentChunk(
                content=content,
                metadata=metadata,
                elements=[table_element]  # Reference original
            )
            
            await asyncio.sleep(0.001)
    
    async def _chunk_code_block(
        self,
        code_element: ContentElement,
        start_index: int,
        doc_metadata: DocumentMetadata,
        headings: List[Dict],
        section_path: List[str],
        total_elements: int
    ) -> AsyncIterator[DocumentChunk]:
        """Chunk code blocks by logical sections."""
        content = code_element.content
        language = code_element.metadata.get("language", "")
        
        # Split by lines
        lines = content.split('\n')
        
        if len(content) <= self.chunk_size:
            # Code block fits in one chunk
            metadata = ChunkMetadata(
                filename=doc_metadata.source_file or "unknown",
                file_type=self._get_file_type(doc_metadata.source_file),
                title=doc_metadata.title,
                chunk_index=start_index,
                total_chunks=0,
                headings_hierarchy=headings.copy(),
                section_path=" > ".join(section_path) if section_path else "",
                contains_code=True,
                content_types=["code_block"],
                char_count=len(content),
                word_count=len(content.split()),
                token_estimate=int(len(content.split()) * 1.3),
                ends_at_boundary="code_block_end",
            )
            yield DocumentChunk(content=content, metadata=metadata, elements=[code_element])
            return
        
        # Split into chunks by logical boundaries (comments, blank lines)
        chunk_lines = []
        chunk_size = 0
        chunk_idx = 0
        
        for line in lines:
            line_size = len(line) + 1  # +1 for newline
            
            if chunk_size + line_size > self.chunk_size and chunk_lines:
                # Yield current chunk
                chunk_content = '\n'.join(chunk_lines)
                metadata = ChunkMetadata(
                    filename=doc_metadata.source_file or "unknown",
                    file_type=self._get_file_type(doc_metadata.source_file),
                    title=doc_metadata.title,
                    chunk_index=start_index + chunk_idx,
                    total_chunks=0,
                    headings_hierarchy=headings.copy(),
                    section_path=" > ".join(section_path) if section_path else "",
                    contains_code=True,
                    content_types=["code_block"],
                    char_count=len(chunk_content),
                    word_count=len(chunk_content.split()),
                    token_estimate=int(len(chunk_content.split()) * 1.3),
                    ends_at_boundary="code_block_section",
                )
                yield DocumentChunk(
                    content=chunk_content,
                    metadata=metadata,
                    elements=[code_element]
                )
                chunk_idx += 1
                
                # Carry over comment lines for context
                chunk_lines = []
                chunk_size = 0
                for prev_line in reversed(chunk_lines[-5:] if len(chunk_lines) >= 5 else chunk_lines):
                    if prev_line.strip().startswith('#') or prev_line.strip().startswith('//'):
                        chunk_lines.insert(0, prev_line)
                        chunk_size += len(prev_line) + 1
                    else:
                        break
            
            chunk_lines.append(line)
            chunk_size += line_size
        
        # Yield remaining lines
        if chunk_lines:
            chunk_content = '\n'.join(chunk_lines)
            metadata = ChunkMetadata(
                filename=doc_metadata.source_file or "unknown",
                file_type=self._get_file_type(doc_metadata.source_file),
                title=doc_metadata.title,
                chunk_index=start_index + chunk_idx,
                total_chunks=0,
                headings_hierarchy=headings.copy(),
                section_path=" > ".join(section_path) if section_path else "",
                contains_code=True,
                content_types=["code_block"],
                char_count=len(chunk_content),
                word_count=len(chunk_content.split()),
                token_estimate=int(len(chunk_content.split()) * 1.3),
                ends_at_boundary="code_block_end",
            )
            yield DocumentChunk(content=chunk_content, metadata=metadata, elements=[code_element])
    
    def _get_overlap_elements(self, elements: List[ContentElement]) -> List[ContentElement]:
        """Get elements to carry over for overlap."""
        if not self.chunk_overlap or not elements:
            return []
        
        # Keep last heading for context
        overlap = []
        for elem in reversed(elements):
            if elem.type == ContentType.HEADING:
                overlap.insert(0, elem)
                break
        
        # Also keep some context from end of previous chunk
        total_overlap = 0
        for elem in reversed(elements):
            text = elem.to_text()
            if total_overlap + len(text) <= self.chunk_overlap:
                overlap.insert(0, elem)
                total_overlap += len(text)
            else:
                break
        
        return overlap
    
    def _recursive_text_chunking(self, text: str) -> List[str]:
        """Recursive chunking for plain text."""
        if len(text) <= self.chunk_size:
            return [text]
        
        separators = ['\n\n', '\n', '. ', '! ', '? ', ' ', '']
        
        for sep in separators:
            if sep in text:
                parts = text.split(sep)
                if len(parts) > 1:
                    chunks = []
                    current = ""
                    
                    for part in parts:
                        if len(current) + len(part) + len(sep) > self.chunk_size:
                            if current:
                                chunks.append(current.strip())
                            current = part
                        else:
                            current = current + sep + part if current else part
                    
                    if current:
                        chunks.append(current.strip())
                    
                    if len(chunks) > 1 or (chunks and len(chunks[0]) <= self.chunk_size):
                        return chunks
        
        # Fallback to fixed chunking
        chunks = []
        start = 0
        while start < len(text):
            end = min(start + self.chunk_size, len(text))
            chunks.append(text[start:end].strip())
            start = end
        
        return chunks
    
    def _get_file_type(self, filename: Optional[str]) -> str:
        """Extract file type from filename."""
        if not filename:
            return "unknown"
        from pathlib import Path
        return Path(filename).suffix.lower().lstrip('.') or "unknown"
    
    def _extract_tags(self, elements: List[ContentElement], headings: List[Dict]) -> List[str]:
        """Extract tags from content."""
        tags = set()
        
        # Add heading-based tags
        for h in headings:
            words = h["text"].lower().split()[:3]  # First 3 words of heading
            for word in words:
                if len(word) > 3:
                    tags.add(word)
        
        # Add content type tags
        type_mapping = {
            ContentType.TABLE: "table",
            ContentType.LIST: "list",
            ContentType.CODE_BLOCK: "code",
            ContentType.IMAGE: "image",
        }
        for elem in elements:
            if elem.type in type_mapping:
                tags.add(type_mapping[elem.type])
        
        return list(tags)[:10]  # Limit to 10 tags


# Global instance
structure_aware_chunker = StructureAwareChunker()
