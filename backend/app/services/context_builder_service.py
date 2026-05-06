"""Context builder service for assembling retrieved chunks into LLM context."""

import re
from typing import List, Optional, Dict, Any, Tuple
from dataclasses import dataclass, field
from enum import Enum

from app.core.config import settings
from app.core.logging import logger
from app.services.retrieval_service import RetrievalResult


class ContextStrategy(Enum):
    """Strategies for building context."""
    STANDARD = "standard"           # Simple concatenation
    HIERARCHY = "hierarchy"         # Group by hierarchy
    RELEVANCE = "relevance"         # Sort by relevance, include scores
    CHRONOLOGICAL = "chronological"  # Sort by position/page
    SEMANTIC = "semantic"           # Group related chunks
    COMPRESS = "compress"           # Summarize large contexts


@dataclass
class ContextChunk:
    """Context chunk with metadata for assembly."""
    content: str
    source_id: str
    document_name: str
    page: Optional[int] = None
    section_path: Optional[str] = None
    headings_hierarchy: List[str] = field(default_factory=list)
    parent_section: Optional[str] = None
    score: float = 0.0
    chunk_index: int = 0
    char_count: int = 0
    relevance_level: str = "high"  # high, medium, low


@dataclass
class AssembledContext:
    """Assembled context ready for LLM."""
    context_text: str
    sources: List[Dict[str, Any]]
    total_chunks: int
    total_chars: int
    estimated_tokens: int
    hierarchy_groups: Optional[Dict[str, List[ContextChunk]]] = None


