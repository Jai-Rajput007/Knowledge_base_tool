"""Vector database service using ChromaDB (persistent local storage)."""

import json
from typing import List, Optional, Dict, Any

import chromadb
from chromadb.config import Settings as ChromaSettings

from app.core.config import settings
from app.core.logging import logger
from app.core.exceptions import VectorDBError

CHROMA_PERSIST_DIR = "./chroma_db"
COLLECTION_NAME = "documents"


def _serialize_metadata(meta: Dict[str, Any]) -> Dict[str, Any]:
    """Flatten metadata to ChromaDB-compatible types (str/int/float/bool only)."""
    result = {}
    for k, v in meta.items():
        if v is None:
            continue
        if isinstance(v, (str, int, float, bool)):
            result[k] = v
        else:
            result[k] = json.dumps(v)
    return result


def _build_where(filter_dict: Dict[str, Any]) -> Optional[Dict]:
    """Build ChromaDB where clause from simple equality dict."""
    if not filter_dict:
        return None
    conditions = [
        {k: {"$eq": v}}
        for k, v in filter_dict.items()
        if isinstance(v, (str, int, float, bool))
    ]
    if not conditions:
        return None
    return conditions[0] if len(conditions) == 1 else {"$and": conditions}


class VectorDBService:
    """Persistent vector store backed by ChromaDB."""

    def __init__(self):
        self._collection = None
        self._initialize()

    def _initialize(self):
        try:
            client = chromadb.PersistentClient(
                path=CHROMA_PERSIST_DIR,
                settings=ChromaSettings(anonymized_telemetry=False),
            )
            self._collection = client.get_or_create_collection(
                name=COLLECTION_NAME,
                metadata={"hnsw:space": "cosine"},
            )
            logger.info(f"ChromaDB ready — {self._collection.count()} chunks stored at {CHROMA_PERSIST_DIR}")
        except Exception as e:
            logger.error(f"ChromaDB init failed: {e}")
            raise VectorDBError(f"ChromaDB init failed: {e}")

    def add_documents(
        self,
        document_id: str,
        chunks: List[str],
        embeddings: List[List[float]],
        metadata: Optional[Dict[str, Any]] = None,
    ):
        """Upsert document chunks into ChromaDB."""
        if not chunks or not embeddings:
            logger.warning("No chunks or embeddings to add")
            return
        try:
            base_meta = _serialize_metadata(metadata or {})
            ids, docs, metas, embeds = [], [], [], []

            for i, (chunk, emb) in enumerate(zip(chunks, embeddings)):
                ids.append(f"{document_id}_chunk_{i}")
                docs.append(chunk)
                metas.append({**base_meta, "document_id": document_id, "chunk_index": i})
                embeds.append(emb)

            for start in range(0, len(ids), 100):
                self._collection.upsert(
                    ids=ids[start:start + 100],
                    documents=docs[start:start + 100],
                    metadatas=metas[start:start + 100],
                    embeddings=embeds[start:start + 100],
                )

            logger.info(f"Upserted {len(chunks)} chunks for document {document_id}")
        except Exception as e:
            logger.error(f"Failed to add documents: {e}")
            raise VectorDBError(f"Failed to add documents: {e}")

    def search(
        self,
        query_embedding: List[float],
        top_k: int = None,
        similarity_threshold: float = None,
        filter_dict: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """Cosine similarity search with optional metadata filtering."""
        top_k = top_k or settings.TOP_K
        similarity_threshold = similarity_threshold or settings.SIMILARITY_THRESHOLD

        try:
            total = self._collection.count()
            if total == 0:
                return []

            n = min(top_k * 2, total)
            where = _build_where(filter_dict)

            kwargs: Dict[str, Any] = {
                "query_embeddings": [query_embedding],
                "n_results": n,
                "include": ["documents", "metadatas", "distances"],
            }
            if where:
                kwargs["where"] = where

            raw = self._collection.query(**kwargs)

            results = []
            for chunk_id, doc, meta, dist in zip(
                raw["ids"][0], raw["documents"][0],
                raw["metadatas"][0], raw["distances"][0],
            ):
                score = 1.0 - dist  # cosine distance → cosine similarity
                if score < similarity_threshold:
                    continue
                results.append({"id": chunk_id, "text": doc, "metadata": meta, "score": score})

            return results[:top_k]

        except Exception as e:
            logger.error(f"Search failed: {e}")
            raise VectorDBError(f"Search failed: {e}")

    def delete_document(self, document_id: str):
        try:
            # Fetch IDs first — ChromaDB errors if where clause matches nothing
            results = self._collection.get(where={"document_id": {"$eq": document_id}})
            ids = results.get("ids", [])
            if ids:
                self._collection.delete(ids=ids)
                logger.info(f"Deleted {len(ids)} chunks for document {document_id}")
            else:
                logger.info(f"No chunks found for document {document_id}, skipping vector delete")
        except Exception as e:
            logger.error(f"Failed to delete document: {e}")
            raise VectorDBError(f"Failed to delete document: {e}")

    def get_stats(self) -> Dict[str, int]:
        try:
            return {"total_chunks": self._collection.count()}
        except Exception:
            return {"total_chunks": 0}

    def persist(self):
        pass  # PersistentClient auto-persists on every write


# Global instance
vector_db_service = VectorDBService()
