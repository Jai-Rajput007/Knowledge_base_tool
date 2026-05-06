"""Embedding generation service."""

from typing import List
from abc import ABC, abstractmethod

from app.core.config import settings
from app.core.logging import logger
from app.core.exceptions import EmbeddingError


class EmbeddingProvider(ABC):
    """Abstract base class for embedding providers."""
    
    @abstractmethod
    def embed(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for texts."""
        pass
    
    @abstractmethod
    def embed_query(self, text: str) -> List[float]:
        """Generate embedding for a single query."""
        pass


class OllamaEmbeddingProvider(EmbeddingProvider):
    """Ollama embedding provider."""
    
    def __init__(self, model: str = None):
        self.model = model or settings.EMBEDDING_MODEL
        self.base_url = "http://localhost:11434"
    
    def embed(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings using Ollama."""
        try:
            import ollama
            
            embeddings = []
            for text in texts:
                response = ollama.embeddings(model=self.model, prompt=text)
                embeddings.append(response["embedding"])
            
            return embeddings
        except Exception as e:
            logger.error(f"Ollama embedding failed: {str(e)}")
            raise EmbeddingError(f"Ollama embedding failed: {str(e)}")
    
    def embed_query(self, text: str) -> List[float]:
        """Generate embedding for query."""
        try:
            import ollama
            response = ollama.embeddings(model=self.model, prompt=text)
            return response["embedding"]
        except Exception as e:
            logger.error(f"Ollama query embedding failed: {str(e)}")
            raise EmbeddingError(f"Ollama query embedding failed: {str(e)}")


class OpenAIEmbeddingProvider(EmbeddingProvider):
    """OpenAI embedding provider."""
    
    def __init__(self, model: str = "text-embedding-ada-002"):
        self.model = model
        self.api_key = settings.OPENAI_API_KEY
    
    def embed(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings using OpenAI."""
        if not self.api_key:
            raise EmbeddingError("OpenAI API key not configured")
        
        try:
            import openai
            openai.api_key = self.api_key
            
            response = openai.Embedding.create(input=texts, model=self.model)
            return [item["embedding"] for item in response["data"]]
        except Exception as e:
            logger.error(f"OpenAI embedding failed: {str(e)}")
            raise EmbeddingError(f"OpenAI embedding failed: {str(e)}")
    
    def embed_query(self, text: str) -> List[float]:
        """Generate embedding for query."""
        result = self.embed([text])
        return result[0]


class CohereEmbeddingProvider(EmbeddingProvider):
    """Cohere embedding provider."""
    
    def __init__(self, model: str = "embed-english-v3"):
        self.model = model
        self.api_key = settings.COHERE_API_KEY
    
    def embed(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings using Cohere."""
        if not self.api_key:
            raise EmbeddingError("Cohere API key not configured")
        
        try:
            import cohere
            client = cohere.Client(self.api_key)
            response = client.embed(texts=texts, model=self.model)
            return response.embeddings
        except Exception as e:
            logger.error(f"Cohere embedding failed: {str(e)}")
            raise EmbeddingError(f"Cohere embedding failed: {str(e)}")
    
    def embed_query(self, text: str) -> List[float]:
        """Generate embedding for query."""
        result = self.embed([text])
        return result[0]


class EmbeddingService:
    """Main embedding service."""
    
    def __init__(self):
        self.provider: EmbeddingProvider = self._create_provider()
    
    def _create_provider(self) -> EmbeddingProvider:
        """Create embedding provider based on settings."""
        provider_type = settings.EMBEDDING_PROVIDER.lower()
        
        if provider_type == "ollama":
            return OllamaEmbeddingProvider()
        elif provider_type == "openai":
            return OpenAIEmbeddingProvider()
        elif provider_type == "cohere":
            return CohereEmbeddingProvider()
        else:
            logger.warning(f"Unknown provider {provider_type}, defaulting to Ollama")
            return OllamaEmbeddingProvider()
    
    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for documents."""
        if not texts:
            return []
        
        logger.info(f"Generating embeddings for {len(texts)} documents")
        
        # Process in batches
        batch_size = settings.BATCH_SIZE
        all_embeddings = []
        
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            batch_embeddings = self.provider.embed(batch)
            all_embeddings.extend(batch_embeddings)
            logger.debug(f"Processed batch {i//batch_size + 1}/{(len(texts) + batch_size - 1)//batch_size}")
        
        return all_embeddings
    
    def embed_query(self, text: str) -> List[float]:
        """Generate embedding for query."""
        logger.info(f"Generating embedding for query")
        return self.provider.embed_query(text)


# Global service instance
embedding_service = EmbeddingService()
