"""Optimized embedding generation service with batch processing and CPU optimization."""

import asyncio
from typing import List, Optional, Callable, AsyncIterator, Dict, Any
from abc import ABC, abstractmethod
from concurrent.futures import ThreadPoolExecutor, as_completed
import time
from functools import partial

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
    """Ollama embedding provider with batch and retry support."""
    
    def __init__(self, model: str = None, base_url: str = None):
        self.model = model or settings.EMBEDDING_MODEL
        self.base_url = base_url or "http://localhost:11434"
        self.max_retries = settings.EMBEDDING_MAX_RETRIES
        self.retry_delay = settings.EMBEDDING_RETRY_DELAY
        
        # CPU optimization: smaller batches for local inference
        self.optimal_batch_size = 8 if settings.EMBEDDING_CPU_OPTIMIZED else 16
    
    def embed(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings using Ollama with retry logic."""
        import ollama
        
        embeddings = []
        for text in texts:
            for attempt in range(self.max_retries):
                try:
                    response = ollama.embeddings(
                        model=self.model,
                        prompt=text[:8192]  # Limit text length
                    )
                    embeddings.append(response["embedding"])
                    break
                except Exception as e:
                    if attempt == self.max_retries - 1:
                        logger.error(f"Ollama embedding failed after {self.max_retries} attempts: {str(e)}")
                        raise EmbeddingError(f"Ollama embedding failed: {str(e)}")
                    logger.warning(f"Retry {attempt + 1}/{self.max_retries} for embedding: {str(e)}")
                    time.sleep(self.retry_delay * (attempt + 1))
        
        return embeddings
    
    def embed_query(self, text: str) -> List[float]:
        """Generate embedding for query."""
        result = self.embed([text[:8192]])
        return result[0]


class OpenAIEmbeddingProvider(EmbeddingProvider):
    """OpenAI embedding provider with batch optimization."""
    
    def __init__(self, model: str = "text-embedding-ada-002"):
        self.model = model
        self.api_key = settings.OPENAI_API_KEY
        self.max_retries = settings.EMBEDDING_MAX_RETRIES
        self.retry_delay = settings.EMBEDDING_RETRY_DELAY
    
    def embed(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings using OpenAI API with retry."""
        if not self.api_key:
            raise EmbeddingError("OpenAI API key not configured")
        
        import openai
        openai.api_key = self.api_key
        
        for attempt in range(self.max_retries):
            try:
                # OpenAI supports batching natively
                response = openai.embeddings.create(
                    input=texts,
                    model=self.model
                )
                return [item.embedding for item in response.data]
            except Exception as e:
                if attempt == self.max_retries - 1:
                    logger.error(f"OpenAI embedding failed: {str(e)}")
                    raise EmbeddingError(f"OpenAI embedding failed: {str(e)}")
                logger.warning(f"Retry {attempt + 1}/{self.max_retries} for OpenAI: {str(e)}")
                time.sleep(self.retry_delay * (attempt + 1))
        
        return []
    
    def embed_query(self, text: str) -> List[float]:
        """Generate embedding for query."""
        result = self.embed([text])
        return result[0]


class EmbeddingServiceOptimized:
    """Optimized embedding service with batch processing and CPU optimization."""
    
    def __init__(self):
        self.provider: EmbeddingProvider = self._create_provider()
        self.batch_size = settings.EMBEDDING_BATCH_SIZE
        self.concurrency = settings.EMBEDDING_CONCURRENCY
        import os
        self.max_workers = min(self.concurrency, (os.cpu_count() or 4))
        
        logger.info(
            f"EmbeddingService initialized: batch_size={self.batch_size}, "
            f"concurrency={self.concurrency}, workers={self.max_workers}"
        )
    
    def _create_provider(self) -> EmbeddingProvider:
        """Create embedding provider based on settings."""
        provider_type = settings.EMBEDDING_PROVIDER.lower()
        
        if provider_type == "ollama":
            return OllamaEmbeddingProvider()
        elif provider_type == "openai":
            return OpenAIEmbeddingProvider()
        else:
            logger.warning(f"Unknown provider {provider_type}, defaulting to Ollama")
            return OllamaEmbeddingProvider()
    
    async def embed_documents(
        self,
        texts: List[str],
        progress_callback: Optional[Callable[[int, int], None]] = None
    ) -> List[List[float]]:
        """
        Generate embeddings with batch processing and concurrency control.
        
        Args:
            texts: List of texts to embed
            progress_callback: Function(current, total) for progress updates
        
        Returns:
            List of embeddings in same order as input texts
        """
        if not texts:
            return []
        
        total_texts = len(texts)
        logger.info(f"Generating embeddings for {total_texts} documents (batch_size={self.batch_size})")
        
        # Create batches
        batches = [
            texts[i:i + self.batch_size]
            for i in range(0, total_texts, self.batch_size)
        ]
        
        all_embeddings: List[Optional[List[float]]] = [None] * total_texts
        completed = 0
        
        # Process batches with controlled concurrency
        semaphore = asyncio.Semaphore(self.concurrency)
        
        async def process_batch(batch_idx: int, batch: List[str]):
            async with semaphore:
                try:
                    # Run embedding in thread pool (CPU-intensive or API call)
                    loop = asyncio.get_event_loop()
                    embeddings = await loop.run_in_executor(
                        None,
                        partial(self.provider.embed, batch)
                    )
                    
                    # Store results in correct positions
                    start_idx = batch_idx * self.batch_size
                    for i, embedding in enumerate(embeddings):
                        if start_idx + i < total_texts:
                            all_embeddings[start_idx + i] = embedding
                    
                    nonlocal completed
                    completed += len(batch)
                    
                    if progress_callback:
                        progress_callback(completed, total_texts)
                    
                    logger.debug(f"Batch {batch_idx + 1}/{len(batches)} completed ({len(batch)} items)")
                    
                except Exception as e:
                    logger.error(f"Batch {batch_idx + 1} failed: {e}")
                    raise
        
        # Process all batches concurrently with semaphore
        tasks = [
            process_batch(i, batch)
            for i, batch in enumerate(batches)
        ]
        
        await asyncio.gather(*tasks)
        
        # Verify all embeddings were generated
        if None in all_embeddings:
            missing = all_embeddings.count(None)
            raise EmbeddingError(f"Failed to generate {missing} embeddings")
        
        logger.info(f"Successfully generated {len(all_embeddings)} embeddings")
        return [e for e in all_embeddings if e is not None]
    
    async def embed_documents_streaming(
        self,
        texts: List[str]
    ) -> AsyncIterator[Dict[str, Any]]:
        """
        Stream embeddings as they are generated.
        
        Yields:
            Dict with 'index', 'text', 'embedding', 'progress'
        """
        total = len(texts)
        completed = 0
        
        semaphore = asyncio.Semaphore(self.concurrency)
        
        async def embed_single(idx: int, text: str) -> Dict[str, Any]:
            async with semaphore:
                loop = asyncio.get_event_loop()
                embedding = await loop.run_in_executor(
                    None,
                    partial(self.provider.embed_query, text)
                )
                return {
                    "index": idx,
                    "text": text,
                    "embedding": embedding,
                }
        
        # Create tasks
        tasks = [embed_single(i, text) for i, text in enumerate(texts)]
        
        # Yield results as they complete
        for future in asyncio.as_completed(tasks):
            result = await future
            completed += 1
            result["progress"] = {
                "completed": completed,
                "total": total,
                "percent": (completed / total) * 100
            }
            yield result
    
    def embed_query(self, text: str) -> List[float]:
        """Generate embedding for query (synchronous)."""
        logger.info(f"Generating embedding for query")
        return self.provider.embed_query(text)
    
    async def embed_query_async(self, text: str) -> List[float]:
        """Generate embedding for query (async)."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self.provider.embed_query, text)
    
    def get_stats(self) -> Dict[str, Any]:
        """Get embedding service configuration stats."""
        return {
            "provider": settings.EMBEDDING_PROVIDER,
            "model": settings.EMBEDDING_MODEL,
            "dimensions": settings.EMBEDDING_DIMENSIONS,
            "batch_size": self.batch_size,
            "concurrency": self.concurrency,
            "max_workers": self.max_workers,
            "cpu_optimized": settings.EMBEDDING_CPU_OPTIMIZED,
        }


# Global optimized service instance
embedding_service_optimized = EmbeddingServiceOptimized()
