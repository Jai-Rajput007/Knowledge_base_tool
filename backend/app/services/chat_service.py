"""Chat service for RAG-based conversations using Ollama with query processing and enhanced context building."""

from typing import List, Optional, Dict, Any, AsyncGenerator
from dataclasses import dataclass, field
import aiohttp
import json

from app.core.config import settings
from app.core.logging import logger
from app.services.retrieval_service import (
    retrieval_service, RetrievalQuery, RetrievalResult,
    MetadataFilter, FilterOperator, HierarchyQuery
)
from app.services.query_processing_service import (
    query_processing_service, QueryIntent, ProcessedQuery, ExtractedFilter
)
from app.services.context_builder_service import (
    context_builder_service, ContextStrategy, AssembledContext
)


@dataclass
class ChatMessage:
    """Chat message."""
    role: str  # "user" or "assistant"
    content: str
    sources: Optional[List[Dict[str, Any]]] = None


@dataclass
class ChatRequest:
    """Chat request with query processing, hierarchy, and context building support."""
    message: str
    document_ids: Optional[List[str]] = None
    metadata_filters: Optional[Dict[str, Any]] = None
    
    # Query processing
    enable_query_processing: bool = True  # Enable intent detection and filter extraction
    use_extracted_filters: bool = True  # Use filters extracted from query
    
    # Hierarchy retrieval
    section_path: Optional[str] = None
    parent_section: Optional[str] = None
    heading_level: Optional[int] = None
    include_parent_context: bool = True
    
    # Content type filtering
    content_types: Optional[List[str]] = None  # "table", "list", "code", "heading"
    
    # Prefiltering operators
    advanced_filters: List[MetadataFilter] = field(default_factory=list)
    
    # Context building strategy
    context_strategy: str = "hierarchy"  # "standard", "hierarchy", "relevance", "chronological", "compress"
    include_metadata_in_context: bool = True
    include_hierarchy_in_context: bool = True
    
    top_k: int = None
    stream: bool = True
    
    def __post_init__(self):
        if self.top_k is None:
            self.top_k = settings.TOP_K


@dataclass
class ChatResponse:
    """Chat response with answer and sources."""
    response: str
    sources: List[Dict[str, Any]]
    model: str
    tokens_used: Optional[int] = None


