"""Plain text document loader."""

from pathlib import Path
from typing import Union, Optional
import io

from app.services.document_loaders.base import (
    DocumentLoader, DocumentContent, ContentElement, 
    ContentType, DocumentMetadata
)
from app.core.logging import logger
from app.core.exceptions import DocumentProcessingError


class TextLoader(DocumentLoader):
    """Plain text loader."""
    
    supported_extensions = [".txt"]
    
    def load(self, file_path: Union[str, Path]) -> DocumentContent:
        """Load text from file path."""
        file_path = Path(file_path)
        logger.info(f"Loading text file: {file_path}")
        
        try:
            with open(file_path, 'rb') as f:
                content = f.read()
            return self.load_from_bytes(content, file_path.name)
        except Exception as e:
            logger.error(f"Failed to load text file: {str(e)}")
            raise DocumentProcessingError(f"Text load failed: {str(e)}")
    
    def load_from_bytes(self, content: bytes, filename: Optional[str] = None) -> DocumentContent:
        """Load text from bytes."""
        try:
            # Try UTF-8 first
            try:
                text = content.decode('utf-8')
            except UnicodeDecodeError:
                # Fall back to latin-1
                text = content.decode('latin-1')
            
            elements = self._parse_text(text)
            
            metadata = DocumentMetadata(
                title=Path(filename).stem if filename else None,
                source_file=filename,
                file_size=len(content),
                word_count=len(text.split())
            )
            
            doc_content = DocumentContent(
                elements=elements,
                metadata=metadata,
                raw_text=text
            )
            
            logger.info(f"Text loaded successfully: {len(elements)} elements")
            return doc_content
            
        except Exception as e:
            logger.error(f"Text processing failed: {str(e)}")
            raise DocumentProcessingError(f"Text processing failed: {str(e)}")
    
    def _parse_text(self, text: str) -> list:
        """Parse plain text into structured elements."""
        elements = []
        paragraphs = text.split('\n\n')
        
        for para in paragraphs:
            para = para.strip()
            if not para:
                continue
            
            # Check for headings (all caps, or prefixed with markers)
            lines = para.split('\n')
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                
                if self._is_heading(line):
                    level = self._detect_heading_level(line)
                    elements.append(self._create_heading_element(line, level))
                else:
                    elements.append(self._create_text_element(line, ContentType.PARAGRAPH))
        
        return elements
    
    def _is_heading(self, line: str) -> bool:
        """Simple heading detection."""
        if len(line) > 100:
            return False
        if line.isupper() and len(line) > 3:
            return True
        if line.startswith('#'):
            return True
        return False
    
    def _detect_heading_level(self, line: str) -> int:
        """Detect heading level."""
        if line.startswith('#'):
            return min(len(line.split()[0]), 6)
        return 1
