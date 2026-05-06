"""Retrieval service for hybrid search with metadata filtering and hierarchy."""

from typing import List, Optional, Dict, Any, Union
from dataclasses import dataclass, field
from enum import Enum

from app.core.config import settings
from app.core.logging import logger
from app.services.vector_db_service import vector_db_service
from app.services.embedding_service_optimized import EmbeddingServiceOptimized


class FilterOperator(Enum):
    """Filter operators for metadata filtering."""
    EQ = "eq"           # Equal
    NE = "ne"           # Not equal
    GT = "gt"           # Greater than
    GTE = "gte"         # Greater than or equal
    LT = "lt"           # Less than
    LTE = "lte"         # Less than or equal
    IN = "in"           # In list
    NIN = "nin"         # Not in list
    CONTAINS = "contains"  # Contains substring
    EXISTS = "exists"   # Field exists


@dataclass
class MetadataFilter:
    """Single metadata filter condition."""
    field: str
    value: Any
    operator: FilterOperator = FilterOperator.EQ


@dataclass
class RetrievalResult:
    """Retrieval result with chunk and metadata."""
    id: str
    text: str
    score: float
    document_id: str
    chunk_index: int
    metadata: Dict[str, Any]
    section_path: Optional[str] = None
    headings_hierarchy: Optional[List[str]] = None
    parent_section: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "text": self.text,
            "score": self.score,
            "document_id": self.document_id,
            "chunk_index": self.chunk_index,
            "metadata": self.metadata,
            "section_path": self.section_path,
            "headings_hierarchy": self.headings_hierarchy,
            "parent_section": self.parent_section,
        }


@dataclass
class HierarchyQuery:
    """Query for hierarchy-based retrieval."""
    section_path: Optional[str] = None  # Search within specific section path
    heading_level: Optional[int] = None  # Filter by heading level
    parent_section: Optional[str] = None  # Search within parent section
    include_children: bool = True  # Include child sections
    include_parents: bool = False  # Include parent context


@dataclass
class RetrievalQuery:
    """Query for retrieval with prefiltering and hierarchy."""
    query: str
    top_k: int = None
    similarity_threshold: float = None
    document_ids: Optional[List[str]] = None
    
    # Prefiltering (applied before vector search for efficiency)
    metadata_prefilters: List[MetadataFilter] = field(default_factory=list)
    
    # Hierarchy filtering
    hierarchy: Optional[HierarchyQuery] = None
    
    # Content type filters (prefilter)
    content_types: Optional[List[str]] = None  # "table", "list", "code", "heading"
    
    # Date range filters (prefilter)
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    
    def __post_init__(self):
        if self.top_k is None:
            self.top_k = settings.TOP_K
        if self.similarity_threshold is None:
            self.similarity_threshold = settings.SIMILARITY_THRESHOLD


