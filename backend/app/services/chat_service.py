"""Chat service for RAG-based conversations using Ollama with query processing and enhanced context building."""

from typing import List, Optional, Dict, Any, AsyncGenerator
from dataclasses import dataclass, field
import aiohttp
import json
from sqlalchemy.orm import Session
from app.services.memory.memory_orchestrator import MemoryOrchestrator
from langchain_core.messages import HumanMessage, AIMessage

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
    session_id: Optional[str] = None
    user_id: Optional[int] = None
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
    
    async def _route_query(self, query: str) -> str:
        """Route the query to a specific state using a fast LLM call."""
        system_prompt = '''You are a routing supervisor. Categorize the user's query into exactly ONE of the following states:
1. 'RAG' - for queries about internal company documents, handbooks, guidelines, onboarding, policies, or general knowledge base.
2. 'PUBLIC_TOOLS' - for weather, currency conversion, live web search, local places/events, Wikipedia, or current time.
3. 'GCP' - for reading/sending emails, Google Calendar, Google Drive, Google Docs.
4. 'COMPOSIO' - for any third-party app integrations like GitHub, Slack, Jira, Notion, Linear.
5. 'GENERAL' - for general greetings, chit-chat, or coding questions that do not require external data.

Respond with ONLY the state name, nothing else (e.g., 'RAG', 'PUBLIC_TOOLS').'''

        try:
            url = f"{self.ollama_base_url}/api/chat"
            payload = {
                "model": self.model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": query}
                ],
                "stream": False,
                "options": {"temperature": 0.0, "num_predict": 10}
            }
            async with aiohttp.ClientSession() as session:
                async with session.post(url, json=payload) as response:
                    if response.status == 200:
                        data = await response.json()
                        content = data.get("message", {}).get("content", "").strip().upper()
                        # Clean up punctuation
                        for char in ["'", '"', ".", "\\n"]:
                            content = content.replace(char, "")
                        
                        valid_states = ["RAG", "PUBLIC_TOOLS", "GCP", "COMPOSIO", "GENERAL"]
                        for state in valid_states:
                            if state in content:
                                return state
                        return "GENERAL"
            return "GENERAL"
        except Exception as e:
            logger.error(f"Routing failed: {e}")
            return "GENERAL"
            
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

If the user is asking a factual question about documents or company knowledge, answer using the provided Context.

TOOL USE RULES (CRITICAL - you MUST follow these):
- If the user asks you to perform ANY action on GitHub, Google, email, calendar, or any connected service, you MUST call the appropriate tool. Do NOT give a text answer instead.
- When calling a tool, ALWAYS use real values from the user's request. NEVER use placeholder values like 'orgName', 'repoName', 'exampleOrg', 'username', '12345', etc.
- If a tool returns a 404 or error, it means the parameters were wrong. Try a DIFFERENT tool or ask the user for clarification. Do NOT retry the same tool with the same fake parameters.
- If the user asks "what is my username" or "show my profile", call GITHUB_GET_THE_AUTHENTICATED_USER with no arguments.
- If the user asks to "list repositories", call GITHUB_LIST_REPOSITORIES_FOR_THE_AUTHENTICATED_USER with no arguments.
- If you are unsure which tool to call, pick the most relevant one from the list and call it. It is better to try a tool than to give a text answer.
- NEVER explain how to do something manually (e.g. "go to github.com and log in") if you have a tool that can do it directly.

Rules:
{rules_str}
- When answering from context, do not invent or assume facts not written in the context.
- If the context does not contain the answer and you cannot use a tool to find it, say exactly: "I don't have that information in my knowledge base."
- Always stay in character as {name}."""

    def _build_user_prompt(self, query: str, context: str) -> str:
        """Build user prompt with context."""
        return f"""Context (if relevant):
{context}

