"""Custom application exceptions."""

from typing import Any, Dict, Optional


class RAGSystemException(Exception):
    """Base exception for RAG System."""
    
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        self.message = message
        self.details = details or {}
        super().__init__(self.message)


class DocumentProcessingError(RAGSystemException):
    """Raised when document processing fails."""
    pass


class VectorDBError(RAGSystemException):
    """Raised when vector database operation fails."""
    pass


class LLMError(RAGSystemException):
    """Raised when LLM operation fails."""
    pass


class EmbeddingError(RAGSystemException):
    """Raised when embedding generation fails."""
    pass


class ConfigurationError(RAGSystemException):
    """Raised when configuration is invalid."""
    pass


class FileUploadError(RAGSystemException):
    """Raised when file upload fails."""
    pass


class NotFoundError(RAGSystemException):
    """Raised when resource is not found."""
    pass
