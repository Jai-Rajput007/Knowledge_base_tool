"""PDF document loader with support for images, tables, and structured content."""

from pathlib import Path
from typing import Union, Optional, List, Dict, Any, BinaryIO
import io

from app.services.document_loaders.base import (
    DocumentLoader, DocumentContent, ContentElement, 
    ContentType, DocumentMetadata, ElementType
)
from app.core.logging import logger
from app.core.exceptions import DocumentProcessingError


class PDFLoader(DocumentLoader):
    """PDF loader with comprehensive content extraction."""
    
    supported_extensions = [".pdf"]
    
    def load(self, file_path: Union[str, Path]) -> DocumentContent:
        """Load PDF from file path."""
        file_path = Path(file_path)
        logger.info(f"Loading PDF: {file_path}")
        
        try:
            with open(file_path, 'rb') as f:
                content = f.read()
            return self.load_from_bytes(content, file_path.name)
        except Exception as e:
            logger.error(f"Failed to load PDF file: {str(e)}")
            raise DocumentProcessingError(f"PDF load failed: {str(e)}")
    
    def load_from_bytes(self, content: bytes, filename: Optional[str] = None) -> DocumentContent:
        """Load PDF from bytes."""
        try:
            from pypdf import PdfReader
            
            reader = PdfReader(io.BytesIO(content))
            elements = []
            full_text_parts = []
            
            # Extract metadata
            metadata = self._extract_metadata(reader, filename, len(content))
            
            # Process each page
            for page_num, page in enumerate(reader.pages, 1):
                page_elements = self._extract_page_content(page, page_num)
                elements.extend(page_elements)
                
                # Add page break
                if page_num < len(reader.pages):
                    elements.append(ContentElement(
                        type=ContentType.PAGE_BREAK,
                        content=f"--- Page {page_num} ---",
                        metadata={"page_number": page_num}
                    ))
            
            # Get raw text
            raw_text = "\n\n".join(full_text_parts) if full_text_parts else None
            
            # Create document content
            doc_content = DocumentContent(
                elements=elements,
                metadata=metadata,
                raw_text=raw_text
            )
            
            # Update word count
            metadata.word_count = len(doc_content.to_text().split())
            
            logger.info(f"PDF loaded successfully: {len(elements)} elements")
            return doc_content
            
        except ImportError:
            logger.error("pypdf not installed")
            raise DocumentProcessingError("pypdf library required for PDF processing")
        except Exception as e:
            logger.error(f"PDF processing failed: {str(e)}")
            raise DocumentProcessingError(f"PDF processing failed: {str(e)}")
    
    def _extract_metadata(self, reader, filename: Optional[str], file_size: int) -> DocumentMetadata:
        """Extract PDF metadata."""
        pdf_meta = reader.metadata or {}
        
        return DocumentMetadata(
            title=pdf_meta.get('/Title') or pdf_meta.get('title'),
            author=pdf_meta.get('/Author') or pdf_meta.get('author'),
            subject=pdf_meta.get('/Subject') or pdf_meta.get('subject'),
            keywords=self._parse_keywords(pdf_meta.get('/Keywords') or pdf_meta.get('keywords')),
            created_at=str(pdf_meta.get('/CreationDate')) if pdf_meta.get('/CreationDate') else None,
            modified_at=str(pdf_meta.get('/ModDate')) if pdf_meta.get('/ModDate') else None,
            page_count=len(reader.pages),
            source_file=filename,
            file_size=file_size,
            custom=dict(pdf_meta)
        )
    
    def _parse_keywords(self, keywords: Any) -> List[str]:
        """Parse keywords from metadata."""
        if not keywords:
            return []
        if isinstance(keywords, str):
            return [k.strip() for k in keywords.split(',') if k.strip()]
        return []
    
    def _extract_page_content(self, page, page_num: int) -> List[ContentElement]:
        """Extract content from a single page."""
        elements = []
        
        # Extract text
        text = page.extract_text()
        if text and text.strip():
            # Try to detect headings (simple heuristic: short lines in all caps or with numbers)
            lines = text.split('\n')
            current_paragraph = []
            
            for line in lines:
                line = line.strip()
                if not line:
                    if current_paragraph:
                        elements.append(self._create_text_element(
                            ' '.join(current_paragraph),
                            ContentType.PARAGRAPH
                        ))
                        current_paragraph = []
                    continue
                
                # Check if line is a heading
                if self._is_heading(line):
                    if current_paragraph:
                        elements.append(self._create_text_element(
                            ' '.join(current_paragraph),
                            ContentType.PARAGRAPH
                        ))
                        current_paragraph = []
                    
                    level = self._detect_heading_level(line)
                    elements.append(self._create_heading_element(line, level))
                else:
                    current_paragraph.append(line)
            
            # Add remaining paragraph
            if current_paragraph:
                elements.append(self._create_text_element(
                    ' '.join(current_paragraph),
                    ContentType.PARAGRAPH
                ))
        
        # Extract images
        try:
            images = self._extract_images(page, page_num)
            elements.extend(images)
        except Exception as e:
            logger.debug(f"Could not extract images from page {page_num}: {e}")
        
        return elements
    
    def _is_heading(self, line: str) -> bool:
        """Heuristic to detect if a line is a heading."""
        if len(line) > 100:
            return False
        
        # All caps heading
        if line.isupper() and len(line) > 3:
            return True
        
        # Numbered heading (1. Title, 1.1 Subtitle, etc.)
        import re
        if re.match(r'^[\d.]+\s+\w', line):
            return True
        
        # Short bold-looking text (ends without punctuation)
        if len(line) < 60 and not line[-1] in '.!?,' and not line.islower():
            return True
        
        return False
    
    def _detect_heading_level(self, line: str) -> int:
        """Detect heading level."""
        import re
        
        # Check for numbered headings
        match = re.match(r'^(\d+(?:\.\d+)*)', line)
        if match:
            level = len(match.group(1).split('.'))
            return min(level, 6)
        
        # All caps is usually level 1
        if line.isupper():
            return 1
        
        return 2
    
    def _extract_images(self, page, page_num: int) -> List[ContentElement]:
        """Extract images from page."""
        images = []
        
        try:
            if hasattr(page, 'images'):
                for img_idx, img in enumerate(page.images, 1):
                    element = ContentElement(
                        type=ContentType.IMAGE,
                        content=f"[Image on page {page_num} - Image {img_idx}]",
                        metadata={
                            "page": page_num,
                            "image_index": img_idx,
                            "width": getattr(img, 'width', None),
                            "height": getattr(img, 'height', None),
                            "format": getattr(img, 'format', 'unknown'),
                        }
                    )
                    images.append(element)
        except Exception as e:
            logger.debug(f"Image extraction skipped for page {page_num}: {e}")
        
        return images
    
    def extract_tables(self, file_path: Union[str, Path]) -> List[ContentElement]:
        """Extract tables from PDF using specialized libraries."""
        elements = []
        
        try:
            # Try camelot for table extraction
            import camelot
            tables = camelot.read_pdf(str(file_path), pages='all')
            
            for i, table in enumerate(tables, 1):
                df = table.df
                headers = df.iloc[0].tolist() if not df.empty else None
                rows = df.iloc[1:].values.tolist() if headers else df.values.tolist()
                
                element = self._create_table_element(rows, headers)
                element.metadata.update({
                    "source": "camelot",
                    "accuracy": table.accuracy,
                    "page": table.page,
                    "table_index": i,
                })
                elements.append(element)
                
        except ImportError:
            logger.debug("camelot-py not installed, skipping table extraction")
        except Exception as e:
            logger.debug(f"Table extraction failed: {e}")
        
        # Fallback to pdfplumber
        if not elements:
            try:
                import pdfplumber
                with pdfplumber.open(file_path) as pdf:
                    for page_num, page in enumerate(pdf.pages, 1):
                        tables = page.extract_tables()
                        for table_idx, table in enumerate(tables, 1):
                            if table:
                                headers = table[0] if table else None
                                rows = table[1:] if headers else table
                                
                                element = self._create_table_element(rows, headers)
                                element.metadata.update({
                                    "source": "pdfplumber",
                                    "page": page_num,
                                    "table_index": table_idx,
                                })
                                elements.append(element)
            except ImportError:
                logger.debug("pdfplumber not installed, skipping table extraction")
            except Exception as e:
                logger.debug(f"pdfplumber table extraction failed: {e}")
        
        return elements