Question/Command: {query}"""
    
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
        request: ChatRequest,
        db: Session = None
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
        
        memory_context = ""
        resolved_query = request.message
        orchestrator = None
        turn_number = 1
        
        if db and request.session_id and request.user_id:
            orchestrator = MemoryOrchestrator(db)
            mem_result = await orchestrator.build_context(request.session_id, request.user_id, request.message)
            memory_context = mem_result.get("context_text", "")
            resolved_query = mem_result.get("resolved_query", request.message)
            
            # Record user message to STM
            stm_history = orchestrator.stm.get_history(request.session_id)
            stm_history.add_message(HumanMessage(content=request.message))
            turn_number = len(stm_history.messages)
            
        request.message = resolved_query


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
            
        # STATE ROUTING
        state = await self._route_query(request.message)
        logger.info(f"State Router determined state: {state}")
        
        results = []
        if state == "RAG":
            # Step 3: Build retrieval query and retrieve results
            retrieval_query = self._build_retrieval_query(request)
            
            if request.include_parent_context and (request.section_path or request.parent_section):
                results = await self.retrieval.retrieve_with_parent_context(
                    retrieval_query,
                    include_parent_summary=True
                )
            else:
                results = await self.retrieval.retrieve(retrieval_query)
        else:
            logger.info(f"Skipping Document RAG because state is {state}")
        
        # Step 4: Build optimized context
        if state == "RAG":
            assembled = self._build_context(results, request)
            if memory_context:
                assembled.context_text = memory_context + "\n\n" + assembled.context_text

            if not results:
                logger.info("No relevant chunks found; letting Persona answer anyway.")
                assembled.context_text = "No relevant context found in the knowledge base."

            logger.info(f"=== RETRIEVED {len(results)} CHUNKS ===")
            for i, r in enumerate(results):
                logger.info(f"  Chunk {i+1}: score={r.score:.3f} | text_preview={r.text[:120].replace(chr(10),' ')!r}")
        else:
            # Create a dummy AssembledContext for non-RAG states
            assembled = AssembledContext(
                context_text=f"Context is not required for {state} state.",
                total_chunks=0,
                total_chars=0,
                estimated_tokens=0,
                sources=[]
            )
            if memory_context:
                assembled.context_text = memory_context + "\n\n" + assembled.context_text

        # Step 5: Build prompts and generate response
        system_prompt = self._build_system_prompt(
            has_hierarchy=bool(request.section_path or request.parent_section)
        )
        user_prompt = self._build_user_prompt(processed.cleaned_query, assembled.context_text)
        response_text = await self._call_ollama(system_prompt, user_prompt, state=state, user_id=request.user_id)
        
        if orchestrator:
            stm_history = orchestrator.stm.get_history(request.session_id)
            stm_history.add_message(AIMessage(content=response_text))
            turn_number = len(stm_history.messages)
            await orchestrator.post_process_message(request.session_id, request.user_id, turn_number, stm_history.messages)

        return ChatResponse(
            response=response_text,
            sources=assembled.sources,
            model=self.model,
        )
    
    def _build_system_prompt_with_hierarchy(self, has_hierarchy: bool = False) -> str:
        return self._build_system_prompt(has_hierarchy)
    
    async def chat_stream(
        self,
        request: ChatRequest,
        db: Session = None
    ) -> AsyncGenerator[str, None]:
        """
        Stream chat response with query processing, RAG, hierarchy, and enhanced context.
        
        Args:
            request: ChatRequest with message, hierarchy, and filters
            
        Yields:
            Chunks of the response
        """
        logger.info(f"Processing streaming chat request: {request.message[:50]}...")
        
        memory_context = ""
        resolved_query = request.message
        orchestrator = None
        turn_number = 1
        
        if db and request.session_id and request.user_id:
            orchestrator = MemoryOrchestrator(db)
            mem_result = await orchestrator.build_context(request.session_id, request.user_id, request.message)
            memory_context = mem_result.get("context_text", "")
            resolved_query = mem_result.get("resolved_query", request.message)
            
            # Record user message to STM
            stm_history = orchestrator.stm.get_history(request.session_id)
            stm_history.add_message(HumanMessage(content=request.message))
            turn_number = len(stm_history.messages)
            
        request.message = resolved_query

        
        # Step 1: Process query
        processed = self._process_query(request)
        
        # Step 2: Apply extracted filters
        if request.use_extracted_filters:
            request = self._apply_extracted_filters(request, processed)
        
        if request.section_path:
            logger.info(f"Section filter: {request.section_path}")
            
        # STATE ROUTING
        state = await self._route_query(request.message)
        logger.info(f"State Router determined state: {state}")
        
        results = []
        if state == "RAG":
            # Step 3: Retrieve results
            retrieval_query = self._build_retrieval_query(request)
            
            if request.include_parent_context and (request.section_path or request.parent_section):
                results = await self.retrieval.retrieve_with_parent_context(
                    retrieval_query,
                    include_parent_summary=True
                )
            else:
                results = await self.retrieval.retrieve(retrieval_query)
        else:
            logger.info(f"Skipping Document RAG because state is {state}")
        
        # Step 4: Build optimized context
        if state == "RAG":
            assembled = self._build_context(results, request)
            if memory_context:
                assembled.context_text = memory_context + "\n\n" + assembled.context_text

            if not results:
                logger.info("No relevant chunks found; letting Persona answer anyway.")
                assembled.context_text = "No relevant context found in the knowledge base."
        else:
            # Create a dummy AssembledContext for non-RAG states
            assembled = AssembledContext(
                context_text=f"Context is not required for {state} state.",
                total_chunks=0,
                total_chars=0,
                estimated_tokens=0,
                sources=[]
            )
            if memory_context:
                assembled.context_text = memory_context + "\n\n" + assembled.context_text

        # Step 5: Build prompts and stream
        system_prompt = self._build_system_prompt(
            has_hierarchy=bool(request.section_path or request.parent_section)
        )
        user_prompt = self._build_user_prompt(processed.cleaned_query, assembled.context_text)


        full_response = ""
        async for chunk in self._call_ollama_stream(system_prompt, user_prompt, state=state, user_id=request.user_id):
            full_response += chunk
            yield chunk
            
        if orchestrator:
            stm_history = orchestrator.stm.get_history(request.session_id)
            stm_history.add_message(AIMessage(content=full_response))
            turn_number = len(stm_history.messages)
            await orchestrator.post_process_message(request.session_id, request.user_id, turn_number, stm_history.messages)

    
    def _get_credentials_map(self, state: str = "GENERAL", user_id: Optional[int] = None) -> Dict[str, str]:
        """Fetches unlocked credentials, isolated strictly by the active State."""
        creds_map = {}
        
        # Tools are completely disabled for RAG and GENERAL states
        if state in ("GENERAL", "RAG"):
            return creds_map
            
        try:
            from app.db.database import SessionLocal
            from app.models.tenant import TenantMcpConfig, McpIntegration
            from app.models.user import User
            
            with SessionLocal() as db:
                if user_id:
                    user = db.query(User).filter(User.id == user_id).first()
                    if user:
                        configs = db.query(TenantMcpConfig).join(McpIntegration).filter(
                            TenantMcpConfig.isEnabled == True,
                            TenantMcpConfig.tenantId == user.tenant_id
                        ).all()
                    else:
                        configs = []
                else:
                    configs = db.query(TenantMcpConfig).join(McpIntegration).filter(
                        TenantMcpConfig.isEnabled == True
                    ).all()
                
                for config in configs:
                    provider = config.mcp_integration.provider if hasattr(config, 'mcp_integration') else None
                    # Fallback query if relationship is not configured
                    if not provider:
                        integration = db.query(McpIntegration).filter(McpIntegration.id == config.mcpId).first()
                        provider = integration.provider if integration else None
                        
                    if not provider:
                        continue
                        
                    if state == "GCP" and provider == "taylorwilsdon/google_workspace_mcp":
                        creds_map[provider] = config.credentials
                    elif state == "COMPOSIO" and provider == "composio":
                        import os
                        import json
                        api_key = os.environ.get("COMPOSIO_API_KEY", "ak_HlT2qEnTnTXF1OGcHMEG")
                        creds_map["composio"] = json.dumps({
                            "api_key": api_key,
                            "user_id": config.composioUserId,
                            "apps": []
                        })
                        
                logger.info(f"[ToolRegistry] Credentials mapped for state {state}: {list(creds_map.keys())}")
        except Exception as e:
            logger.error(f"[ToolRegistry] Failed to fetch credentials from DB: {e}")
            import traceback
            traceback.print_exc()
            
        # For PUBLIC_TOOLS state — only enable public integrations the tenant has turned ON
        if state == "PUBLIC_TOOLS":
            try:
                from importlib import import_module
                from app.db.database import SessionLocal as _SL
                from app.models.tenant import TenantMcpConfig as _TCC, McpIntegration as _MI
                from app.models.user import User as _User
                import json as _json

                with _SL() as _db:
                    if user_id:
                        # Find all public integrations enabled for this specific user via tenant
                        _TU = getattr(import_module("app.models.user"), "TenantUser", None)
                        if _TU:
                            t_configs = _db.query(_TCC).join(_MI).join(_TU, _TU.tenantId == _TCC.tenantId).filter(
                                _MI.provider == "public",
                                _TCC.isEnabled == True,
                                _TU.id == user_id
                            ).all()
                        else:
                            t_configs = []
                    else:
                        t_configs = _db.query(_TCC).join(_MI).filter(
                            _MI.provider == "public",
                            _TCC.isEnabled == True
                        ).all()
                    # Find all public integrations that are enabled for this tenant
                    enabled_public = (
                        _db.query(_MI)
                        .join(_TCC, _TCC.mcpId == _MI.id)
                        .filter(_MI.provider == "public", _TCC.isEnabled == True)
                        .all()
                    )
                    if enabled_public:
                        enabled_names = [i.name for i in enabled_public]
                        creds_map["public"] = _json.dumps({"enabled": enabled_names})
                        logger.info(f"[ToolRegistry] PUBLIC_TOOLS enabled integrations: {enabled_names}")
                    else:
                        logger.info("[ToolRegistry] No public integrations are enabled in DB — skipping public adapter.")
            except Exception as _e:
                logger.error(f"[ToolRegistry] Failed to query public integration toggles: {_e}")
                # Safe fallback: no public tools if we can't read the DB

        return creds_map

    async def _call_ollama(
        self,
        system_prompt: str,
        user_prompt: str,
        state: str = "GENERAL",
        user_id: Optional[int] = None
    ) -> str:
        """Call Ollama API for completion using /api/chat with modular tool support."""
        from app.services.tools import tool_registry_service
        url = f"{self.ollama_base_url}/api/chat"

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]

        creds_map = self._get_credentials_map(state=state, user_id=user_id)
        tool_registry_service.load_adapters(creds_map)

        # Pass the raw user query — ComposioAdapter extracts keywords internally
        # so Stage-2 can do targeted search on top of the Stage-1 baseline tools.
        user_query = user_prompt.split("Question/Command:")[-1].strip() if "Question/Command:" in user_prompt else user_prompt
        tools_list = await tool_registry_service.get_all_tools(query=user_query)
        
        if tools_list:
            logger.info(f"[ToolRegistry] {len(tools_list)} tools available for this request.")
        else:
            logger.warning("[ToolRegistry] No tools available for this request.")

        for _ in range(5):  # Max 5 agentic tool-call loops
            payload = {
                "model": self.model,
                "messages": messages,
                "stream": False,
                "options": {
                    "temperature": 0.1,
                    "top_p": settings.LLM_TOP_P,
                    "num_predict": 1024,
                }
            }
            if tools_list:
                payload["tools"] = tools_list

            try:
                async with aiohttp.ClientSession() as session:
                    async with session.post(url, json=payload) as response:
                        if response.status != 200:
                            error_text = await response.text()
                            raise Exception(f"Ollama API error: {error_text}")

                        data = await response.json()
                        response_msg = data.get("message", {})

                        if response_msg.get("tool_calls"):
                            messages.append(response_msg)
                            for tc in response_msg["tool_calls"]:
                                fn   = tc["function"]
                                name = fn["name"]
                                args = fn.get("arguments", {})
                                logger.info(f"[ToolRegistry] Executing tool: {name} with args: {args}")
                                tool_result = await tool_registry_service.execute_tool(name, args)
                                logger.info(f"[ToolRegistry] Tool result: {tool_result[:200]}")
                                messages.append({"role": "tool", "content": tool_result})
                            continue

                        return response_msg.get("content", "")
            except Exception as e:
                logger.error(f"Ollama API call failed: {e}")
                return f"Error: Failed to get response from LLM. {str(e)}"

        return "Error: Exceeded maximum tool call iterations."
    
    async def _call_ollama_stream(
        self,
        system_prompt: str,
        user_prompt: str,
        state: str = "GENERAL",
        user_id: Optional[int] = None
    ):
        """Call Ollama API for streaming completion using /api/chat with modular tool support."""
        from app.services.tools import tool_registry_service
        url = f"{self.ollama_base_url}/api/chat"

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]

        creds_map = self._get_credentials_map(state=state, user_id=user_id)
        tool_registry_service.load_adapters(creds_map)

        user_query = user_prompt.split("Question/Command:")[-1].strip() if "Question/Command:" in user_prompt else user_prompt
        tools_list = await tool_registry_service.get_all_tools(query=user_query)

        for _ in range(5):
            payload = {
                "model": self.model,
                "messages": messages,
                "stream": False,  # Keep false for tool resolution
                "options": {
                    "temperature": 0.1,
                    "top_p": settings.LLM_TOP_P,
                    "num_predict": 1024,
                }
            }
            if tools_list:
                payload["tools"] = tools_list

            try:
                async with aiohttp.ClientSession() as session:
                    async with session.post(url, json=payload) as response:
                        if response.status != 200:
                            error_text = await response.text()
                            yield f"Error: Ollama API error: {error_text}"
                            return

                        data = await response.json()
                        response_msg = data.get("message", {})

                        if response_msg.get("tool_calls"):
                            messages.append(response_msg)
                            for tc in response_msg["tool_calls"]:
                                fn   = tc["function"]
                                name = fn["name"]
                                args = fn.get("arguments", {})
                                logger.info(f"[ToolRegistry] Executing tool: {name}")
                                yield f"\n\n*⚙️ Calling Tool: {name}...*\n\n"
                                tool_result = await tool_registry_service.execute_tool(name, args)
                                logger.info(f"[ToolRegistry] Tool result: {tool_result[:200]}")
                                messages.append({"role": "tool", "content": tool_result})
                            continue

                        content = response_msg.get("content", "")
                        chunk_size = 5
                        for i in range(0, len(content), chunk_size):
                            yield content[i:i + chunk_size]
                        return

            except Exception as e:
                logger.error(f"Ollama streaming failed: {e}")
                yield f"Error: Failed to stream from LLM. {str(e)}"
                return
    
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
