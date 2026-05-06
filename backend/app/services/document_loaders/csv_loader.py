"""CSV document loader with table structure support."""

from pathlib import Path
from typing import Union, Optional, List, Dict, Any
import io
import csv

from app.services.document_loaders.base import (
    DocumentLoader, DocumentContent, ContentElement,
    ContentType, DocumentMetadata
)
from app.core.logging import logger
from app.core.exceptions import DocumentProcessingError


class CSVLoader(DocumentLoader):
    """CSV loader with table structure extraction."""
    
    supported_extensions = [".csv", ".tsv"]
    
    def load(self, file_path: Union[str, Path]) -> DocumentContent:
        """Load CSV from file path."""
        file_path = Path(file_path)
        logger.info(f"Loading CSV: {file_path}")
        
        try:
            with open(file_path, 'rb') as f:
                content = f.read()
            return self.load_from_bytes(content, file_path.name)
        except Exception as e:
            logger.error(f"Failed to load CSV file: {str(e)}")
            raise DocumentProcessingError(f"CSV load failed: {str(e)}")
    
    def load_from_bytes(self, content: bytes, filename: Optional[str] = None) -> DocumentContent:
        """Load CSV from bytes."""
        try:
            # Detect delimiter
            sample = content[:2048].decode('utf-8', errors='ignore')
            delimiter = self._detect_delimiter(sample)
            
            # Decode content
            try:
                text = content.decode('utf-8')
            except UnicodeDecodeError:
                text = content.decode('latin-1')
            
            # Parse CSV
            rows, headers = self._parse_csv(text, delimiter)
            
            # Create elements
            elements = []
            
            # Summary element
            summary = f"CSV file with {len(rows)} rows and {len(headers)} columns"
            elements.append(self._create_text_element(summary, ContentType.TEXT))
            
            # Column headers as list
            elements.append(self._create_text_element(
                f"Columns: {', '.join(headers)}",
                ContentType.TEXT
            ))
            
            # Table element
            if rows:
                table = self._create_table_element(rows, headers)
                table.metadata.update({
                    "delimiter": delimiter,
                    "row_count": len(rows),
                    "col_count": len(headers),
                })
                elements.append(table)
            
            # Summary statistics
            stats = self._calculate_stats(rows, headers)
            if stats:
                elements.append(self._create_text_element(
                    f"Statistics: {stats}",
                    ContentType.TEXT
                ))
            
            metadata = DocumentMetadata(
                title=Path(filename).stem if filename else None,
                source_file=filename,
                file_size=len(content),
                word_count=len(text.split()),
                custom={
                    "delimiter": delimiter,
                    "columns": headers,
                    "row_count": len(rows),
                }
            )
            
            raw_text = self._format_as_text(rows, headers)
            
            doc_content = DocumentContent(
                elements=elements,
                metadata=metadata,
                raw_text=raw_text
            )
            
            logger.info(f"CSV loaded successfully: {len(rows)} rows, {len(headers)} cols")
            return doc_content
            
        except Exception as e:
            logger.error(f"CSV processing failed: {str(e)}")
            raise DocumentProcessingError(f"CSV processing failed: {str(e)}")
    
    def _detect_delimiter(self, sample: str) -> str:
        """Detect CSV delimiter from sample."""
        delimiters = [',', '\t', ';', '|']
        counts = {d: sample.count(d) for d in delimiters}
        return max(counts, key=counts.get) if max(counts.values()) > 0 else ','
    
    def _parse_csv(self, text: str, delimiter: str) -> tuple:
        """Parse CSV text into rows and headers."""
        reader = csv.reader(io.StringIO(text), delimiter=delimiter)
        rows = list(reader)
        
        if not rows:
            return [], []
        
        headers = rows[0]
        data_rows = rows[1:]
        
        return data_rows, headers
    
    def _calculate_stats(self, rows: List[List[str]], headers: List[str]) -> str:
        """Calculate basic statistics for numeric columns."""
        if not rows or not headers:
            return ""
        
        stats_parts = []
        
        for col_idx, header in enumerate(headers):
            values = []
            for row in rows:
                if col_idx < len(row):
                    try:
                        val = float(row[col_idx].replace(',', ''))
                        values.append(val)
                    except (ValueError, TypeError):
                        pass
            
            if values:
                avg = sum(values) / len(values)
                stats_parts.append(f"{header}: avg={avg:.2f}")
        
        return ", ".join(stats_parts[:3])  # Limit to first 3 numeric columns
    
    def _format_as_text(self, rows: List[List[str]], headers: List[str]) -> str:
        """Format CSV as readable text."""
        lines = [" | ".join(headers), "-" * (len(" | ".join(headers)))]
        
        for row in rows[:100]:  # Limit to first 100 rows for text
            lines.append(" | ".join(row))
        
        if len(rows) > 100:
            lines.append(f"... ({len(rows) - 100} more rows)")
        
        return "\n".join(lines)