class ContextBuilderService:
    """Service for building optimized context from retrieval results."""
    
    # Approximate tokens per character
    CHARS_PER_TOKEN = 4
    
    def __init__(self, max_context_chars: int = None):
        self.max_context_chars = max_context_chars or (settings.LLM_MAX_TOKENS * self.CHARS_PER_TOKEN * 0.7)
        # Reserve 30% for response
    
    def build_context(
        self,
        results: List[RetrievalResult],
        strategy: ContextStrategy = ContextStrategy.HIERARCHY,
        include_metadata: bool = True,
        include_hierarchy: bool = True
    ) -> AssembledContext:
        """
        Build context from retrieval results using specified strategy.
        
        Args:
            results: List of RetrievalResult from search
            strategy: How to organize the context
            include_metadata: Whether to include metadata headers
            include_hierarchy: Whether to include hierarchy info
            
        Returns:
            AssembledContext ready for LLM
        """
        logger.info(f"Building context with {len(results)} results using {strategy.value} strategy")
        
        if not results:
            return AssembledContext(
                context_text="No relevant context found.",
                sources=[],
                total_chunks=0,
                total_chars=0,
                estimated_tokens=0
            )
        
        # Convert to context chunks
        chunks = self._convert_to_chunks(results)
        
        # Apply strategy
        if strategy == ContextStrategy.HIERARCHY:
            context_text, sources, hierarchy_groups = self._build_hierarchy_context(
                chunks, include_metadata, include_hierarchy
            )
        elif strategy == ContextStrategy.RELEVANCE:
            context_text, sources = self._build_relevance_context(chunks, include_metadata)
            hierarchy_groups = None
        elif strategy == ContextStrategy.CHRONOLOGICAL:
            context_text, sources = self._build_chronological_context(chunks, include_metadata)
            hierarchy_groups = None
        elif strategy == ContextStrategy.COMPRESS:
            context_text, sources = self._build_compressed_context(chunks, include_metadata)
            hierarchy_groups = None
        else:
            context_text, sources = self._build_standard_context(chunks, include_metadata)
            hierarchy_groups = None
        
        # Ensure within limits
        if len(context_text) > self.max_context_chars:
            logger.warning(f"Context exceeds limit ({len(context_text)} chars), truncating")
            context_text = self._truncate_context(context_text, chunks)
        
        total_chars = len(context_text)
        estimated_tokens = total_chars // self.CHARS_PER_TOKEN
        
        return AssembledContext(
            context_text=context_text,
            sources=sources,
            total_chunks=len(chunks),
            total_chars=total_chars,
            estimated_tokens=estimated_tokens,
            hierarchy_groups=hierarchy_groups
        )
    
    def _convert_to_chunks(self, results: List[RetrievalResult]) -> List[ContextChunk]:
        """Convert retrieval results to context chunks."""
        chunks = []
        for result in results:
            meta = result.metadata
            chunk = ContextChunk(
                content=result.text,
                source_id=result.id,
                document_name=meta.get("filename", "Unknown Document"),
                page=meta.get("page_number"),
                section_path=result.section_path or meta.get("section_path"),
                headings_hierarchy=result.headings_hierarchy or meta.get("headings_hierarchy", []),
                parent_section=result.parent_section or meta.get("parent_section"),
                score=result.score,
                chunk_index=result.chunk_index,
                char_count=len(result.text),
                relevance_level="high" if result.score > 0.8 else "medium" if result.score > 0.6 else "low"
            )
            chunks.append(chunk)
        return chunks
    
    def _build_hierarchy_context(
        self,
        chunks: List[ContextChunk],
        include_metadata: bool,
        include_hierarchy: bool
    ) -> Tuple[str, List[Dict[str, Any]], Dict[str, List[ContextChunk]]]:
        """Build context grouped by hierarchy."""
        # Group by document and section
        hierarchy_groups: Dict[str, List[ContextChunk]] = {}
        
        for chunk in chunks:
            # Create group key based on hierarchy
            if chunk.section_path:
                group_key = f"{chunk.document_name} > {chunk.section_path}"
            elif chunk.parent_section:
                group_key = f"{chunk.document_name} > {chunk.parent_section}"
            else:
                group_key = chunk.document_name
            
            if group_key not in hierarchy_groups:
                hierarchy_groups[group_key] = []
            hierarchy_groups[group_key].append(chunk)
        
        # Sort chunks within each group by relevance
        for group in hierarchy_groups.values():
            group.sort(key=lambda x: x.score, reverse=True)
        
        # Build context text
        parts = []
        sources = []
        source_counter = 1
        
        for group_name, group_chunks in hierarchy_groups.items():
            # Group header
            if include_hierarchy:
                parts.append(f"\n{'=' * 40}")
                parts.append(f"📁 {group_name}")
                parts.append(f"{'=' * 40}\n")
            
            for chunk in group_chunks:
                part_lines = [f"[Source {source_counter}]"]
                
                if include_metadata:
                    if chunk.page:
                        part_lines.append(f"Page: {chunk.page}")
                    
                    if include_hierarchy:
                        if chunk.headings_hierarchy:
                            path = " > ".join(chunk.headings_hierarchy)
                            part_lines.append(f"Path: {path}")
                        if chunk.parent_section and chunk.parent_section != chunk.section_path:
                            part_lines.append(f"Parent: {chunk.parent_section}")
                    
                    part_lines.append(f"Relevance: {chunk.score:.1%}")
                
                part_lines.append(f"Content: {chunk.content}")
                parts.append("\n".join(part_lines))
                parts.append("\n" + "-" * 30 + "\n")
                
                sources.append({
                    "id": chunk.source_id,
                    "index": source_counter,
                    "document": chunk.document_name,
                    "page": chunk.page,
                    "section": chunk.section_path,
                    "score": chunk.score,
                    "hierarchy": chunk.headings_hierarchy,
                })
                
                source_counter += 1
        
        return "\n".join(parts), sources, hierarchy_groups
    
    def _build_relevance_context(
        self,
        chunks: List[ContextChunk],
        include_metadata: bool
    ) -> Tuple[str, List[Dict[str, Any]]]:
        """Build context sorted by relevance."""
        # Sort by score descending
        sorted_chunks = sorted(chunks, key=lambda x: x.score, reverse=True)
        
        parts = []
        sources = []
        
        for i, chunk in enumerate(sorted_chunks, 1):
            part_lines = [f"[Source {i}]"]
            
            if include_metadata:
                part_lines.append(f"Document: {chunk.document_name}")
                if chunk.page:
                    part_lines.append(f"Page: {chunk.page}")
                part_lines.append(f"Relevance: {chunk.score:.1%} ({chunk.relevance_level})")
            
            part_lines.append(f"Content: {chunk.content}")
            parts.append("\n".join(part_lines))
            parts.append("\n" + "-" * 30 + "\n")
            
            sources.append({
                "id": chunk.source_id,
                "index": i,
                "document": chunk.document_name,
                "page": chunk.page,
                "score": chunk.score,
            })
        
        return "\n".join(parts), sources
    
    def _build_chronological_context(
        self,
        chunks: List[ContextChunk],
        include_metadata: bool
    ) -> Tuple[str, List[Dict[str, Any]]]:
        """Build context sorted by document position."""
        # Sort by document, then by page/chunk_index
        sorted_chunks = sorted(chunks, key=lambda x: (x.document_name, x.page or 0, x.chunk_index))
        
        parts = []
        sources = []
        
        for i, chunk in enumerate(sorted_chunks, 1):
            part_lines = [f"[Source {i}]"]
            
            if include_metadata:
                part_lines.append(f"Document: {chunk.document_name}")
                if chunk.page:
                    part_lines.append(f"Page: {chunk.page}")
                if chunk.section_path:
                    part_lines.append(f"Section: {chunk.section_path}")
            
            part_lines.append(f"Content: {chunk.content}")
            parts.append("\n".join(part_lines))
            parts.append("\n" + "-" * 30 + "\n")
            
            sources.append({
                "id": chunk.source_id,
                "index": i,
                "document": chunk.document_name,
                "page": chunk.page,
                "section": chunk.section_path,
            })
        
        return "\n".join(parts), sources
    
    def _build_compressed_context(
        self,
        chunks: List[ContextChunk],
        include_metadata: bool
    ) -> Tuple[str, List[Dict[str, Any]]]:
        """Build compressed context by summarizing similar chunks."""
        # For now, just truncate long chunks
        parts = []
        sources = []
        
        for i, chunk in enumerate(chunks, 1):
            # Truncate very long chunks
            content = chunk.content
            if len(content) > 1000:
                content = content[:1000] + "... [truncated]"
            
            part_lines = [f"[Source {i}]"]
            
            if include_metadata:
                part_lines.append(f"Document: {chunk.document_name}")
                if chunk.page:
                    part_lines.append(f"Page: {chunk.page}")
                part_lines.append(f"Relevance: {chunk.score:.1%}")
            
            part_lines.append(f"Content: {content}")
            parts.append("\n".join(part_lines))
            parts.append("\n" + "-" * 20 + "\n")
            
            sources.append({
                "id": chunk.source_id,
                "index": i,
                "document": chunk.document_name,
                "page": chunk.page,
                "score": chunk.score,
            })
        
        return "\n".join(parts), sources
    
    def _build_standard_context(
        self,
        chunks: List[ContextChunk],
        include_metadata: bool
    ) -> Tuple[str, List[Dict[str, Any]]]:
        """Build standard simple context."""
        parts = []
        sources = []
        
        for i, chunk in enumerate(chunks, 1):
            part_lines = [f"[Source {i}]"]
            
            if include_metadata:
                part_lines.append(f"Document: {chunk.document_name}")
                if chunk.page:
                    part_lines.append(f"Page: {chunk.page}")
                if chunk.section_path:
                    part_lines.append(f"Section: {chunk.section_path}")
            
            part_lines.append(f"Content: {chunk.content}")
            parts.append("\n".join(part_lines))
            parts.append("")
            
            sources.append({
                "id": chunk.source_id,
                "index": i,
                "document": chunk.document_name,
                "page": chunk.page,
                "section": chunk.section_path,
            })
        
        return "\n".join(parts), sources
    
    def _truncate_context(self, context: str, chunks: List[ContextChunk]) -> str:
        """Truncate context to fit within limits, preserving most relevant chunks."""
        # Keep truncating until under limit
        while len(context) > self.max_context_chars and len(chunks) > 1:
            # Remove the least relevant chunk
            chunks.pop()  # Assuming sorted by relevance
            
            # Rebuild context (simplified)
            lines = context.split("\n")
            # Find and remove last source section
            new_lines = []
            in_last_source = False
            for line in reversed(lines):
                if line.startswith("[Source"):
                    if not in_last_source:
                        in_last_source = True
                        continue  # Skip this source
                if in_last_source:
                    if line.startswith("[Source") or line.startswith("📁") or line.startswith("="):
                        in_last_source = False
                        new_lines.append(line)
                else:
                    new_lines.append(line)
            
            context = "\n".join(reversed(new_lines))
        
        # Final truncation if still too long
        if len(context) > self.max_context_chars:
            context = context[:int(self.max_context_chars)] + "\n\n[Context truncated due to length]"
        
        return context
    
    def build_prompt_with_context(
        self,
        user_query: str,
        assembled: AssembledContext,
        system_prompt: Optional[str] = None
    ) -> Tuple[str, str]:
        """
        Build complete system and user prompts with assembled context.
        
        Returns:
            Tuple of (system_prompt, user_prompt)
        """
        if system_prompt is None:
            system_prompt = """You are a helpful AI assistant answering questions based on provided document context.

Instructions:
1. Answer using ONLY the information in the provided context
2. Cite sources using [Source X] format
3. If context is insufficient, say so clearly
4. Be concise and accurate
5. Consider document hierarchy when interpreting context"""
        
        user_prompt = f"""Context from retrieved documents:
{assembled.context_text}

---

User Question: {user_query}

Please answer based on the context above. Cite relevant sources."""
        
        return system_prompt, user_prompt


# Global instance
context_builder_service = ContextBuilderService()
