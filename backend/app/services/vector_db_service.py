"""Vector database service: Qdrant dense search + BM25 keyword search with score fusion."""

import json
import pickle
import re
import uuid
from pathlib import Path
from typing import List, Optional, Dict, Any

from app.core.config import settings
from app.core.logging import logger
from app.core.exceptions import VectorDBError

QDRANT_PATH = "./qdrant_db"
COLLECTION_NAME = "documents"
BM25_STORE_PATH = "./bm25_store.pkl"

_NAMESPACE = uuid.UUID("6ba7b810-9dad-11d1-80b4-00c04fd430c8")


def _point_id(document_id: str, chunk_index: int) -> str:
    """Deterministic UUID for a chunk — re-uploading a doc replaces its old chunks."""
    return str(uuid.uuid5(_NAMESPACE, f"{document_id}::{chunk_index}"))


def _tokenize(text: str) -> List[str]:
    return re.findall(r"\b\w+\b", text.lower())


def _serialize_metadata(meta: Dict[str, Any]) -> Dict[str, Any]:
    result = {}
    for k, v in meta.items():
        if v is None:
            continue
        if isinstance(v, (str, int, float, bool)):
            result[k] = v
        else:
            result[k] = json.dumps(v)
    return result


def _qdrant_search(client, collection_name, query_vector, limit, query_filter):
    """Compatibility wrapper: qdrant-client <2.0 uses search(), >=2.0 uses query_points()."""
    try:
        return client.search(
            collection_name=collection_name,
            query_vector=query_vector,
            limit=limit,
            query_filter=query_filter,
            with_payload=True,
        )
    except AttributeError:
        # qdrant-client >= 2.0
        return client.query_points(
            collection_name=collection_name,
            query=query_vector,
            limit=limit,
            query_filter=query_filter,
            with_payload=True,
        ).points


def _build_qdrant_filter(filter_dict: Optional[Dict[str, Any]]):
    if not filter_dict:
        return None
    from qdrant_client import models
    conditions = [
        models.FieldCondition(key=k, match=models.MatchValue(value=v))
        for k, v in filter_dict.items()
        if isinstance(v, (str, int, float, bool))
    ]
    return models.Filter(must=conditions) if conditions else None


