"""HTML document loader with support for structured content extraction."""

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


class HTMLLoader(DocumentLoader):
    """HTML loader with content structure extraction."""
    
    supported_extensions = [".html", ".htm"]
    
    def load(self, file_path: Union[str, Path]) -> DocumentContent:
        """Load HTML from file path."""
        file_path = Path(file_path)
        logger.info(f"Loading HTML: {file_path}")
        
        try:
            with open(file_path, 'rb') as f:
                content = f.read()
            return self.load_from_bytes(content, file_path.name)
        except Exception as e:
            logger.error(f"Failed to load HTML file: {str(e)}")
            raise DocumentProcessingError(f"HTML load failed: {str(e)}")
    
    def load_from_bytes(self, content: bytes, filename: Optional[str] = None) -> DocumentContent:
        """Load HTML from bytes."""
        try:
            text = content.decode('utf-8')
            
            try:
                from bs4 import BeautifulSoup
                elements, metadata = self._parse_with_bs4(text, filename, len(content))
            except ImportError:
                logger.warning("BeautifulSoup not installed, using regex fallback")
                elements, metadata = self._parse_fallback(text, filename, len(content))
            
            raw_text = self._extract_text_only(text)
            
            doc_content = DocumentContent(
                elements=elements,
                metadata=metadata,
                raw_text=raw_text
            )
            
            logger.info(f"HTML loaded successfully: {len(elements)} elements")
            return doc_content
            
        except Exception as e:
            logger.error(f"HTML processing failed: {str(e)}")
            raise DocumentProcessingError(f"HTML processing failed: {str(e)}")
    
    def _parse_with_bs4(self, text: str, filename: Optional[str], file_size: int) -> tuple:
        """Parse HTML with BeautifulSoup."""
        from bs4 import BeautifulSoup, NavigableString
        
        soup = BeautifulSoup(text, 'html.parser')
        elements = []
        
        # Extract metadata
        title = None
        title_tag = soup.find('title')
        if title_tag:
            title = title_tag.get_text(strip=True)
        
        if not title:
            h1 = soup.find('h1')
            if h1:
                title = h1.get_text(strip=True)
        
        # Remove script and style elements
        for script in soup(['script', 'style', 'nav', 'footer', 'header']):
            script.decompose()
        
        # Process body content
        body = soup.find('body') or soup
        
        for elem in body.descendants:
            if isinstance(elem, NavigableString):
                continue
            
            tag_name = elem.name
            if not tag_name:
                continue
            
            # Headings
            if tag_name in ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']:
                level = int(tag_name[1])
                text = elem.get_text(strip=True)
                if text:
                    elements.append(self._create_heading_element(text, level))
            
            # Paragraph
            elif tag_name == 'p':
                text = elem.get_text(strip=True)
                if text:
                    elements.append(self._create_text_element(text, ContentType.PARAGRAPH))
            
            # Lists
            elif tag_name in ['ul', 'ol']:
                items = []
                for li in elem.find_all('li', recursive=False):
                    item_text = li.get_text(strip=True)
                    if item_text:
                        items.append(item_text)
                if items:
                    elements.append(self._create_list_element(items, tag_name == 'ol'))
            
            # Table
            elif tag_name == 'table':
                table = self._parse_table(elem)
                if table:
                    elements.append(table)
            
            # Code block
            elif tag_name in ['pre', 'code']:
                text = elem.get_text(strip=True)
                if text and len(text) > 50:  # Likely a code block
                    elements.append(ContentElement(
                        type=ContentType.CODE_BLOCK,
                        content=text,
                        metadata={"language": elem.get('class', [''])[0] if elem.get('class') else ''}
                    ))
            
            # Quote
            elif tag_name in ['blockquote', 'q']:
                text = elem.get_text(strip=True)
                if text:
                    elements.append(ContentElement(
                        type=ContentType.QUOTE,
                        content=text
                    ))
            
            # Image
            elif tag_name == 'img':
                alt = elem.get('alt', '')
                src = elem.get('src', '')
                width = elem.get('width')
                height = elem.get('height')
                elements.append(self._create_image_element(
                    alt, src,
                    int(width) if width and width.isdigit() else None,
                    int(height) if height and height.isdigit() else None
                ))
        
        metadata = DocumentMetadata(
            title=title,
            source_file=filename,
            file_size=file_size,
            word_count=len(self._extract_text_only(text).split())
        )
        
        return elements, metadata
    
    def _parse_fallback(self, text: str, filename: Optional[str], file_size: int) -> tuple:
        """Parse HTML with regex fallback."""
        elements = []
        
        # Extract title
        title_match = re.search(r'<title[^>]*>(.*?)</title>', text, re.DOTALL | re.IGNORECASE)
        title = title_match.group(1).strip() if title_match else None
        
        # Remove script/style content
        text = re.sub(r'<script[^>]*>.*?</script>', '', text, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL | re.IGNORECASE)
        
        # Extract headings
        for level in range(1, 7):
            pattern = rf'<h{level}[^>]*>(.*?)</h{level}>'
            for match in re.finditer(pattern, text, re.DOTALL | re.IGNORECASE):
                content = re.sub(r'<[^>]+>', '', match.group(1)).strip()
                if content:
                    elements.append(self._create_heading_element(content, level))
        
        # Extract paragraphs
        for match in re.finditer(r'<p[^>]*>(.*?)</p>', text, re.DOTALL | re.IGNORECASE):
            content = re.sub(r'<[^>]+>', '', match.group(1)).strip()
            if content:
                elements.append(self._create_text_element(content, ContentType.PARAGRAPH))
        
        # Extract lists (simplified)
        for match in re.finditer(r'<li[^>]*>(.*?)</li>', text, re.DOTALL | re.IGNORECASE):
            content = re.sub(r'<[^>]+>', '', match.group(1)).strip()
            if content:
                elements.append(ContentElement(
                    type=ContentType.LIST_ITEM,
                    content=content,
                    element_type=ElementType.INLINE
                ))
        
        metadata = DocumentMetadata(
            title=title,
            source_file=filename,
            file_size=file_size,
            word_count=len(self._extract_text_only(text).split())
        )
        
        return elements, metadata
    
    def _parse_table(self, table_elem) -> Optional[ContentElement]:
        """Parse HTML table element."""
        rows = []
        headers = None
        
        # Try to find header row
        thead = table_elem.find('thead')
        if thead:
            header_row = thead.find('tr')
            if header_row:
                headers = [th.get_text(strip=True) for th in header_row.find_all(['th', 'td'])]
        
        # Get body rows
        tbody = table_elem.find('tbody') or table_elem
        for tr in tbody.find_all('tr'):
            cells = [td.get_text(strip=True) for td in tr.find_all(['td', 'th'])]
            if cells:
                if headers is None and tr.find('th'):
                    headers = cells
                else:
                    rows.append(cells)
        
        if rows or headers:
            return self._create_table_element(rows, headers)
        return None
    
    def _extract_text_only(self, html: str) -> str:
        """Extract plain text from HTML."""
        try:
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(html, 'html.parser')
            # Remove script/style
            for script in soup(['script', 'style']):
                script.decompose()
            return soup.get_text(separator='\n', strip=True)
        except ImportError:
            # Fallback: strip tags
            text = re.sub(r'<[^>]+>', ' ', html)
            return re.sub(r'\s+', ' ', text).strip()
