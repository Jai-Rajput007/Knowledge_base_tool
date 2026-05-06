"""Document ingestion pipeline with progress tracking and async processing."""

import os
import asyncio
from pathlib import Path
from typing import Optional, Callable, Dict, Any, List
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
import uuid

from sqlalchemy.orm import Session

from app.db.database import SessionLocal
from app.models.document import Document, DocumentStatus
from app.models.activity import Activity, ActivityType
from app.services.document_loaders.loader_factory import load_document_from_bytes
from app.services.document_loaders.base import DocumentContent
from app.services.embedding_service_optimized import embedding_service_optimized
from app.services.vector_db_service import vector_db_service
from app.services.structure_aware_chunker import StructureAwareChunker, DocumentChunk
from app.core.config import settings
from app.core.logging import logger
from app.core.exceptions import DocumentProcessingError


class IngestionStage(Enum):
    """Stages of document ingestion."""
    UPLOADED = "uploaded"
    EXTRACTING = "extracting"
    CHUNKING = "chunking"
    EMBEDDING = "embedding"
    INDEXING = "indexing"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class IngestionProgress:
    """Track ingestion progress."""
    document_id: int
    stage: IngestionStage
    progress_percent: float
    message: str
    details: Dict[str, Any] = field(default_factory=dict)
    error: Optional[str] = None
    started_at: datetime = field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "document_id": self.document_id,
            "stage": self.stage.value,
            "progress_percent": self.progress_percent,
            "message": self.message,
            "details": self.details,
            "error": self.error,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
        }


# Global progress tracking
_progress_callbacks: Dict[int, List[Callable[[IngestionProgress], None]]] = {}
_current_progress: Dict[int, IngestionProgress] = {}


def register_progress_callback(document_id: int, callback: Callable[[IngestionProgress], None]):
    """Register callback for progress updates."""
    if document_id not in _progress_callbacks:
        _progress_callbacks[document_id] = []
    _progress_callbacks[document_id].append(callback)


def unregister_progress_callback(document_id: int, callback: Callable[[IngestionProgress], None]):
    """Unregister progress callback."""
    if document_id in _progress_callbacks:
        if callback in _progress_callbacks[document_id]:
            _progress_callbacks[document_id].remove(callback)


def _update_progress(progress: IngestionProgress):
    """Update progress and notify callbacks."""
    _current_progress[progress.document_id] = progress
    
    # Notify callbacks
    callbacks = _progress_callbacks.get(progress.document_id, [])
    for callback in callbacks:
        try:
            callback(progress)
        except Exception as e:
            logger.error(f"Progress callback error: {e}")
    
    # Log progress
    logger.info(f"Doc {progress.document_id}: {progress.stage.value} - {progress.progress_percent}%")


def get_progress(document_id: int) -> Optional[IngestionProgress]:
    """Get current progress for document."""
    return _current_progress.get(document_id)


