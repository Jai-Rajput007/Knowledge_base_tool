"""Query processing service for understanding user questions and extracting filters."""

import re
from typing import List, Optional, Dict, Any, Tuple
from dataclasses import dataclass, field
from enum import Enum

from app.core.logging import logger


class QueryIntent(Enum):
    """Types of query intents."""
    FACTUAL = "factual"           # "What is X?"
    DEFINITION = "definition"     # "Define X", "What does X mean?"
    COMPARISON = "comparison"     # "Compare X and Y", "Difference between X and Y"
    PROCEDURE = "procedure"       # "How to X?", "Steps to do X"
    SUMMARY = "summary"           # "Summarize", "Overview of"
    SEARCH = "search"             # General search
    LOCATE = "locate"             # "Where is X?", "Find X in document"
    TEMPORAL = "temporal"         # "When did X happen?", "Recent changes"


@dataclass
class ExtractedFilter:
    """Extracted filter from query."""
    field: str
    value: Any
    confidence: float  # 0.0 to 1.0
    source: str  # "explicit", "inferred", "metadata"


@dataclass
class ProcessedQuery:
    """Processed query with intent and filters."""
    original_query: str
    cleaned_query: str
    intent: QueryIntent
    confidence: float
    extracted_filters: List[ExtractedFilter] = field(default_factory=list)
    keywords: List[str] = field(default_factory=list)
    
    # Suggested filters based on query analysis
    suggested_document_ids: Optional[List[str]] = None
    suggested_section_path: Optional[str] = None
    suggested_content_types: Optional[List[str]] = None


