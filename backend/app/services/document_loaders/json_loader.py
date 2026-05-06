"""JSON document loader with structure preservation."""

from pathlib import Path
from typing import Union, Optional, List, Dict, Any
import json
import io

from app.services.document_loaders.base import (
    DocumentLoader, DocumentContent, ContentElement,
    ContentType, DocumentMetadata, ElementType
)
from app.core.logging import logger
from app.core.exceptions import DocumentProcessingError


class JSONLoader(DocumentLoader):
    """JSON loader with structured content extraction."""
    
    supported_extensions = [".json", ".jsonl"]
    
    def load(self, file_path: Union[str, Path]) -> DocumentContent:
        """Load JSON from file path."""
        file_path = Path(file_path)
        logger.info(f"Loading JSON: {file_path}")
        
        try:
            with open(file_path, 'rb') as f:
                content = f.read()
            return self.load_from_bytes(content, file_path.name)
        except Exception as e:
            logger.error(f"Failed to load JSON file: {str(e)}")
            raise DocumentProcessingError(f"JSON load failed: {str(e)}")
    
    def load_from_bytes(self, content: bytes, filename: Optional[str] = None) -> DocumentContent:
        """Load JSON from bytes."""
        try:
            text = content.decode('utf-8')
            
            # Check if JSONL (JSON Lines)
            if Path(filename).suffix.lower() == '.jsonl' if filename else False:
                data = self._parse_jsonl(text)
            else:
                data = json.loads(text)
            
            elements = self._parse_json_structure(data)
            
            metadata = DocumentMetadata(
                title=Path(filename).stem if filename else None,
                source_file=filename,
                file_size=len(content),
                custom={
                    "type": type(data).__name__,
                    "is_array": isinstance(data, list),
                    "item_count": len(data) if isinstance(data, list) else None,
                }
            )
            
            # Flatten to text for raw_text
            raw_text = self._flatten_to_text(data)
            metadata.word_count = len(raw_text.split())
            
            doc_content = DocumentContent(
                elements=elements,
                metadata=metadata,
                raw_text=raw_text
            )
            
            logger.info(f"JSON loaded successfully: {len(elements)} elements")
            return doc_content
            
        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error: {str(e)}")
            raise DocumentProcessingError(f"Invalid JSON: {str(e)}")
        except Exception as e:
            logger.error(f"JSON processing failed: {str(e)}")
            raise DocumentProcessingError(f"JSON processing failed: {str(e)}")
    
    def _parse_jsonl(self, text: str) -> List[Dict]:
        """Parse JSON Lines format."""
        lines = text.strip().split('\n')
        return [json.loads(line) for line in lines if line.strip()]
    
    def _parse_json_structure(self, data: Any, path: str = "root") -> List[ContentElement]:
        """Parse JSON structure into content elements."""
        elements = []
        
        if isinstance(data, dict):
            # Object - create structured representation
            summary = f"Object with {len(data)} keys: {', '.join(data.keys())}"
            elements.append(self._create_text_element(summary, ContentType.TEXT))
            
            # Process each key-value pair
            for key, value in data.items():
                current_path = f"{path}.{key}"
                
                if isinstance(value, dict):
                    # Nested object
                    elements.append(self._create_heading_element(f"{key} (Object)", 2))
                    nested = self._parse_json_structure(value, current_path)
                    elements.extend(nested)
                    
                elif isinstance(value, list):
                    # Array
                    elements.append(self._create_heading_element(f"{key} (Array[{len(value)}])", 2))
                    nested = self._parse_json_structure(value, current_path)
                    elements.extend(nested)
                    
                else:
                    # Simple value
                    value_str = str(value) if value is not None else "null"
                    content = f"{key}: {value_str}"
                    
                    # Long text gets paragraph treatment
                    if len(value_str) > 100:
                        elements.append(self._create_text_element(content, ContentType.PARAGRAPH))
                    else:
                        elements.append(ContentElement(
                            type=ContentType.TEXT,
                            content=content,
                            metadata={"key": key, "path": current_path},
                            element_type=ElementType.INLINE
                        ))
                        
        elif isinstance(data, list):
            # Array
            if not data:
                elements.append(self._create_text_element("Empty array []", ContentType.TEXT))
                return elements
            
            # Check if array of objects (common pattern)
            if all(isinstance(item, dict) for item in data[:10]):
                elements.append(self._create_text_element(
                    f"Array of {len(data)} objects",
                    ContentType.TEXT
                ))
                
                # Show first few items
                for i, item in enumerate(data[:5]):
                    item_path = f"{path}[{i}]"
                    elements.append(self._create_heading_element(f"Item {i + 1}", 3))
                    nested = self._parse_json_structure(item, item_path)
                    elements.extend(nested)
                
                if len(data) > 5:
                    elements.append(self._create_text_element(
                        f"... and {len(data) - 5} more items",
                        ContentType.TEXT
                    ))
                    
            # Array of primitives
            elif all(not isinstance(item, (dict, list)) for item in data[:10]):
                elements.append(self._create_list_element(
                    [str(item) for item in data[:20]],
                    False
                ))
                if len(data) > 20:
                    elements.append(self._create_text_element(
                        f"... and {len(data) - 20} more items",
                        ContentType.TEXT
                    ))
                    
            else:
                # Mixed array
                elements.append(self._create_text_element(
                    f"Array with {len(data)} items of various types",
                    ContentType.TEXT
                ))
                for i, item in enumerate(data[:10]):
                    nested = self._parse_json_structure(item, f"{path}[{i}]")
                    elements.extend(nested)
        
        else:
            # Primitive value
            value_str = str(data) if data is not None else "null"
            elements.append(self._create_text_element(value_str, ContentType.TEXT))
        
        return elements
    
    def _flatten_to_text(self, data: Any, indent: int = 0) -> str:
        """Flatten JSON to readable text."""
        lines = []
        prefix = "  " * indent
        
        if isinstance(data, dict):
            for key, value in data.items():
                if isinstance(value, (dict, list)):
                    lines.append(f"{prefix}{key}:")
                    lines.append(self._flatten_to_text(value, indent + 1))
                else:
                    lines.append(f"{prefix}{key}: {value}")
                    
        elif isinstance(data, list):
            for i, item in enumerate(data):
                if isinstance(item, (dict, list)):
                    lines.append(f"{prefix}[{i}]:")
                    lines.append(self._flatten_to_text(item, indent + 1))
                else:
                    lines.append(f"{prefix}- {item}")
        
        else:
            lines.append(f"{prefix}{data}")
        
        return "\n".join(lines)