class IngestionPipeline:
    """Document ingestion pipeline with structure-aware chunking."""
    
    def __init__(self):
        self.embedding_service = embedding_service_optimized
        self.vector_db = vector_db_service
        self.chunker = StructureAwareChunker(
            chunk_size=settings.CHUNK_SIZE,
            chunk_overlap=settings.CHUNK_OVERLAP,
            preserve_structure=True,
            respect_boundaries=True,
        )
    
    async def process_document(
        self,
        document_id: int,
        file_content: bytes,
        filename: str,
        file_type: str,
        db: Session
    ) -> bool:
        """
        Process document through full ingestion pipeline with structure-aware chunking.
        
        Stages:
        1. Extract content and structure from document
        2. Structure-aware chunking with hierarchy preservation
        3. Generate embeddings for chunks
        4. Store in vector database with rich metadata
        5. Update document status
        """
        progress = IngestionProgress(
            document_id=document_id,
            stage=IngestionStage.UPLOADED,
            progress_percent=0,
            message="Starting ingestion..."
        )
        
        try:
            # Stage 1: Extract content with structure
            doc_content = await self._extract_content(progress, file_content, filename, file_type)
            
            # Stage 2: Structure-aware chunking with streaming
            chunks = await self._chunk_with_structure(progress, doc_content)
            
            if not chunks:
                raise DocumentProcessingError("No text chunks generated")
            
            # Stage 3: Generate embeddings
            chunk_texts = [chunk.content for chunk in chunks]
            embeddings = await self._generate_embeddings(progress, chunk_texts)
            
            # Stage 4: Index in vector DB with rich metadata
            await self._index_document_with_metadata(progress, document_id, chunks, embeddings)
            
            # Stage 5: Update document status
            await self._finalize_document(progress, document_id, len(chunks), db)
            
            return True
            
        except Exception as e:
            logger.error(f"Ingestion failed for doc {document_id}: {e}")
            await self._handle_failure(progress, document_id, str(e), db)
            return False
    
    async def _extract_content(
        self,
        progress: IngestionProgress,
        file_content: bytes,
        filename: str,
        file_type: str
    ) -> DocumentContent:
        """Extract content and structure from document."""
        progress.stage = IngestionStage.EXTRACTING
        progress.progress_percent = 10
        progress.message = "Extracting document content and structure..."
        _update_progress(progress)
        
        # Run extraction in thread pool
        loop = asyncio.get_event_loop()
        doc_content = await loop.run_in_executor(
            None,
            lambda: load_document_from_bytes(file_content, filename, file_type)
        )
        
        full_text = doc_content.to_text()
        
        # Build rich metadata
        headings = doc_content.get_headings()
        heading_hierarchy = [
            {"level": h.level or 1, "text": h.to_text()}
            for h in headings[:20]  # Limit to first 20 headings
        ]
        
        progress.details.update({
            "content": full_text,
            "elements_count": len(doc_content.elements),
            "headings": [h.to_text() for h in headings[:10]],
            "heading_hierarchy": heading_hierarchy,
            "tables_count": len(doc_content.get_tables()),
            "images_count": len(doc_content.get_images()),
            "lists_count": len(doc_content.get_lists()),
            "metadata": {
                "title": doc_content.metadata.title,
                "author": doc_content.metadata.author,
                "page_count": doc_content.metadata.page_count,
                "word_count": doc_content.metadata.word_count,
            }
        })
        
        progress.progress_percent = 25
        progress.message = f"Extracted {len(full_text)} chars, {len(doc_content.elements)} elements, {len(headings)} headings"
        _update_progress(progress)
        
        return doc_content
    
    async def _chunk_with_structure(
        self,
        progress: IngestionProgress,
        doc_content: DocumentContent
    ) -> List[DocumentChunk]:
        """Chunk document with structure awareness and streaming progress."""
        progress.stage = IngestionStage.CHUNKING
        progress.progress_percent = 30
        progress.message = "Structure-aware chunking with hierarchy preservation..."
        _update_progress(progress)
        
        chunks = []
        chunk_count = 0
        
        # Define progress callback for streaming
        def on_chunking_progress(current: int, total: int, status: str):
            # Map element progress to overall progress (30-40%)
            percent = 30 + (current / max(total, 1)) * 10
            progress.progress_percent = min(percent, 40)
            progress.message = f"{status} ({chunk_count} chunks created)"
            _update_progress(progress)
        
        # Stream chunks
        async for chunk in self.chunker.chunk_document_streaming(
            doc_content,
            progress_callback=on_chunking_progress
        ):
            chunks.append(chunk)
            chunk_count += 1
        
        # Update chunk indices and totals
        total = len(chunks)
        for i, chunk in enumerate(chunks):
            chunk.metadata.chunk_index = i
            chunk.metadata.total_chunks = total
        
        # Collect structure stats
        tables_preserved = sum(1 for c in chunks if c.metadata.contains_table)
        lists_preserved = sum(1 for c in chunks if c.metadata.contains_list)
        code_preserved = sum(1 for c in chunks if c.metadata.contains_code)
        
        progress.details.update({
            "chunks_count": len(chunks),
            "tables_preserved": tables_preserved,
            "lists_preserved": lists_preserved,
            "code_blocks_preserved": code_preserved,
            "avg_chunk_size": sum(len(c.content) for c in chunks) // max(len(chunks), 1),
            "heading_context_preserved": all(len(c.metadata.headings_hierarchy) > 0 for c in chunks),
        })
        
        progress.progress_percent = 40
        progress.message = f"Created {len(chunks)} structure-aware chunks"
        _update_progress(progress)
        
        return chunks
    
    async def _generate_embeddings(
        self,
        progress: IngestionStage,
        chunk_texts: List[str]
    ) -> List[List[float]]:
        """Generate embeddings with batch processing and progress tracking."""
        progress.stage = IngestionStage.EMBEDDING
        progress.progress_percent = 45
        progress.message = f"Generating embeddings for {len(chunk_texts)} chunks (batch optimized)..."
        _update_progress(progress)
        
        # Progress callback for embedding generation
        def on_embed_progress(completed: int, total: int):
            # Map to progress range 45-70%
            percent = 45 + (completed / total) * 25
            progress.progress_percent = min(percent, 70)
            progress.message = f"Generated {completed}/{total} embeddings..."
            _update_progress(progress)
        
        # Use optimized embedding service with batching and concurrency
        embeddings = await embedding_service_optimized.embed_documents(
            chunk_texts,
            progress_callback=on_embed_progress
        )
        
        # Add embedding stats
        stats = embedding_service_optimized.get_stats()
        progress.details.update({
            "embeddings_count": len(embeddings),
            "embedding_provider": stats["provider"],
            "embedding_model": stats["model"],
            "batch_size_used": stats["batch_size"],
            "concurrency_used": stats["concurrency"],
            "cpu_optimized": stats["cpu_optimized"],
        })
        
        progress.progress_percent = 70
        progress.message = f"Generated {len(embeddings)} embeddings (batch_size={stats['batch_size']}, concurrency={stats['concurrency']})"
        _update_progress(progress)
        
        return embeddings
    
    async def _index_document_with_metadata(
        self,
        progress: IngestionProgress,
        document_id: int,
        chunks: List[DocumentChunk],
        embeddings: List[List[float]],
    ) -> None:
        """Index document in vector database with rich metadata."""
        progress.stage = IngestionStage.INDEXING
        progress.progress_percent = 75
        progress.message = "Indexing in vector database with rich metadata..."
        _update_progress(progress)
        
        # Prepare chunks and metadata
        chunk_texts = [chunk.content for chunk in chunks]
        
        # Build rich metadata for each chunk
        chunk_metadata = []
        for chunk in chunks:
            meta = chunk.metadata.to_dict()
            meta.update({
                "document_id": document_id,
                "chunk_id": f"{document_id}_{chunk.metadata.chunk_index}",
            })
            chunk_metadata.append(meta)
        
        # Add to vector DB
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            lambda: self.vector_db.add_documents(
                document_id=str(document_id),
                chunks=chunk_texts,
                embeddings=embeddings,
                metadata={
                    "source_file": chunks[0].metadata.filename if chunks else "",
                    "document_id": document_id,
                    "chunks_metadata": chunk_metadata,
                }
            )
        )
        
        progress.details.update({
            "indexed_chunks": len(chunks),
            "rich_metadata_applied": True,
        })
        
        progress.progress_percent = 95
        progress.message = "Indexing complete with rich metadata"
        _update_progress(progress)
    
    async def _finalize_document(
        self,
        progress: IngestionProgress,
        document_id: int,
        chunks_count: int,
        db: Session
    ) -> None:
        """Finalize document processing."""
        # Update document record
        document = db.query(Document).filter(Document.id == document_id).first()
        if document:
            document.status = DocumentStatus.INDEXED
            document.chunks_count = chunks_count
            document.indexed_at = datetime.utcnow()
            db.commit()
        
        # Log activity
        activity = Activity(
            action="Document indexed",
            target=document.name if document else f"Document {document_id}",
            target_type="document",
            target_id=document_id,
            activity_type=ActivityType.SUCCESS,
            details={
                "chunks_count": chunks_count,
                "document_id": document_id,
            }
        )
        db.add(activity)
        db.commit()
        
        progress.stage = IngestionStage.COMPLETED
        progress.progress_percent = 100
        progress.message = "Ingestion complete"
        progress.completed_at = datetime.utcnow()
        _update_progress(progress)
        
        logger.info(f"Document {document_id} ingestion completed")
    
    async def _handle_failure(
        self,
        progress: IngestionProgress,
        document_id: int,
        error: str,
        db: Session
    ) -> None:
        """Handle ingestion failure."""
        progress.stage = IngestionStage.FAILED
        progress.error = error
        progress.message = f"Ingestion failed: {error}"
        progress.completed_at = datetime.utcnow()
        _update_progress(progress)
        
        # Update document status
        document = db.query(Document).filter(Document.id == document_id).first()
        if document:
            document.status = DocumentStatus.ERROR
            document.error_message = error
            db.commit()
        
        # Log activity
        activity = Activity(
            action="Document ingestion failed",
            target=document.name if document else f"Document {document_id}",
            target_type="document",
            target_id=document_id,
            activity_type=ActivityType.ERROR,
            details={"error": error}
        )
        db.add(activity)
        db.commit()


# Global pipeline instance
ingestion_pipeline = IngestionPipeline()


async def process_document_async(
    document_id: int,
    file_content: bytes,
    filename: str,
    file_type: str
) -> bool:
    """Process document asynchronously."""
    db = SessionLocal()
    try:
        return await ingestion_pipeline.process_document(
            document_id, file_content, filename, file_type, db
        )
    finally:
        db.close()