class QueryProcessingService:
    """Service for processing and understanding user queries."""
    
    # Patterns for intent detection
    INTENT_PATTERNS = {
        QueryIntent.DEFINITION: [
            r"what is\s+(.+?)(?:\?|$)",
            r"define\s+(.+?)(?:\?|$)",
            r"what does\s+(.+?)\s+mean",
            r"meaning of\s+(.+?)(?:\?|$)",
            r"explain\s+(.+?)(?:\?|$)",
        ],
        QueryIntent.COMPARISON: [
            r"compare\s+(.+?)\s+(?:and|with|to)\s+(.+?)(?:\?|$)",
            r"difference\s+(?:between|of)\s+(.+?)\s+(?:and|&|vs)\s+(.+?)(?:\?|$)",
            r"(?:how|what)\s+is\s+(.+?)\s+different\s+from\s+(.+?)(?:\?|$)",
            r"(?:pros?|cons?|advantages?|disadvantages?)\s+(?:of|and)",
        ],
        QueryIntent.PROCEDURE: [
            r"how\s+(?:to|do)\s+(.+?)(?:\?|$)",
            r"steps\s+(?:to|for)\s+(.+?)(?:\?|$)",
            r"how\s+(?:can|should)\s+(?:i|we)\s+(.+?)(?:\?|$)",
            r"guide\s+(?:to|for)\s+(.+?)(?:\?|$)",
            r"process\s+(?:of|for)\s+(.+?)(?:\?|$)",
        ],
        QueryIntent.SUMMARY: [
            r"summarize\s+(.+?)(?:\?|$)",
            r"summary\s+(?:of|about)\s+(.+?)(?:\?|$)",
            r"overview\s+(?:of|about)\s+(.+?)(?:\?|$)",
            r"tl;dr",
            r"key\s+points",
        ],
        QueryIntent.LOCATE: [
            r"where\s+(?:is|are|can)\s+(?:i\s+)?(?:find|see|get)\s+(.+?)(?:\?|$)",
            r"find\s+(.+?)\s+in\s+(?:the\s+)?document",
            r"locate\s+(.+?)(?:\?|$)",
            r"which\s+(?:page|section)\s+(?:contains|has)\s+(.+?)(?:\?|$)",
        ],
        QueryIntent.TEMPORAL: [
            r"when\s+(?:did|was|were)\s+(.+?)(?:\?|$)",
            r"(?:recent|latest|new)\s+(.+?)(?:\?|$)",
            r"(?:history|timeline)\s+(?:of|about)\s+(.+?)(?:\?|$)",
            r"(?:date|time|year)\s+(?:of|for)\s+(.+?)(?:\?|$)",
        ],
    }
    
    # Section keywords for hierarchy detection
    SECTION_KEYWORDS = [
        "chapter", "section", "part", "appendix", "introduction", 
        "conclusion", "summary", "overview", "methodology", "results"
    ]
    
    def __init__(self):
        self._compile_patterns()
    
    def _compile_patterns(self):
        """Compile regex patterns for performance."""
        self.compiled_patterns = {}
        for intent, patterns in self.INTENT_PATTERNS.items():
            self.compiled_patterns[intent] = [re.compile(p, re.IGNORECASE) for p in patterns]
    
    def process_query(self, query: str) -> ProcessedQuery:
        """
        Process a user query to extract intent and filters.
        
        Args:
            query: Raw user query
            
        Returns:
            ProcessedQuery with intent, confidence, and filters
        """
        logger.info(f"Processing query: {query[:50]}...")
        
        # Clean query
        cleaned = self._clean_query(query)
        
        # Detect intent
        intent, confidence = self._detect_intent(query)
        
        # Extract keywords
        keywords = self._extract_keywords(cleaned)
        
        # Extract filters
        filters = self._extract_filters(query)
        
        # Infer suggestions based on intent
        suggestions = self._infer_suggestions(intent, query, filters)
        
        processed = ProcessedQuery(
            original_query=query,
            cleaned_query=cleaned,
            intent=intent,
            confidence=confidence,
            extracted_filters=filters,
            keywords=keywords,
            suggested_document_ids=suggestions.get("document_ids"),
            suggested_section_path=suggestions.get("section_path"),
            suggested_content_types=suggestions.get("content_types"),
        )
        
        logger.info(f"Query intent: {intent.value} (confidence: {confidence:.2f})")
        return processed
    
    def _clean_query(self, query: str) -> str:
        """Clean and normalize query."""
        # Remove extra whitespace
        cleaned = " ".join(query.split())
        # Remove common filler words
        fillers = ["please", "can you", "could you", "would you", "tell me"]
        for filler in fillers:
            cleaned = re.sub(rf"\b{filler}\b", "", cleaned, flags=re.IGNORECASE)
        return " ".join(cleaned.split())
    
    def _detect_intent(self, query: str) -> Tuple[QueryIntent, float]:
        """Detect query intent using pattern matching."""
        query_lower = query.lower()
        
        scores = {}
        for intent, patterns in self.compiled_patterns.items():
            score = 0
            for pattern in patterns:
                if pattern.search(query_lower):
                    score += 1
            if score > 0:
                scores[intent] = score
        
        if scores:
            # Get intent with highest score
            best_intent = max(scores, key=scores.get)
            max_score = scores[best_intent]
            # Normalize confidence
            confidence = min(0.5 + (max_score * 0.15), 0.95)
            return best_intent, confidence
        
        # Default to search intent
        return QueryIntent.SEARCH, 0.5
    
    def _extract_keywords(self, query: str) -> List[str]:
        """Extract important keywords from query."""
        # Simple keyword extraction (can be enhanced with NLP)
        words = query.lower().split()
        
        # Remove stop words
        stop_words = {
            "the", "a", "an", "is", "are", "was", "were", "be", "been",
            "being", "have", "has", "had", "do", "does", "did", "will",
            "would", "could", "should", "may", "might", "must", "shall",
            "can", "need", "dare", "ought", "used", "to", "of", "in",
            "for", "on", "with", "at", "by", "from", "as", "into",
            "through", "during", "before", "after", "above", "below",
            "between", "under", "and", "but", "or", "yet", "so", "if",
            "because", "although", "though", "while", "where", "when",
            "that", "which", "who", "whom", "whose", "what", "this",
            "these", "those", "i", "me", "my", "myself", "we", "our",
            "you", "your", "he", "him", "his", "she", "her", "it",
            "its", "they", "them", "their", "what", "which", "who",
        }
        
        keywords = [w for w in words if w not in stop_words and len(w) > 2]
        
        # Remove duplicates while preserving order
        seen = set()
        unique_keywords = []
        for kw in keywords:
            if kw not in seen:
                seen.add(kw)
                unique_keywords.append(kw)
        
        return unique_keywords
    
    def _extract_filters(self, query: str) -> List[ExtractedFilter]:
        """Extract metadata filters from query."""
        filters = []
        query_lower = query.lower()
        
        # Extract document references
        doc_patterns = [
            r"in\s+(?:the\s+)?(?:document|file|pdf)\s+(?:called|named)?\s*['\"]?(.+?)['\"]?(?:\s|$|\?)",
            r"from\s+(?:the\s+)?(?:document|file|pdf)\s+(?:called|named)?\s*['\"]?(.+?)['\"]?(?:\s|$|\?)",
        ]
        for pattern in doc_patterns:
            match = re.search(pattern, query_lower)
            if match:
                filters.append(ExtractedFilter(
                    field="filename",
                    value=match.group(1).strip(),
                    confidence=0.8,
                    source="explicit"
                ))
        
        # Extract section references
        section_patterns = [
            r"in\s+(?:the\s+)?(?:section|chapter)\s+(?:called|named)?\s*['\"]?(.+?)['\"]?(?:\s|$|\?)",
            r"(?:section|chapter)\s+['\"]?(.+?)['\"]?(?:\s|$|\?)",
        ]
        for pattern in section_patterns:
            match = re.search(pattern, query_lower)
            if match:
                filters.append(ExtractedFilter(
                    field="section_path",
                    value=match.group(1).strip(),
                    confidence=0.85,
                    source="explicit"
                ))
        
        # Extract content type preferences
        content_type_keywords = {
            "table": ["table", "tables", "tabular", "data"],
            "list": ["list", "lists", "bullet", "bullets", "numbered"],
            "code": ["code", "snippet", "function", "programming", "script"],
            "heading": ["heading", "title", "header"],
        }
        for content_type, keywords in content_type_keywords.items():
            for kw in keywords:
                if kw in query_lower:
                    filters.append(ExtractedFilter(
                        field="content_type",
                        value=content_type,
                        confidence=0.6,
                        source="inferred"
                    ))
                    break  # Only add once per content type
        
        # Extract page references
        page_pattern = r"(?:on\s+)?page\s*(\d+)"
        match = re.search(page_pattern, query_lower)
        if match:
            filters.append(ExtractedFilter(
                field="page_number",
                value=int(match.group(1)),
                confidence=0.9,
                source="explicit"
            ))
        
        return filters
    
    def _infer_suggestions(
        self,
        intent: QueryIntent,
        query: str,
        filters: List[ExtractedFilter]
    ) -> Dict[str, Any]:
        """Infer suggested filters based on query intent."""
        suggestions = {}
        
        # Content type suggestions based on intent
        if intent == QueryIntent.PROCEDURE:
            suggestions["content_types"] = ["list", "heading"]
        elif intent == QueryIntent.COMPARISON:
            suggestions["content_types"] = ["table", "list"]
        elif intent == QueryIntent.DEFINITION:
            suggestions["content_types"] = ["heading"]
        elif intent == QueryIntent.LOCATE:
            suggestions["content_types"] = ["heading"]
        
        # Extract section path from filters
        section_filter = next((f for f in filters if f.field == "section_path"), None)
        if section_filter:
            suggestions["section_path"] = section_filter.value
        
        return suggestions
    
    def expand_query(self, processed: ProcessedQuery) -> List[str]:
        """
        Expand query with variations for better retrieval.
        
        Returns list of query variations to try.
        """
        queries = [processed.cleaned_query]
        
        # Add intent-specific variations
        if processed.intent == QueryIntent.DEFINITION:
            # Add variations like "what is X", "X definition", "meaning of X"
            base = processed.cleaned_query
            queries.append(f"definition of {base}")
            queries.append(f"meaning {base}")
        
        elif processed.intent == QueryIntent.PROCEDURE:
            # Add step-related variations
            base = processed.cleaned_query
            queries.append(f"steps to {base}")
            queries.append(f"how to {base}")
        
        return queries


# Global instance
query_processing_service = QueryProcessingService()
