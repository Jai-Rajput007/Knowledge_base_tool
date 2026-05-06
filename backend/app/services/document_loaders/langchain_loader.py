"""LangChain document loader wrapper for fallback format support."""

from pathlib import Path
from typing import Union, Optional, List, Dict, Any, Type
import io

from app.services.document_loaders.base import (
    DocumentLoader, DocumentContent, ContentElement,
    ContentType, DocumentMetadata, ElementType
)
from app.core.logging import logger
from app.core.exceptions import DocumentProcessingError


class LangChainLoaderWrapper(DocumentLoader):
    """Wrapper for LangChain document loaders to adapt to our format."""
    
    def __init__(self, langchain_loader_class: Type, supported_extensions: List[str]):
        self.loader_class = langchain_loader_class
        self.supported_extensions = supported_extensions
    
    def load(self, file_path: Union[str, Path]) -> DocumentContent:
        """Load using LangChain loader."""
        file_path = Path(file_path)
        logger.info(f"Loading with LangChain: {file_path}")
        
        try:
            loader = self.loader_class(str(file_path))
            langchain_docs = loader.load()
            
            return self._convert_to_document_content(
                langchain_docs, 
                file_path.name,
                file_path.stat().st_size
            )
            
        except Exception as e:
            logger.error(f"LangChain loader failed for {file_path}: {str(e)}")
            raise DocumentProcessingError(f"Failed to load {file_path.suffix}: {str(e)}")
    
    def load_from_bytes(self, content: bytes, filename: Optional[str] = None) -> DocumentContent:
        """Load from bytes using temporary file."""
        import tempfile
        import os
        
        # Determine extension
        ext = Path(filename).suffix if filename else '.tmp'
        
        # Create temp file
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            tmp.write(content)
            tmp_path = tmp.name
        
        try:
            result = self.load(tmp_path)
            # Update metadata with original filename
            if filename:
                result.metadata.source_file = filename
            return result
        finally:
            # Cleanup
            try:
                os.unlink(tmp_path)
            except:
                pass
    
    def _convert_to_document_content(
        self, 
        langchain_docs: List, 
        filename: str,
        file_size: int
    ) -> DocumentContent:
        """Convert LangChain Document list to our DocumentContent format."""
        elements = []
        all_text_parts = []
        
        # Process each LangChain document (usually per page)
        for i, doc in enumerate(langchain_docs):
            page_num = doc.metadata.get('page', i + 1)
            source = doc.metadata.get('source', filename)
            
            # Try to detect structure in the content
            page_elements = self._parse_content_structure(
                doc.page_content, 
                page_num,
                doc.metadata
            )
            elements.extend(page_elements)
            
            # Add page break if multiple pages
            if len(langchain_docs) > 1 and i < len(langchain_docs) - 1:
                elements.append(ContentElement(
                    type=ContentType.PAGE_BREAK,
                    content=f"--- Page {page_num} ---",
                    metadata={"page_number": page_num}
                ))
            
            all_text_parts.append(doc.page_content)
        
        # Extract metadata
        metadata = self._extract_metadata(langchain_docs, filename, file_size)
        
        # Create document content
        raw_text = '\n\n'.join(all_text_parts)
        metadata.word_count = len(raw_text.split())
        
        return DocumentContent(
            elements=elements,
            metadata=metadata,
            raw_text=raw_text
        )
    
    def _parse_content_structure(
        self, 
        content: str, 
        page_num: int,
        metadata: Dict
    ) -> List[ContentElement]:
        """Parse content and try to detect structure."""
        elements = []
        lines = content.split('\n')
        
        current_paragraph = []
        in_code_block = False
        code_content = []
        
        i = 0
        while i < len(lines):
            line = lines[i]
            stripped = line.strip()
            
            # Code block detection
            if stripped.startswith('```'):
                if in_code_block:
                    # End code block
                    elements.append(ContentElement(
                        type=ContentType.CODE_BLOCK,
                        content='\n'.join(code_content),
                        metadata={
                            "language": stripped[3:].strip(),
                            "page": page_num
                        }
                    ))
                    code_content = []
                    in_code_block = False
                else:
                    # Start code block - flush current paragraph
                    if current_paragraph:
                        elements.append(self._create_text_element(
                            ' '.join(current_paragraph),
                            ContentType.PARAGRAPH
                        ))
                        current_paragraph = []
                    in_code_block = True
                i += 1
                continue
            
            if in_code_block:
                code_content.append(line)
                i += 1
                continue
            
            # Empty line - flush paragraph
            if not stripped:
                if current_paragraph:
                    elements.append(self._create_text_element(
                        ' '.join(current_paragraph),
                        ContentType.PARAGRAPH
                    ))
                    current_paragraph = []
                i += 1
                continue
            
            # Try to detect headings
            if self._is_heading(line):
                if current_paragraph:
                    elements.append(self._create_text_element(
                        ' '.join(current_paragraph),
                        ContentType.PARAGRAPH
                    ))
                    current_paragraph = []
                
                level = self._detect_heading_level(line)
                elements.append(self._create_heading_element(stripped, level))
            
            # Try to detect list items
            elif self._is_list_item(line):
                if current_paragraph:
                    elements.append(self._create_text_element(
                        ' '.join(current_paragraph),
                        ContentType.PARAGRAPH
                    ))
                    current_paragraph = []
                
                # Collect list items
                list_items = [self._clean_list_marker(stripped)]
                i += 1
                while i < len(lines):
                    next_line = lines[i].strip()
                    if not next_line:
                        i += 1
                        continue
                    if self._is_list_item(next_line):
                        list_items.append(self._clean_list_marker(next_line))
                        i += 1
                    else:
                        break
                
                # Determine if ordered
                is_ordered = bool(any(c.isdigit() for c in line[:10]))
                elements.append(self._create_list_element(list_items, is_ordered))
                continue
            
            # Regular paragraph line
            else:
                current_paragraph.append(stripped)
            
            i += 1
        
        # Flush remaining paragraph
        if current_paragraph:
            elements.append(self._create_text_element(
                ' '.join(current_paragraph),
                ContentType.PARAGRAPH
            ))
        
        # Flush remaining code block
        if in_code_block and code_content:
            elements.append(ContentElement(
                type=ContentType.CODE_BLOCK,
                content='\n'.join(code_content),
                metadata={"page": page_num}
            ))
        
        return elements
    
    def _is_heading(self, line: str) -> bool:
        """Detect if line is a heading."""
        stripped = line.strip()
        
        # Markdown style
        if stripped.startswith('#'):
            return True
        
        # Underline style (next line is === or ---)
        # (Handled elsewhere if we had lookahead)
        
        # Short all-caps line
        if len(stripped) < 100 and stripped.isupper() and len(stripped) > 3:
            return True
        
        # Numbered heading pattern
        import re
        if re.match(r'^\d+(\.\d+)*\.?\s+\w', stripped):
            return True
        
        return False
    
    def _detect_heading_level(self, line: str) -> int:
        """Detect heading level."""
        stripped = line.strip()
        
        # Count markdown hashes
        if stripped.startswith('#'):
            level = 0
            for char in stripped:
                if char == '#':
                    level += 1
                else:
                    break
            return min(level, 6)
        
        # Numbered sections
        import re
        match = re.match(r'^(\d+(?:\.\d+)*)', stripped)
        if match:
            return min(len(match.group(1).split('.')), 6)
        
        # All caps = level 1
        if stripped.isupper():
            return 1
        
        return 2
    
    def _is_list_item(self, line: str) -> bool:
        """Detect if line is a list item."""
        stripped = line.lstrip()
        import re
        
        # Bullet markers
        if re.match(r'^[\*\-\+\•\◦\▪]\s', stripped):
            return True
        
        # Numbered
        if re.match(r'^\d+[\.\)]\s', stripped):
            return True
        
        return False
    
    def _clean_list_marker(self, line: str) -> str:
        """Remove list marker from line."""
        import re
        # Remove bullet or number prefix
        cleaned = re.sub(r'^[\s]*[\*\-\+\•\◦\▪\d\)\.]+\s*', '', line)
        return cleaned.strip()
    
    def _extract_metadata(
        self, 
        langchain_docs: List, 
        filename: str,
        file_size: int
    ) -> DocumentMetadata:
        """Extract metadata from LangChain documents."""
        # Get metadata from first doc
        first_meta = langchain_docs[0].metadata if langchain_docs else {}
        
        return DocumentMetadata(
            title=first_meta.get('title') or Path(filename).stem,
            author=first_meta.get('author'),
            source_file=filename,
            file_size=file_size,
            page_count=len(langchain_docs),
            custom={k: v for k, v in first_meta.items() if k not in ['title', 'author', 'source', 'page']}
        )