class ChatService:
    """Chat service for RAG-based conversations using Ollama with query processing and enhanced context."""
    
    def __init__(self):
        self.ollama_base_url = "http://localhost:11434"
        self.model = settings.LLM_MODEL
        self.retrieval = retrieval_service
        self.query_processor = query_processing_service
        self.context_builder = context_builder_service
    
    def _process_query(self, request: ChatRequest) -> ProcessedQuery:
        """Process user query to extract intent and filters."""
        if not request.enable_query_processing:
            # Return basic processed query without analysis
            return ProcessedQuery(
                original_query=request.message,
                cleaned_query=request.message,
                intent=QueryIntent.SEARCH,
                confidence=0.5
            )
        
        processed = self.query_processor.process_query(request.message)
        logger.info(f"Query intent: {processed.intent.value}, confidence: {processed.confidence:.2f}")
        return processed
    
    def _apply_extracted_filters(self, request: ChatRequest, processed: ProcessedQuery) -> ChatRequest:
        """Apply filters extracted from query to request."""
        if not request.use_extracted_filters or not processed.extracted_filters:
            return request
        
        # Merge extracted filters with explicit filters
        for extracted in processed.extracted_filters:
            if extracted.confidence > 0.7:  # Only high confidence filters
                if extracted.field == "section_path" and not request.section_path:
                    request.section_path = extracted.value
                    logger.info(f"Applied extracted section_path: {extracted.value}")
                elif extracted.field == "content_type" and not request.content_types:
                    request.content_types = [extracted.value]
                    logger.info(f"Applied extracted content_type: {extracted.value}")
        
        # Apply suggested filters from intent analysis
        if processed.suggested_content_types and not request.content_types:
            request.content_types = processed.suggested_content_types
            logger.info(f"Applied suggested content_types: {processed.suggested_content_types}")
        
        return request
    
    def _build_context(self, results: List[RetrievalResult], request: ChatRequest) -> AssembledContext:
        """Build context using specified strategy."""
        strategy_map = {
            "standard": ContextStrategy.STANDARD,
            "hierarchy": ContextStrategy.HIERARCHY,
            "relevance": ContextStrategy.RELEVANCE,
            "chronological": ContextStrategy.CHRONOLOGICAL,
            "compress": ContextStrategy.COMPRESS,
        }
        
        strategy = strategy_map.get(request.context_strategy, ContextStrategy.HIERARCHY)
        
        assembled = self.context_builder.build_context(
            results=results,
            strategy=strategy,
            include_metadata=request.include_metadata_in_context,
            include_hierarchy=request.include_hierarchy_in_context
        )
        
        logger.info(f"Built context with {assembled.total_chunks} chunks, "
                   f"{assembled.total_chars} chars, ~{assembled.estimated_tokens} tokens")
        
        return assembled
    
    _STOP_WORDS = {
        "the", "who", "what", "where", "when", "how", "are", "was", "is",
        "did", "has", "have", "been", "does", "can", "could", "would", "about",
        "tell", "give", "me", "and", "for", "with", "from", "this", "that",
    }

    def _context_is_relevant(self, query: str, results: List[RetrievalResult]) -> bool:
        """Return True only if at least one key query term appears in the retrieved chunks."""
        import re
        key_words = {
            w for w in re.findall(r'\b[a-z]{3,}\b', query.lower())
            if w not in self._STOP_WORDS
        }
        if not key_words:
            return True  # Too short to judge — let KB answer
        combined = " ".join(r.text.lower() for r in results)
        return any(w in combined for w in key_words)

    _GREETINGS = {
        "hi", "hello", "hey", "hii", "helo", "hola",
        "good morning", "good afternoon", "good evening", "good night",
        "hi there", "hey there", "howdy",
    }
    _THANKS = {"thanks", "thank you", "thank u", "ty", "thx", "cheers"}
    _ACKNOWLEDGEMENTS = {"ok", "okay", "got it", "alright", "sure", "great", "nice", "cool"}
    _FAREWELLS = {"bye", "goodbye", "see you", "see ya", "later", "cya"}

    def _chitchat_response(self, message: str) -> str:
        """Return a canned response for greetings/chitchat, or '' to proceed with RAG."""
        import re
        clean = re.sub(r"[^\w\s]", "", message.lower()).strip()
        if clean in self._GREETINGS:
            return "Hello! I'm here to help you with information from the knowledge base. What would you like to know?"
        if clean in self._THANKS:
            return "You're welcome! Let me know if you have any other questions."
        if clean in self._ACKNOWLEDGEMENTS:
            return "Got it! Feel free to ask anything about our knowledge base."
        if clean in self._FAREWELLS:
            return "Goodbye! Feel free to return if you have more questions."
        return ""

    def _build_system_prompt(self, has_hierarchy: bool = False) -> str:
        """Build system prompt for RAG, simulating the Robot Persona."""
        import json
        import os
        
        persona_path = '/home/jai/g1-universe/g1-nlp/config/persona.json'
        identity_str = "You are a helpful document assistant."
        rules_str = ""
        
        if os.path.exists(persona_path):
            try:
                with open(persona_path, 'r') as f:
                    config = json.load(f)
                    identity = config.get("identity", {})
                    name = identity.get("name", "Jarvis")
                    role = identity.get("role", "office assistant robot")
                    company = identity.get("company", "this company")
                    location = identity.get("location", "this office")
                    
                    sys_prompt = config.get("system_prompt", "")
                    rules = config.get("conversation_rules", [])
                    rules_block = "\n".join(f"- {r}" for r in rules) if rules else ""
                    
                    identity_str = f"You are {name}, a {role} working at {company}, located at {location}.\n\nMASTER INSTRUCTIONS:\n{sys_prompt}"
                    rules_str = rules_block
            except Exception as e:
                logger.error(f"Failed to load persona for simulator: {e}")

        return f"""{identity_str}

If the user is asking a factual question about documents or company knowledge, answer ONLY using the provided Context.
If the user is just chatting or asking about your identity, respond naturally according to your persona rules.

Rules:
{rules_str}
- When answering from context, do not invent or assume facts not written in the context.
- For "explain" or "describe" questions, summarize what the context shows.
- For counting questions (e.g. "how many"), count or use numbers that appear in the context.
- Do NOT use filler phrases like "Certainly!" or "Based on the context..."
- If the context does not contain the answer to a factual knowledge question, say exactly: "I don't have that information in my knowledge base."
- Always stay in character as {name}."""

    def _build_user_prompt(self, query: str, context: str) -> str:
        """Build user prompt with context."""
        return f"""Context (use ONLY this to answer — do not use outside knowledge):
{context}

Question: {query}

Answer (only from the context above):"""
    
    def _build_retrieval_query(self, request: ChatRequest) -> RetrievalQuery:
        """Build retrieval query with hierarchy and prefiltering."""
        
        # Build advanced filters from simple metadata_filters
        advanced_filters = list(request.advanced_filters)
        
        if request.metadata_filters:
            for key, value in request.metadata_filters.items():
                advanced_filters.append(MetadataFilter(
                    field=key,
                    value=value,
                    operator=FilterOperator.EQ
                ))
        
        # Build hierarchy query
        hierarchy = None
        if request.section_path or request.parent_section or request.heading_level:
            hierarchy = HierarchyQuery(
                section_path=request.section_path,
                parent_section=request.parent_section,
                heading_level=request.heading_level,
                include_children=True,
                include_parents=request.include_parent_context,
            )
        
        return RetrievalQuery(
            query=request.message,
            top_k=request.top_k,
            document_ids=request.document_ids,
            metadata_prefilters=advanced_filters,
            hierarchy=hierarchy,
            content_types=request.content_types,
        )
    
    async def chat(
        self,
        request: ChatRequest
    ) -> ChatResponse:
        """
        Process chat request with query processing, RAG, hierarchy, and enhanced context building.
        
        Flow:
        1. Process query to extract intent and filters
        2. Apply extracted filters to request
        3. Retrieve relevant chunks
        4. Build optimized context using strategy
        5. Generate response with Ollama
        
        Args:
            request: ChatRequest with message, hierarchy, and filters
            
        Returns:
            ChatResponse with answer and sources
        """
        logger.info(f"Processing chat request: {request.message[:50]}...")

        # Fast path: greetings and chitchat — let the LLM answer using Persona instead of hardcoded bypass.
        # chitchat = self._chitchat_response(request.message)
        # if chitchat:
        #     return ChatResponse(response=chitchat, sources=[], model=self.model)

        # Step 1: Process query to understand intent and extract filters
        processed = self._process_query(request)
        
        # Step 2: Apply extracted filters if enabled
        if request.use_extracted_filters:
            request = self._apply_extracted_filters(request, processed)
        
        if request.section_path:
            logger.info(f"Section filter: {request.section_path}")
        
        # Step 3: Build retrieval query and retrieve results
        retrieval_query = self._build_retrieval_query(request)
        
        if request.include_parent_context and (request.section_path or request.parent_section):
            results = await self.retrieval.retrieve_with_parent_context(
                retrieval_query,
                include_parent_summary=True
            )
        else:
            results = await self.retrieval.retrieve(retrieval_query)
        
        # Step 4: Build optimized context
        assembled = self._build_context(results, request)

        # Step 5: Build prompts and generate response
        if not results:
            logger.info("No relevant chunks found; letting Persona answer anyway.")
            assembled.context_text = "No relevant context found in the knowledge base."

        logger.info(f"=== RETRIEVED {len(results)} CHUNKS ===")
        for i, r in enumerate(results):
            logger.info(f"  Chunk {i+1}: score={r.score:.3f} | text_preview={r.text[:120].replace(chr(10),' ')!r}")
        logger.info(f"=== CONTEXT SENT TO LLM (first 800 chars) ===\n{assembled.context_text[:800]}")

        system_prompt = self._build_system_prompt(
            has_hierarchy=bool(request.section_path or request.parent_section)
        )
        user_prompt = self._build_user_prompt(processed.cleaned_query, assembled.context_text)
        logger.info(f"=== USER PROMPT (first 400 chars) ===\n{user_prompt[:400]}")
        response_text = await self._call_ollama(system_prompt, user_prompt)
        return ChatResponse(
            response=response_text,
            sources=assembled.sources,
            model=self.model,
        )
    
    def _build_system_prompt_with_hierarchy(self, has_hierarchy: bool = False) -> str:
        return self._build_system_prompt(has_hierarchy)
    
    async def chat_stream(
        self,
        request: ChatRequest
    ) -> AsyncGenerator[str, None]:
        """
        Stream chat response with query processing, RAG, hierarchy, and enhanced context.
        
        Args:
            request: ChatRequest with message, hierarchy, and filters
            
        Yields:
            Chunks of the response
        """
        logger.info(f"Processing streaming chat request: {request.message[:50]}...")
        
        # Step 1: Process query
        processed = self._process_query(request)
        
        # Step 2: Apply extracted filters
        if request.use_extracted_filters:
            request = self._apply_extracted_filters(request, processed)
        
        if request.section_path:
            logger.info(f"Section filter: {request.section_path}")
        
        # Step 3: Retrieve results
        retrieval_query = self._build_retrieval_query(request)
        
        if request.include_parent_context and (request.section_path or request.parent_section):
            results = await self.retrieval.retrieve_with_parent_context(
                retrieval_query,
                include_parent_summary=True
            )
        else:
            results = await self.retrieval.retrieve(retrieval_query)
        
        # Step 4: Build optimized context
        assembled = self._build_context(results, request)

        # Short-circuit: no relevant documents found
        if not results:
            logger.info("No relevant chunks found; letting Persona answer anyway.")
            assembled.context_text = "No relevant context found in the knowledge base."

        # Step 5: Build prompts and stream
        system_prompt = self._build_system_prompt(
            has_hierarchy=bool(request.section_path or request.parent_section)
        )
        user_prompt = self._build_user_prompt(processed.cleaned_query, assembled.context_text)

        async for chunk in self._call_ollama_stream(system_prompt, user_prompt):
            yield chunk
    
    async def _call_ollama(
        self,
        system_prompt: str,
        user_prompt: str,
    ) -> str:
        """Call Ollama API for completion."""
        url = f"{self.ollama_base_url}/api/generate"
        
        payload = {
            "model": self.model,
            "prompt": user_prompt,
            "system": system_prompt,
            "stream": False,
            "options": {
                "temperature": 0.1,
                "top_p": settings.LLM_TOP_P,
                "num_predict": 1024,
            }
        }
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(url, json=payload) as response:
                    if response.status != 200:
                        error_text = await response.text()
                        raise Exception(f"Ollama API error: {error_text}")
                    
                    data = await response.json()
                    return data.get("response", "")
        except Exception as e:
            logger.error(f"Ollama API call failed: {e}")
            return f"Error: Failed to get response from LLM. {str(e)}"
    
    async def _call_ollama_stream(
        self,
        system_prompt: str,
        user_prompt: str,
    ) -> AsyncGenerator[str, None]:
        """Stream from Ollama API."""
        url = f"{self.ollama_base_url}/api/generate"
        
        payload = {
            "model": self.model,
            "prompt": user_prompt,
            "system": system_prompt,
            "stream": True,
            "options": {
                "temperature": 0.1,
                "top_p": settings.LLM_TOP_P,
                "num_predict": 1024,
            }
        }
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(url, json=payload) as response:
                    if response.status != 200:
                        error_text = await response.text()
                        yield f"Error: Ollama API error: {error_text}"
                        return
                    
                    async for line in response.content:
                        if line:
                            try:
                                data = json.loads(line)
                                if "response" in data:
                                    yield data["response"]
                                if data.get("done", False):
                                    break
                            except json.JSONDecodeError:
                                continue
        except Exception as e:
            logger.error(f"Ollama streaming failed: {e}")
            yield f"Error: Failed to stream from LLM. {str(e)}"
    
    async def get_available_models(self) -> List[Dict[str, str]]:
        """Get list of available models from Ollama."""
        url = f"{self.ollama_base_url}/api/tags"
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url) as response:
                    if response.status != 200:
                        return [{"id": self.model, "name": self.model}]
                    
                    data = await response.json()
                    models = data.get("models", [])
                    return [
                        {"id": m["name"], "name": m["name"].replace(":latest", "")}
                        for m in models
                    ]
        except Exception as e:
            logger.error(f"Failed to get models: {e}")
            return [{"id": self.model, "name": self.model}]


# Global instance
chat_service = ChatService()