class RetrievalService:
    """Service for hybrid retrieval with prefiltering, hierarchy, and vector search."""
    
    def __init__(self):
        self.vector_db = vector_db_service
        self.embedding_service = EmbeddingServiceOptimized()
    
    def _build_prefilter_dict(self, query: RetrievalQuery) -> Optional[Dict[str, Any]]:
        """
        Build prefilter dictionary from query filters.
        These filters are applied BEFORE vector search for efficiency.
        """
        filter_dict = {}
        
        # Document ID filter
        if query.document_ids and len(query.document_ids) == 1:
            filter_dict["document_id"] = query.document_ids[0]
        
        # Metadata prefilters
        for filter_condition in query.metadata_prefilters:
            if filter_condition.operator == FilterOperator.EQ:
                filter_dict[filter_condition.field] = filter_condition.value
            # For complex operators, we'll handle post-filtering
        
        # Content type filters (stored in metadata)
        if query.content_types:
            # Add flags for content types
            for content_type in query.content_types:
                filter_dict[f"contains_{content_type}"] = True
        
        # Date range filters
        if query.date_from:
            filter_dict["created_date_gte"] = query.date_from
        if query.date_to:
            filter_dict["created_date_lte"] = query.date_to
        
        # Hierarchy filters
        if query.hierarchy:
            if query.hierarchy.section_path:
                filter_dict["section_path"] = query.hierarchy.section_path
            if query.hierarchy.parent_section:
                filter_dict["parent_section"] = query.hierarchy.parent_section
            if query.hierarchy.heading_level:
                filter_dict["section_level"] = query.hierarchy.heading_level
        
        return filter_dict if filter_dict else None
    
    def _apply_postfilters(
        self,
        results: List[Dict[str, Any]],
        query: RetrievalQuery
    ) -> List[Dict[str, Any]]:
        """
        Apply post-filters that couldn't be applied in prefiltering.
        """
        filtered_results = results
        
        # Multiple document IDs filter
        if query.document_ids and len(query.document_ids) > 1:
            filtered_results = [
                r for r in filtered_results 
                if r["metadata"].get("document_id") in query.document_ids
            ]
        
        # Complex metadata filters (operators other than EQ)
        for filter_condition in query.metadata_prefilters:
            if filter_condition.operator == FilterOperator.NE:
                filtered_results = [
                    r for r in filtered_results
                    if r["metadata"].get(filter_condition.field) != filter_condition.value
                ]
            elif filter_condition.operator == FilterOperator.GT:
                filtered_results = [
                    r for r in filtered_results
                    if r["metadata"].get(filter_condition.field, 0) > filter_condition.value
                ]
            elif filter_condition.operator == FilterOperator.GTE:
                filtered_results = [
                    r for r in filtered_results
                    if r["metadata"].get(filter_condition.field, 0) >= filter_condition.value
                ]
            elif filter_condition.operator == FilterOperator.LT:
                filtered_results = [
                    r for r in filtered_results
                    if r["metadata"].get(filter_condition.field, 0) < filter_condition.value
                ]
            elif filter_condition.operator == FilterOperator.LTE:
                filtered_results = [
                    r for r in filtered_results
                    if r["metadata"].get(filter_condition.field, 0) <= filter_condition.value
                ]
            elif filter_condition.operator == FilterOperator.IN:
                filtered_results = [
                    r for r in filtered_results
                    if r["metadata"].get(filter_condition.field) in filter_condition.value
                ]
            elif filter_condition.operator == FilterOperator.NIN:
                filtered_results = [
                    r for r in filtered_results
                    if r["metadata"].get(filter_condition.field) not in filter_condition.value
                ]
            elif filter_condition.operator == FilterOperator.CONTAINS:
                filtered_results = [
                    r for r in filtered_results
                    if filter_condition.value in str(r["metadata"].get(filter_condition.field, ""))
                ]
        
        return filtered_results
    
    def _enrich_with_hierarchy(self, result: Dict[str, Any]) -> Dict[str, Any]:
        """Enrich result with hierarchy information from metadata."""
        metadata = result.get("metadata", {})
        result["section_path"] = metadata.get("section_path")
        result["headings_hierarchy"] = metadata.get("headings_hierarchy", [])
        result["parent_section"] = metadata.get("parent_section")
        return result
    
    async def retrieve(
        self,
        query: RetrievalQuery
    ) -> List[RetrievalResult]:
        """
        Perform hybrid retrieval with prefiltering and vector search.
        
        Flow:
        1. Build prefilters (applied in SQL WHERE clause)
        2. Generate query embedding
        3. Vector search with prefilters
        4. Apply post-filters
        5. Limit to top_k
        """
        logger.info(f"Retrieving for query: {query.query[:50]}...")
        
        # Build prefilters
        prefilter_dict = self._build_prefilter_dict(query)
        
        # Generate query embedding
        query_embedding = await self.embedding_service.embed_query_async(query.query)
        
        # Determine top_k (get more for post-filtering)
        search_top_k = query.top_k * 2 if (
            query.document_ids and len(query.document_ids) > 1
        ) or query.metadata_prefilters else query.top_k
        
        # Perform vector search with prefilters
        results = self.vector_db.search(
            query_embedding=query_embedding,
            top_k=search_top_k,
            similarity_threshold=query.similarity_threshold,
            filter_dict=prefilter_dict
        )
        
        # Apply post-filters
        results = self._apply_postfilters(results, query)
        
        # Limit to top_k
        results = results[:query.top_k]
        
        # Enrich with hierarchy info
        results = [self._enrich_with_hierarchy(r) for r in results]
        
        # Convert to RetrievalResult
        retrieval_results = []
        for result in results:
            metadata = result.get("metadata", {})
            retrieval_results.append(RetrievalResult(
                id=result["id"],
                text=result["text"],
                score=result["score"],
                document_id=metadata.get("document_id", "unknown"),
                chunk_index=metadata.get("chunk_index", 0),
                metadata=metadata,
                section_path=result.get("section_path"),
                headings_hierarchy=result.get("headings_hierarchy"),
                parent_section=result.get("parent_section"),
            ))
        
        logger.info(f"Retrieved {len(retrieval_results)} results")
        return retrieval_results
    
    async def retrieve_by_hierarchy(
        self,
        query: str,
        hierarchy: HierarchyQuery,
        document_ids: Optional[List[str]] = None,
        top_k: int = None
    ) -> List[RetrievalResult]:
        """
        Retrieve using hierarchy-based filtering.
        
        Args:
            query: Search query
            hierarchy: HierarchyQuery with section filters
            document_ids: Optional document IDs to search
            top_k: Number of results
            
        Returns:
            List of RetrievalResult within hierarchy constraints
        """
        retrieval_query = RetrievalQuery(
            query=query,
            top_k=top_k or settings.TOP_K,
            document_ids=document_ids,
            hierarchy=hierarchy,
        )
        
        return await self.retrieve(retrieval_query)
    
    async def retrieve_with_parent_context(
        self,
        query: RetrievalQuery,
        include_parent_summary: bool = True
    ) -> List[RetrievalResult]:
        """
        Retrieve with parent section context for each result.
        
        This is useful when you want to understand the broader context
        of a specific chunk.
        """
        # Get initial results
        results = await self.retrieve(query)
        
        if not include_parent_summary:
            return results
        
        # Group by parent section
        parent_sections = {}
        for result in results:
            parent = result.parent_section or result.section_path
            if parent:
                if parent not in parent_sections:
                    parent_sections[parent] = []
                parent_sections[parent].append(result)
        
        # Log hierarchy info for debugging
        if parent_sections:
            logger.info(f"Results grouped into {len(parent_sections)} parent sections")
        
        return results
    
    async def retrieve_section_summary(
        self,
        document_id: str,
        section_path: str
    ) -> Optional[Dict[str, Any]]:
        """
        Retrieve a summary of a specific section.
        
        This can be used to get an overview before diving into details.
        """
        # This would fetch all chunks in a section and summarize
        # For now, return basic info
        return {
            "document_id": document_id,
            "section_path": section_path,
            "summary": "Section summary retrieval not yet implemented",
        }
    
    def format_context_for_llm(
        self,
        results: List[RetrievalResult],
        include_metadata: bool = True,
        include_hierarchy: bool = True
    ) -> str:
        """
        Format retrieval results as context for LLM.
        
        Args:
            results: List of RetrievalResult
            include_metadata: Whether to include metadata
            include_hierarchy: Whether to include hierarchy info
            
        Returns:
            Formatted context string
        """
        context_parts = []
        
        for i, result in enumerate(results, 1):
            part = f"[Source {i}]\n"
            
            if include_metadata:
                meta = result.metadata
                if meta.get("filename"):
                    part += f"Document: {meta.get('filename')}\n"
                if meta.get("page_number"):
                    part += f"Page: {meta.get('page_number')}\n"
                
                # Hierarchy information
                if include_hierarchy:
                    if result.section_path:
                        part += f"Section: {result.section_path}\n"
                    if result.headings_hierarchy:
                        part += f"Path: {' > '.join(result.headings_hierarchy)}\n"
                    if result.parent_section:
                        part += f"Parent: {result.parent_section}\n"
                
                if result.score:
                    part += f"Relevance: {result.score:.2%}\n"
            
            part += f"Content: {result.text}\n"
            context_parts.append(part)
        
        return "\n---\n".join(context_parts)


# Global instance
retrieval_service = RetrievalService()