class VectorDBService:
    """
    Hybrid retrieval: Qdrant for dense (semantic) search + BM25 for keyword recall.
    Scores are fused as: 0.6 * dense + 0.4 * BM25 (both normalized to [0,1]).

    BM25 is maintained in memory and persisted to bm25_store.pkl. On startup it
    either loads from that file or rebuilds by scrolling all Qdrant payloads.
    """

    def __init__(self):
        self._client = None
        self._bm25 = None
        self._bm25_docs: List[Dict] = []  # {id, text, document_id}

    # ------------------------------------------------------------------
    # Init
    # ------------------------------------------------------------------

    def _ensure_initialized(self):
        if self._client is None:
            self._initialize()

    def _initialize(self):
        try:
            from qdrant_client import QdrantClient
            from qdrant_client import models

            self._client = QdrantClient(path=QDRANT_PATH)
            existing = [c.name for c in self._client.get_collections().collections]
            if COLLECTION_NAME not in existing:
                self._client.create_collection(
                    collection_name=COLLECTION_NAME,
                    vectors_config=models.VectorParams(
                        size=settings.EMBEDDING_DIMENSIONS,
                        distance=models.Distance.COSINE,
                    ),
                )
                logger.info(f"Created Qdrant collection '{COLLECTION_NAME}'")
            else:
                count = self._client.count(COLLECTION_NAME).count
                logger.info(f"Qdrant ready — {count} chunks in '{COLLECTION_NAME}'")
                if count == 0:
                    logger.warning(
                        "Qdrant collection is empty. All documents need to be re-uploaded "
                        "because the vector store was migrated from ChromaDB."
                    )

            self._load_bm25()

        except ImportError:
            raise VectorDBError(
                "qdrant-client not installed. Run: pip install 'qdrant-client>=1.7.0' rank-bm25"
            )
        except Exception as e:
            logger.error(f"Qdrant init failed: {e}")
            raise VectorDBError(f"Qdrant init failed: {e}")

    # ------------------------------------------------------------------
    # BM25 management
    # ------------------------------------------------------------------

    def _load_bm25(self):
        store = Path(BM25_STORE_PATH)
        if store.exists():
            try:
                with open(store, "rb") as f:
                    self._bm25_docs = pickle.load(f)
                self._rebuild_bm25()
                logger.info(f"BM25 index loaded — {len(self._bm25_docs)} entries")
                return
            except Exception as e:
                logger.warning(f"BM25 store corrupt, rebuilding from Qdrant: {e}")
        self._rebuild_bm25_from_qdrant()

    def _rebuild_bm25_from_qdrant(self):
        try:
            self._bm25_docs = []
            offset = None
            while True:
                results, next_offset = self._client.scroll(
                    collection_name=COLLECTION_NAME,
                    limit=200,
                    offset=offset,
                    with_payload=True,
                    with_vectors=False,
                )
                for point in results:
                    p = point.payload or {}
                    text = p.get("text", "")
                    if text:
                        self._bm25_docs.append({
                            "id": str(point.id),
                            "text": text,
                            "document_id": p.get("document_id", ""),
                        })
                if next_offset is None:
                    break
                offset = next_offset
            self._rebuild_bm25()
            self._save_bm25()
            logger.info(f"BM25 rebuilt from Qdrant — {len(self._bm25_docs)} entries")
        except Exception as e:
            logger.warning(f"BM25 rebuild failed: {e}")

    def _rebuild_bm25(self):
        if not self._bm25_docs:
            self._bm25 = None
            return
        try:
            from rank_bm25 import BM25Okapi
            corpus = [_tokenize(d["text"]) for d in self._bm25_docs]
            self._bm25 = BM25Okapi(corpus)
        except ImportError:
            logger.warning("rank-bm25 not installed — keyword search disabled. Run: pip install rank-bm25")
            self._bm25 = None

    def _save_bm25(self):
        try:
            with open(BM25_STORE_PATH, "wb") as f:
                pickle.dump(self._bm25_docs, f)
        except Exception as e:
            logger.warning(f"BM25 save failed: {e}")

    # ------------------------------------------------------------------
    # Write
    # ------------------------------------------------------------------

    def add_documents(
        self,
        document_id: str,
        chunks: List[str],
        embeddings: List[List[float]],
        metadata: Optional[Dict[str, Any]] = None,
    ):
        if not chunks or not embeddings:
            logger.warning("No chunks or embeddings to add")
            return

        self._ensure_initialized()

        try:
            from qdrant_client import models as qm

            raw_meta = metadata or {}

            # Per-chunk metadata passed as list (or JSON string)
            chunks_meta_raw = raw_meta.get("chunks_metadata", [])
            if isinstance(chunks_meta_raw, str):
                try:
                    chunks_meta_raw = json.loads(chunks_meta_raw)
                except Exception:
                    chunks_meta_raw = []

            base = {k: v for k, v in raw_meta.items() if k != "chunks_metadata"}
            base_s = _serialize_metadata(base)

            points = []
            new_bm25 = []

            for i, (chunk, emb) in enumerate(zip(chunks, embeddings)):
                pid = _point_id(document_id, i)
                chunk_meta = chunks_meta_raw[i] if i < len(chunks_meta_raw) else {}
                payload = {
                    **base_s,
                    **_serialize_metadata(chunk_meta),
                    "document_id": document_id,
                    "chunk_index": i,
                    "text": chunk,
                }
                points.append(qm.PointStruct(id=pid, vector=emb, payload=payload))
                new_bm25.append({"id": pid, "text": chunk, "document_id": document_id})

            for start in range(0, len(points), 100):
                self._client.upsert(
                    collection_name=COLLECTION_NAME,
                    points=points[start:start + 100],
                )

            # Refresh BM25: remove old entries for this doc, add new ones
            self._bm25_docs = [d for d in self._bm25_docs if d.get("document_id") != document_id]
            self._bm25_docs.extend(new_bm25)
            self._rebuild_bm25()
            self._save_bm25()

            logger.info(f"Indexed {len(chunks)} chunks for document {document_id}")

        except Exception as e:
            logger.error(f"Failed to add documents: {e}")
            raise VectorDBError(f"Failed to add documents: {e}")

    # ------------------------------------------------------------------
    # Search
    # ------------------------------------------------------------------

    def search(
        self,
        query_embedding: List[float],
        query_text: str = "",
        top_k: int = None,
        similarity_threshold: float = None,
        filter_dict: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        top_k = top_k or settings.TOP_K
        similarity_threshold = similarity_threshold if similarity_threshold is not None else settings.SIMILARITY_THRESHOLD
        fetch_k = min(top_k * 3, 200)

        try:
            count = self._client.count(COLLECTION_NAME).count
            if count == 0:
                return []

            fetch_k = min(fetch_k, count)
            qdrant_filter = _build_qdrant_filter(filter_dict)

            # --- Dense search ---
            dense_hits = _qdrant_search(
                self._client, COLLECTION_NAME, query_embedding, fetch_k, qdrant_filter
            )
            dense_by_id = {str(p.id): p for p in dense_hits}
            dense_ranks = {sid: rank for rank, sid in enumerate(dense_by_id)}

            # --- BM25 search (independent recall — finds exact keyword matches
            #     that dense search may miss, e.g. rare proper nouns) ---
            bm25_hits = self._bm25_search_all(query_text, fetch_k)
            bm25_by_id = {r["id"]: r for r in bm25_hits}
            bm25_ranks = {r["id"]: rank for rank, r in enumerate(bm25_hits)}

            # Fetch Qdrant payloads for BM25-only results
            bm25_only_ids = [sid for sid in bm25_by_id if sid not in dense_by_id]
            if bm25_only_ids:
                try:
                    extra_points = self._client.retrieve(
                        collection_name=COLLECTION_NAME,
                        ids=bm25_only_ids,
                        with_payload=True,
                    )
                    for point in extra_points:
                        dense_by_id[str(point.id)] = point
                except Exception as e:
                    logger.warning(f"BM25-only payload fetch failed: {e}")

            # --- RRF fusion ---
            k = 60
            all_ids = set(dense_ranks) | set(bm25_ranks)
            rrf_scores: Dict[str, float] = {}
            for sid in all_ids:
                dr = dense_ranks.get(sid, fetch_k)
                br = bm25_ranks.get(sid, fetch_k)
                rrf_scores[sid] = 1.0 / (k + dr + 1) + 1.0 / (k + br + 1)

            # Build results
            results = []
            for sid in sorted(rrf_scores, key=lambda x: rrf_scores[x], reverse=True):
                point = dense_by_id.get(sid)
                if point is None:
                    continue
                dense_score = float(getattr(point, "score", 0.0))
                # Apply threshold only to results that came from dense search
                if sid in dense_ranks and dense_score < similarity_threshold:
                    continue
                payload = dict(point.payload or {})
                text = payload.pop("text", "")
                results.append({
                    "id": sid,
                    "text": text,
                    "metadata": payload,
                    "score": rrf_scores[sid],
                })

            return results[:top_k]

        except Exception as e:
            logger.error(f"Search failed: {e}")
            raise VectorDBError(f"Search failed: {e}")

    def _bm25_search_all(self, query_text: str, top_k: int) -> List[Dict]:
        """Independent BM25 search across all indexed docs — provides keyword recall."""
        if not self._bm25 or not query_text:
            return []
        try:
            tokens = _tokenize(query_text)
            if not tokens:
                return []
            scores = self._bm25.get_scores(tokens)
            hits = [
                {"id": doc["id"], "score": float(scores[i]), "text": doc["text"]}
                for i, doc in enumerate(self._bm25_docs)
                if scores[i] > 0
            ]
            hits.sort(key=lambda x: x["score"], reverse=True)
            return hits[:top_k]
        except Exception as e:
            logger.warning(f"BM25 search failed: {e}")
            return []

    # ------------------------------------------------------------------
    # Delete
    # ------------------------------------------------------------------

    def delete_document(self, document_id: str):
        self._ensure_initialized()
        try:
            from qdrant_client import models as qm
            self._client.delete(
                collection_name=COLLECTION_NAME,
                points_selector=qm.FilterSelector(
                    filter=qm.Filter(
                        must=[qm.FieldCondition(
                            key="document_id",
                            match=qm.MatchValue(value=document_id)
                        )]
                    )
                ),
            )
            self._bm25_docs = [d for d in self._bm25_docs if d.get("document_id") != document_id]
            self._rebuild_bm25()
            self._save_bm25()
            logger.info(f"Deleted chunks for document {document_id}")
        except Exception as e:
            logger.error(f"Failed to delete document: {e}")
            raise VectorDBError(f"Failed to delete document: {e}")

    # ------------------------------------------------------------------
    # Stats
    # ------------------------------------------------------------------

    def get_stats(self) -> Dict[str, int]:
        self._ensure_initialized()
        try:
            return {"total_chunks": self._client.count(COLLECTION_NAME).count}
        except Exception:
            return {"total_chunks": 0}

    def persist(self):
        pass  # Qdrant persists automatically on every write


# Global singleton
vector_db_service = VectorDBService()
