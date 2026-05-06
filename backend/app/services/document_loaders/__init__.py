"""Document loaders package for comprehensive document processing."""

from app.services.document_loaders.base import DocumentLoader, DocumentContent, ContentElement
from app.services.document_loaders.pdf_loader import PDFLoader
from app.services.document_loaders.docx_loader import DOCXLoader
from app.services.document_loaders.text_loader import TextLoader
from app.services.document_loaders.markdown_loader import MarkdownLoader
from app.services.document_loaders.html_loader import HTMLLoader
from app.services.document_loaders.csv_loader import CSVLoader
from app.services.document_loaders.json_loader import JSONLoader
from app.services.document_loaders.langchain_loader import LangChainLoaderWrapper, LANGCHAIN_LOADERS
from app.services.document_loaders.loader_factory import (
    get_loader_for_file,
    get_supported_extensions,
    get_langchain_extensions,
    get_all_supported_extensions,
    can_load_file,
)

__all__ = [
    "DocumentLoader",
    "DocumentContent",
    "ContentElement",
    "PDFLoader",
    "DOCXLoader",
    "TextLoader",
    "MarkdownLoader",
    "HTMLLoader",
    "CSVLoader",
    "JSONLoader",
    "LangChainLoaderWrapper",
    "LANGCHAIN_LOADERS",
    "get_loader_for_file",
    "get_supported_extensions",
    "get_langchain_extensions",
    "get_all_supported_extensions",
    "can_load_file",
]
