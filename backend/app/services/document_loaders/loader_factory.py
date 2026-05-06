"""Document loader factory for getting appropriate loader."""

from pathlib import Path
from typing import Union, Optional

from app.services.document_loaders.base import DocumentLoader, DocumentContent
from app.services.document_loaders.pdf_loader import PDFLoader
from app.services.document_loaders.docx_loader import DOCXLoader
from app.services.document_loaders.text_loader import TextLoader
from app.services.document_loaders.markdown_loader import MarkdownLoader
from app.services.document_loaders.html_loader import HTMLLoader
from app.services.document_loaders.csv_loader import CSVLoader
from app.services.document_loaders.json_loader import JSONLoader
from app.services.document_loaders.langchain_loader import LANGCHAIN_LOADERS, create_langchain_loader
from app.core.logging import logger
from app.core.exceptions import DocumentProcessingError


# Registry of loaders (custom loaders first)
LOADERS = [
    PDFLoader(),
    DOCXLoader(),
    TextLoader(),
    MarkdownLoader(),
    HTMLLoader(),
    CSVLoader(),
    JSONLoader(),
]

# Extension to loader mapping (custom loaders)
EXTENSION_MAP = {}
for loader in LOADERS:
    for ext in loader.supported_extensions:
        EXTENSION_MAP[ext.lower()] = loader

# Lazy-loaded LangChain extensions
_LANGCHAIN_EXTENSION_MAP = {}

def _get_langchain_loader(ext: str) -> Optional[DocumentLoader]:
    """Get LangChain loader for extension (lazy loading)."""
    global _LANGCHAIN_EXTENSION_MAP
    
    # Check if already loaded
    if ext in _LANGCHAIN_EXTENSION_MAP:
        return _LANGCHAIN_EXTENSION_MAP[ext]
    
    # Try to create from LANGCHAIN_LOADERS
    if ext in LANGCHAIN_LOADERS:
        try:
            loader = LANGCHAIN_LOADERS[ext]()
            if loader:
                _LANGCHAIN_EXTENSION_MAP[ext] = loader
                return loader
        except Exception as e:
            logger.debug(f"Failed to load LangChain loader for {ext}: {e}")
    
    return None


def get_loader_for_file(file_path: Union[str, Path]) -> Optional[DocumentLoader]:
    """Get appropriate loader for file based on extension.
    
    Priority: 1) Custom loaders, 2) LangChain fallback loaders
    """
    ext = Path(file_path).suffix.lower()
    
    # Try custom loaders first
    if ext in EXTENSION_MAP:
        return EXTENSION_MAP[ext]
    
    # Try LangChain fallback
    return _get_langchain_loader(ext)


def load_document(file_path: Union[str, Path]) -> DocumentContent:
    """Load document using appropriate loader (custom or LangChain fallback)."""
    file_path = Path(file_path)
    
    if not file_path.exists():
        raise DocumentProcessingError(f"File not found: {file_path}")
    
    loader = get_loader_for_file(file_path)
    
    if not loader:
        all_supported = get_all_supported_extensions()
        raise DocumentProcessingError(
            f"Unsupported file type: {file_path.suffix}. "
            f"Supported: {', '.join(sorted(set(all_supported)))}"
        )
    
    loader_name = loader.__class__.__name__
    logger.info(f"Using {loader_name} for {file_path}")
    return loader.load(file_path)


def load_document_from_bytes(
    content: bytes,
    filename: str,
    file_type: Optional[str] = None
) -> DocumentContent:
    """Load document from bytes (custom or LangChain fallback)."""
    # Determine loader from filename or explicit type
    if file_type:
        ext = f".{file_type.lower()}"
    else:
        ext = Path(filename).suffix.lower()
    
    # Try custom loaders first
    loader = EXTENSION_MAP.get(ext)
    
    # Try LangChain fallback
    if not loader:
        loader = _get_langchain_loader(ext)
    
    if not loader:
        all_supported = get_all_supported_extensions()
        raise DocumentProcessingError(
            f"Unsupported file type: {ext}. "
            f"Supported: {', '.join(sorted(set(all_supported)))}"
        )
    
    logger.info(f"Using {loader.__class__.__name__} for {filename}")
    return loader.load_from_bytes(content, filename)


def get_supported_extensions() -> list:
    """Get list of supported file extensions (custom loaders only)."""
    return list(EXTENSION_MAP.keys())


def get_langchain_extensions() -> list:
    """Get list of LangChain-supported extensions."""
    return list(LANGCHAIN_LOADERS.keys())


def get_all_supported_extensions() -> list:
    """Get all supported extensions (custom + LangChain)."""
    all_exts = set(EXTENSION_MAP.keys())
    all_exts.update(LANGCHAIN_LOADERS.keys())
    return list(all_exts)


def can_load_file(file_path: Union[str, Path]) -> bool:
    """Check if file can be loaded (custom or LangChain)."""
    ext = Path(file_path).suffix.lower()
    
    # Check custom loaders
    if ext in EXTENSION_MAP:
        return True
    
    # Check LangChain availability
    if ext in LANGCHAIN_LOADERS:
        # Try to load it (will cache if successful)
        loader = _get_langchain_loader(ext)
        return loader is not None
    
    return False
