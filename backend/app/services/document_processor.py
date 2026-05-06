"""Document processing service."""

import os
from pathlib import Path
from typing import List, Optional
from abc import ABC, abstractmethod

from app.core.config import settings
from app.core.logging import logger
from app.core.exceptions import DocumentProcessingError


class TextExtractor(ABC):
    """Abstract base class for text extractors."""
    
    @abstractmethod
    def extract(self, file_path: str) -> str:
        """Extract text from file."""
        pass
    
    @abstractmethod
    def supported_extensions(self) -> List[str]:
        """Return supported file extensions."""
        pass


class PDFExtractor(TextExtractor):
    """PDF text extractor."""
    
    def extract(self, file_path: str) -> str:
        """Extract text from PDF."""
        try:
            from pypdf import PdfReader
            reader = PdfReader(file_path)
            text = ""
            for page in reader.pages:
                text += page.extract_text() + "\n"
            return text
        except Exception as e:
            logger.error(f"PDF extraction failed: {str(e)}")
            raise DocumentProcessingError(f"Failed to extract PDF: {str(e)}")
    
    def supported_extensions(self) -> List[str]:
        return [".pdf"]


class DOCXExtractor(TextExtractor):
    """DOCX text extractor."""
    
    def extract(self, file_path: str) -> str:
        """Extract text from DOCX."""
        try:
            from docx import Document
            doc = Document(file_path)
            text = "\n".join([paragraph.text for paragraph in doc.paragraphs])
            return text
        except Exception as e:
            logger.error(f"DOCX extraction failed: {str(e)}")
            raise DocumentProcessingError(f"Failed to extract DOCX: {str(e)}")
    
    def supported_extensions(self) -> List[str]:
        return [".docx"]


class TextFileExtractor(TextExtractor):
    """Plain text file extractor."""
    
    def extract(self, file_path: str) -> str:
        """Extract text from plain text file."""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return f.read()
        except UnicodeDecodeError:
            # Try with different encoding
            try:
                with open(file_path, 'r', encoding='latin-1') as f:
                    return f.read()
            except Exception as e:
                logger.error(f"Text extraction failed: {str(e)}")
                raise DocumentProcessingError(f"Failed to extract text: {str(e)}")
        except Exception as e:
            logger.error(f"Text extraction failed: {str(e)}")
            raise DocumentProcessingError(f"Failed to extract text: {str(e)}")
    
    def supported_extensions(self) -> List[str]:
        return [".txt", ".md", ".markdown"]


class DocumentProcessor:
    """Main document processing service."""
    
    def __init__(self):
        self.extractors: List[TextExtractor] = [
            PDFExtractor(),
            DOCXExtractor(),
            TextFileExtractor(),
        ]
    
    def extract_text(self, file_path: str) -> str:
        """Extract text from any supported file."""
        ext = Path(file_path).suffix.lower()
        
        for extractor in self.extractors:
            if ext in extractor.supported_extensions():
                logger.info(f"Extracting text from {file_path} using {extractor.__class__.__name__}")
                return extractor.extract(file_path)
        
        raise DocumentProcessingError(f"Unsupported file type: {ext}")
    
    def chunk_text(
        self,
        text: str,
        chunk_size: int = None,
        chunk_overlap: int = None,
        strategy: str = None
    ) -> List[str]:
        """Split text into chunks."""
        chunk_size = chunk_size or settings.CHUNK_SIZE
        chunk_overlap = chunk_overlap or settings.CHUNK_OVERLAP
        strategy = strategy or settings.CHUNKING_STRATEGY
        
        logger.info(f"Chunking text with strategy: {strategy}, size: {chunk_size}, overlap: {chunk_overlap}")
        
        if strategy == "semantic":
            return self._semantic_chunking(text, chunk_size, chunk_overlap)
        elif strategy == "fixed":
            return self._fixed_chunking(text, chunk_size, chunk_overlap)
        elif strategy == "recursive":
            return self._recursive_chunking(text, chunk_size, chunk_overlap)
        else:
            return self._fixed_chunking(text, chunk_size, chunk_overlap)
    
    def _fixed_chunking(self, text: str, chunk_size: int, chunk_overlap: int) -> List[str]:
        """Fixed-size chunking with overlap."""
        chunks = []
        start = 0
        
        while start < len(text):
            end = min(start + chunk_size, len(text))
            chunk = text[start:end]
            chunks.append(chunk)
            start = end - chunk_overlap if end < len(text) else end
        
        return chunks
    
    def _semantic_chunking(self, text: str, chunk_size: int, chunk_overlap: int) -> List[str]:
        """Semantic chunking based on paragraphs and sentences."""
        # Split into paragraphs first
        paragraphs = text.split('\n\n')
        chunks = []
        current_chunk = ""
        
        for paragraph in paragraphs:
            # If adding this paragraph would exceed chunk size
            if len(current_chunk) + len(paragraph) > chunk_size:
                # Save current chunk if not empty
                if current_chunk:
                    chunks.append(current_chunk.strip())
                
                # If paragraph itself is larger than chunk_size, split it
                if len(paragraph) > chunk_size:
                    sub_chunks = self._fixed_chunking(paragraph, chunk_size, chunk_overlap)
                    chunks.extend(sub_chunks)
                    current_chunk = ""
                else:
                    current_chunk = paragraph
            else:
                current_chunk += "\n\n" + paragraph if current_chunk else paragraph
        
        # Don't forget the last chunk
        if current_chunk:
            chunks.append(current_chunk.strip())
        
        return chunks
    
    def _recursive_chunking(self, text: str, chunk_size: int, chunk_overlap: int) -> List[str]:
        """Recursive chunking that tries multiple separators."""
        # Try paragraph separation first
        if len(text) <= chunk_size:
            return [text]
        
        separators = ['\n\n', '\n', '. ', '! ', '? ', ' ', '']
        
        for sep in separators:
            if sep in text:
                parts = text.split(sep)
                if len(parts) > 1:
                    chunks = []
                    current = ""
                    
                    for part in parts:
                        if len(current) + len(part) + len(sep) > chunk_size:
                            if current:
                                chunks.append(current.strip())
                            current = part
                        else:
                            current = current + sep + part if current else part
                    
                    if current:
                        chunks.append(current.strip())
                    
                    # If we got reasonable chunks, return them
                    if len(chunks) > 1 or len(chunks[0]) <= chunk_size:
                        return chunks
        
        # Fallback to fixed chunking
        return self._fixed_chunking(text, chunk_size, chunk_overlap)
    
    def process_document(self, file_path: str) -> dict:
        """Full document processing pipeline."""
        logger.info(f"Processing document: {file_path}")
        
        # Extract text
        text = self.extract_text(file_path)
        
        # Chunk text
        chunks = self.chunk_text(text)
        
        return {
            "text": text,
            "chunks": chunks,
            "chunk_count": len(chunks),
            "char_count": len(text),
        }


# Global processor instance
document_processor = DocumentProcessor()