# Factory for creating LangChain wrappers
def create_langchain_loader(loader_name: str, extensions: List[str]) -> Optional[LangChainLoaderWrapper]:
    """Create a LangChain loader wrapper by name."""
    loader_map = {
        'epub': ('langchain_community.document_loaders', 'UnstructuredEPubLoader'),
        'pptx': ('langchain_community.document_loaders', 'UnstructuredPowerPointLoader'),
        'odt': ('langchain_community.document_loaders', 'UnstructuredODTLoader'),
        'rtf': ('langchain_community.document_loaders', 'UnstructuredRTFLoader'),
        'xml': ('langchain_community.document_loaders', 'UnstructuredXMLLoader'),
        'url': ('langchain_community.document_loaders', 'UnstructuredURLLoader'),
    }
    
    if loader_name not in loader_map:
        logger.warning(f"Unknown LangChain loader: {loader_name}")
        return None
    
    try:
        module_path, class_name = loader_map[loader_name]
        module = __import__(module_path, fromlist=[class_name])
        loader_class = getattr(module, class_name)
        
        return LangChainLoaderWrapper(loader_class, extensions)
    except ImportError as e:
        logger.warning(f"Could not import {loader_name} loader: {e}")
        return None
    except Exception as e:
        logger.error(f"Error creating {loader_name} loader: {e}")
        return None


# Pre-defined LangChain loaders
LANGCHAIN_LOADERS = {
    '.epub': lambda: create_langchain_loader('epub', ['.epub']),
    '.pptx': lambda: create_langchain_loader('pptx', ['.pptx', '.ppt']),
    '.odt': lambda: create_langchain_loader('odt', ['.odt']),
    '.rtf': lambda: create_langchain_loader('rtf', ['.rtf']),
    '.xml': lambda: create_langchain_loader('xml', ['.xml']),
}
