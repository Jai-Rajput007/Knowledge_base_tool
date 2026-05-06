"""Base document loader interface."""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Union
from enum import Enum
from pathlib import Path


class ContentType(Enum):
    """Types of content elements."""
    TEXT = "text"
    HEADING = "heading"
    PARAGRAPH = "paragraph"
    LIST = "list"
    LIST_ITEM = "list_item"
    TABLE = "table"
    TABLE_ROW = "table_row"
    TABLE_CELL = "table_cell"
    IMAGE = "image"
    CODE_BLOCK = "code_block"
    QUOTE = "quote"
    METADATA = "metadata"
    PAGE_BREAK = "page_break"


class ElementType(Enum):
    """Element types for structured content."""
    BLOCK = "block"
    INLINE = "inline"


@dataclass
class ContentElement:
    """Represents a single content element."""
    type: ContentType
    content: str
    level: Optional[int] = None  # For headings/lists
    metadata: Dict[str, Any] = field(default_factory=dict)
    children: List["ContentElement"] = field(default_factory=list)
    element_type: ElementType = ElementType.BLOCK
    
    def to_text(self) -> str:
        """Convert element to plain text."""
        if self.children:
            children_text = " ".join(child.to_text() for child in self.children)
            return f"{self.content} {children_text}".strip()
        return self.content
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "type": self.type.value,
            "content": self.content,
            "level": self.level,
            "metadata": self.metadata,
            "children": [child.to_dict() for child in self.children],
            "element_type": self.element_type.value,
        }


@dataclass
class DocumentMetadata:
    """Document metadata."""
    title: Optional[str] = None
    author: Optional[str] = None
    subject: Optional[str] = None
    keywords: List[str] = field(default_factory=list)
    created_at: Optional[str] = None
    modified_at: Optional[str] = None
    page_count: Optional[int] = None
    word_count: Optional[int] = None
    language: Optional[str] = None
    source_file: Optional[str] = None
    file_size: Optional[int] = None
    custom: Dict[str, Any] = field(default_factory=dict)


@dataclass
class DocumentContent:
    """Complete document content with structure."""
    elements: List[ContentElement] = field(default_factory=list)
    metadata: DocumentMetadata = field(default_factory=DocumentMetadata)
    raw_text: Optional[str] = None
    
    def to_text(self) -> str:
        """Convert all content to plain text."""
        return "\n\n".join(elem.to_text() for elem in self.elements if elem.to_text().strip())
    
    def get_headings(self) -> List[ContentElement]:
        """Get all heading elements."""
        return [e for e in self.elements if e.type == ContentType.HEADING]
    
    def get_tables(self) -> List[ContentElement]:
        """Get all table elements."""
        return [e for e in self.elements if e.type == ContentType.TABLE]
    
    def get_lists(self) -> List[ContentElement]:
        """Get all list elements."""
        return [e for e in self.elements if e.type == ContentType.LIST]
    
    def get_images(self) -> List[ContentElement]:
        """Get all image elements."""
        return [e for e in self.elements if e.type == ContentType.IMAGE]
    
    def get_text_chunks(self, chunk_size: int = 1000, overlap: int = 100) -> List[str]:
        """Split document into text chunks."""
        text = self.to_text()
        if not text:
            return []
        
        chunks = []
        start = 0
        
        while start < len(text):
            end = min(start + chunk_size, len(text))
            
            # Try to break at a sentence boundary
            if end < len(text):
                # Look for sentence endings
                for i in range(end, max(start + chunk_size - 200, start), -1):
                    if i < len(text) and text[i] in '.!?\n':
                        end = i + 1
                        break
            
            chunk = text[start:end].strip()
            if chunk:
                chunks.append(chunk)
            
            start = end - overlap if end < len(text) else end
        
        return chunks
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "elements": [elem.to_dict() for elem in self.elements],
            "metadata": {
                "title": self.metadata.title,
                "author": self.metadata.author,
                "subject": self.metadata.subject,
                "keywords": self.metadata.keywords,
                "created_at": self.metadata.created_at,
                "modified_at": self.metadata.modified_at,
                "page_count": self.metadata.page_count,
                "word_count": self.metadata.word_count,
                "language": self.metadata.language,
                "source_file": self.metadata.source_file,
                "file_size": self.metadata.file_size,
                "custom": self.metadata.custom,
            },
            "raw_text": self.raw_text,
        }


class DocumentLoader(ABC):
    """Abstract base class for document loaders."""
    
    supported_extensions: List[str] = []
    
    @abstractmethod
    def load(self, file_path: Union[str, Path]) -> DocumentContent:
        """Load document from file path."""
        pass
    
    @abstractmethod
    def load_from_bytes(self, content: bytes, filename: Optional[str] = None) -> DocumentContent:
        """Load document from bytes."""
        pass
    
    def can_load(self, file_path: Union[str, Path]) -> bool:
        """Check if loader can handle file."""
        ext = Path(file_path).suffix.lower()
        return ext in self.supported_extensions
    
    def _create_text_element(self, text: str, element_type: ContentType = ContentType.PARAGRAPH) -> ContentElement:
        """Helper to create text element."""
        return ContentElement(
            type=element_type,
            content=text.strip()
        )
    
    def _create_heading_element(self, text: str, level: int = 1) -> ContentElement:
        """Helper to create heading element."""
        return ContentElement(
            type=ContentType.HEADING,
            content=text.strip(),
            level=level
        )
    
    def _create_list_element(self, items: List[str], ordered: bool = False) -> ContentElement:
        """Helper to create list element."""
        children = [
            ContentElement(
                type=ContentType.LIST_ITEM,
                content=item,
                element_type=ElementType.INLINE
            )
            for item in items
        ]
        return ContentElement(
            type=ContentType.LIST,
            content="",
            metadata={"ordered": ordered},
            children=children
        )
    
    def _create_table_element(self, rows: List[List[str]], headers: Optional[List[str]] = None) -> ContentElement:
        """Helper to create table element."""
        table_data = {
            "headers": headers or [],
            "row_count": len(rows),
            "col_count": len(rows[0]) if rows else 0,
        }
        
        children = []
        for row_idx, row in enumerate(rows):
            row_children = [
                ContentElement(
                    type=ContentType.TABLE_CELL,
                    content=cell,
                    metadata={"row": row_idx, "col": col_idx},
                    element_type=ElementType.INLINE
                )
                for col_idx, cell in enumerate(row)
            ]
            children.append(ContentElement(
                type=ContentType.TABLE_ROW,
                content="",
                children=row_children
            ))
        
        return ContentElement(
            type=ContentType.TABLE,
            content="",
            metadata=table_data,
            children=children
        )
    
    def _create_image_element(self, alt_text: str, source: Optional[str] = None, 
                           width: Optional[int] = None, height: Optional[int] = None) -> ContentElement:
        """Helper to create image element."""
        return ContentElement(
            type=ContentType.IMAGE,
            content=alt_text,
            metadata={
                "source": source,
                "width": width,
                "height": height,
            }
        )
