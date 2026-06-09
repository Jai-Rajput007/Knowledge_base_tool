import json
import re
from typing import Dict, Any, List
from langchain_core.messages import HumanMessage, AIMessage, RemoveMessage

from app.db.database import SessionLocal
from app.graph.state import AgentState
from app.services.llm_service import llm_service
from app.services.embedding_service_optimized import embedding_service_optimized
from app.services.retrieval_service import RetrievalService, RetrievalQuery
from app.models.memory_fact import MemoryFact
from app.models.session_summary import SessionSummary
from app.core.logging import logger
from langgraph.store.base import BaseStore
import uuid

def _extract_json(text: str) -> str:
    """Helper to extract JSON from LLM output safely."""
    text = text.strip()
    # Remove markdown code blocks if present
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    
    # Find the outermost array or object
    start_idx = text.find('[')
    obj_start_idx = text.find('{')
    
    # Pick the one that appears first (and exists)
    if start_idx == -1 and obj_start_idx != -1:
        start_idx = obj_start_idx
    elif start_idx != -1 and obj_start_idx != -1:
        start_idx = min(start_idx, obj_start_idx)
        
    if start_idx != -1:
        end_char = ']' if text[start_idx] == '[' else '}'
        end_idx = text.rfind(end_char)
        if end_idx != -1:
            return text[start_idx:end_idx+1]
            
    return text.strip()

async def entity_extractor_node(state: AgentState, store: BaseStore) -> dict:
    """Detects entity introductions and saves them to native LangGraph Store."""
    messages = state.get("messages", [])
    if not messages: return {}
    last_msg = messages[-1]
    if not isinstance(last_msg, HumanMessage): return {}
    try: user_id = int(state.get("user_id", 0))
    except ValueError: user_id = 0
    if not user_id: return {}
    
    prompt = f"""
    Analyze the following user message. Does the user mention their name and ID (even if misspelled or casually stated)?
    User Message: "{last_msg.content}"
    If they provide ANY name and ANY ID number, return JSON: {{"detected": true, "name": "Their Name", "id": "Their ID"}}
    If they don't provide both, return: {{"detected": false}}
    Return ONLY valid JSON without any markdown formatting or explanation.
    """
    response = llm_service.chat(prompt, system_prompt="Entity extractor. Return JSON.", format="json")
    try:
        data = json.loads(_extract_json(response))
        if isinstance(data, dict) and data.get("detected") and data.get("name") and data.get("id"):
            name = str(data.get("name")).strip()
            emp_id = str(data.get("id")).strip()
            logger.info(f"Entity Memory: Detected name: {name}, id: {emp_id} for user_id: {user_id}")
            
            # Read JSON file to verify employee
            import os
            json_path = os.path.join(os.path.dirname(__file__), "../../../employees.json")
            verified = False
            try:
                with open(json_path, 'r') as f:
                    employees = json.load(f)
                    for emp in employees:
                        if str(emp.get("id")).strip() == emp_id and emp.get("name", "").lower().strip() == name.lower():
                            verified = True
                            name = emp.get("name")  # Use the exact casing from the JSON database
                            break
            except Exception as e:
                logger.error(f"Failed to read employees.json: {e}")
            
            if verified:
                logger.info(f"SUCCESS: Verified Employee {name} (ID: {emp_id})")
                session_id = state.get("session_id", "")
                namespace = ("sessions", str(session_id))
                existing = await store.aget(namespace, "profile")
                profile = existing.value if existing else {}
                profile["name"] = name
                profile["verified"] = True
                profile["last_attempt_failed"] = False
                await store.aput(namespace, "profile", profile)
                
                return {"user_id": str(user_id)}
            else:
                logger.warning(f"FAILURE: Invalid ID or Name match for {name} (ID: {emp_id}). Verification rejected.")
                session_id = state.get("session_id", "")
                namespace = ("sessions", str(session_id))
                existing = await store.aget(namespace, "profile")
                profile = existing.value if existing else {}
                profile["last_attempt_failed"] = True
                await store.aput(namespace, "profile", profile)
    except Exception as e:
        logger.error(f"Failed to extract entity: {e}")
    return {}

def coreference_and_router_node(state: AgentState) -> dict:
    """Resolves pronouns and routes the query."""
    messages = state.get("messages", [])
    if not messages:
        return {"resolved_query": "", "intent": "chat"}
        
    last_msg = messages[-1].content
    history = messages[-5:-1] # Last 4 messages
    
    history_text = ""
    for msg in history:
        role = "User" if isinstance(msg, HumanMessage) else "Assistant"
        history_text += f"{role}: {msg.content}\n"
        
    prompt = f"""
Task: Coreference Resolution and Intent Routing.
You MUST output a valid JSON object EXACTLY matching this schema:
{{
    "resolved_query": "string",
    "intent": "chat" OR "rag_search" OR "clarification_needed"
}}

Rules for resolved_query:
1. Rewrite the LATEST QUERY to resolve any pronouns (it, he, they, there, that) to their actual subjects from the History.
2. PRESERVE ALL INFORMATION: Do not cut off, summarize, or delete any part of the user's sentence. (e.g., If the user says "I'm Jai where do i live?", return "I'm Jai where do I live?").
3. If the LATEST QUERY contains no pronouns or doesn't need context, return the LATEST QUERY EXACTLY AS IT IS. Do NOT truncate it.

Rules for intent:
- "clarification_needed": The query is too vague, ambiguous, or lacks context to be answered.
- "rag_search": The user is asking about documents, knowledge base, technical concepts, or facts that require searching the system.
- "chat": General conversation, greetings, or talking about the user's personal details.

Current Conversation History:
{history_text if history_text else "None"}

LATEST QUERY: {last_msg}

Return ONLY valid JSON.
"""
    
    response = llm_service.chat(
        user_message=prompt,
        system_prompt="You are an expert linguistic router. You only output raw JSON.",
        format="json"
    )
    
    try:
        json_str = _extract_json(response)
        data = json.loads(json_str)
        intent = data.get("intent", "chat")
        resolved = data.get("resolved_query", last_msg)
        return {
            "intent": intent,
            "resolved_query": resolved,
            "requires_clarification": (intent == "clarification_needed")
        }
    except Exception as e:
        logger.error(f"Failed to parse router JSON: {e} - Response: {response}")
        return {"intent": "chat", "resolved_query": last_msg, "requires_clarification": False}


def clarification_node(state: AgentState) -> dict:
    """Generates a polite clarification question."""
    messages = state.get("messages", [])
    resolved = state.get("resolved_query", "")
    
    prompt = f"""
The user asked: "{resolved}"
This query is too vague or ambiguous. Generate a polite, warm, and highly conversational clarification question.
Do not sound robotic. Give a single question back to the user.
"""
    response = llm_service.chat(
        user_message=prompt,
        system_prompt="You are a helpful, warm AI assistant."
    )
    
    return {"messages": [AIMessage(content=response)]}


async def rag_retrieval_node(state: AgentState) -> dict:
    """Retrieves knowledge from Qdrant using hybrid semantic search."""
    resolved_query = state.get("resolved_query", "")
    if not resolved_query:
        return {"retrieved_rag_context": ""}

    try:
        retrieval_service = RetrievalService()
        query = RetrievalQuery(query=resolved_query, top_k=5)
        results = await retrieval_service.retrieve(query)

        context = ""
        if results:
            for r in results:
                context += f"- {r.text}\n"

        return {"retrieved_rag_context": context}
    except Exception as e:
        logger.error(f"RAG retrieval failed: {e}")
        return {"retrieved_rag_context": ""}


async def memory_manager_node(state: AgentState, store: BaseStore) -> dict:
    """Manages Long Term Memory CRUD operations based on the user query."""
    resolved_query = state.get("resolved_query", "")
    try:
        user_id = int(state.get("user_id", 0))
    except ValueError:
        logger.error(f"Invalid user_id in state: {state.get('user_id')}")
        user_id = 0
    session_id = state.get("session_id", "")
    
    if not resolved_query or not user_id:
        return {"retrieved_memory_context": ""}
        
    try:
        # Check if user is verified before accessing memory vault
        session_id = state.get("session_id", "")
        namespace = ("sessions", str(session_id))
        profile_item = await store.aget(namespace, "profile")
        profile = profile_item.value if profile_item else {}
        is_verified = profile.get("verified", False)
        active_name = profile.get("name", "")

        # 1. Query existing memory vectors from Native Store
        facts_namespace = ("facts", str(user_id))
        existing_facts_text = ""
        
        if is_verified and active_name:
            # Vector search strictly for the verified user's facts relevant to the query
            search_query = f"{active_name} {resolved_query}"
            similar_facts = await store.asearch(facts_namespace, query=search_query)
            if similar_facts:
                logger.info(f"Retrieved {len(similar_facts)} verified facts for user {user_id} (Name: {active_name})")
                for r in similar_facts:
                    existing_facts_text += f"ID: {r.key} | Fact: {r.value.get('fact')}\n"
            else:
                logger.info(f"No existing facts found for verified user {active_name} in Native Store")
        else:
            last_failed = profile.get("last_attempt_failed", False)
            if last_failed:
                logger.warning(f"Privacy Block: User {user_id} provided WRONG credentials.")
                return {"retrieved_memory_context": "SYSTEM DIRECTIVE: The user just provided an INCORRECT Employee ID. Inform them: 'You have provided the wrong credentials, I cannot retrieve your private context.' You may still answer general knowledge questions naturally, but completely refuse to answer any questions about their personal details, projects, or other employees."}
            else:
                # Force the assistant to ask for Employee ID for privacy
                logger.warning(f"Privacy Block: User {user_id} attempted memory access without Employee ID verification.")
                return {"retrieved_memory_context": "SYSTEM DIRECTIVE: The user's identity is NOT verified. If they are asking about personal details, projects, or employees, you MUST politely ask them to provide their Name and Employee ID to unlock their memory vault. If they are asking a general knowledge question, answer it normally without asking for their ID."}
                
        # 2. LLM determines CRUD actions
        prompt = f"""
Analyze the user's latest statement and existing memory facts.
User Statement: "{resolved_query}"

Existing Memories:
{existing_facts_text if existing_facts_text else "None"}

You must manage the long-term memory. Output a strict JSON list of actions: "ADD", "UPDATE", or "DELETE".
Example 1: User says "I am Jai, not Chetna". Existing memory: "ID: 1 | Fact: User's name is Chetna".
Output: [
  {{"action": "DELETE", "fact_id": 1}},
  {{"action": "ADD", "fact": "User's name is Jai", "type": "biographical"}}
]

Example 2: User says "I love apples". Existing: None.
Output: [
  {{"action": "ADD", "fact": "User loves apples", "type": "preference"}}
]

Example 3: User says "What is gravity?". (No memory to store)
Output: []

Return ONLY valid JSON array.
"""
        response = llm_service.chat(
            user_message=prompt,
            system_prompt="You are a strict memory manager database agent. Return ONLY raw JSON array.",
            format="json"
        )
        
        json_str = _extract_json(response)
        try:
            actions = json.loads(json_str)
        except json.JSONDecodeError:
            logger.error(f"Failed to decode memory actions: {json_str}")
            actions = []
            
        # Ensure actions is a list of dictionaries
        if isinstance(actions, dict):
            actions = [actions]
        elif not isinstance(actions, list):
            actions = []
        
        with SessionLocal() as db:
            # We no longer do immediate inline extraction here because MemoryOrchestrator 
            # handles it safely after the graph execution, avoiding async/sync SQLAlchemy hazards.
                
            for action in actions:
                if not isinstance(action, dict):
                    continue
                act = action.get("action")
                if act == "ADD":
                    fact_text = action.get("fact")
                    fact_type = action.get("type", "knowledge")
                    if fact_text:
                        fact_id = str(uuid.uuid4())
                        await store.aput(namespace, fact_id, {"fact": fact_text, "type": fact_type})
                elif act == "DELETE":
                    fact_ids = action.get("fact_id")
                    if not isinstance(fact_ids, list):
                        fact_ids = [fact_ids]
                    for fact_id in fact_ids:
                        if fact_id:
                            await store.adelete(namespace, str(fact_id))
                elif act == "UPDATE":
                    fact_id = action.get("fact_id")
                    new_text = action.get("fact")
                    
                    if isinstance(fact_id, list):
                        if not fact_id: continue
                        fact_id = fact_id[0]
                        
                    if fact_id and new_text:
                        await store.aput(namespace, str(fact_id), {"fact": new_text, "type": "updated"})
                            
            # 4. Gather final active memory context
            search_query = f"{active_name} {resolved_query}"
            if is_verified and active_name:
                final_facts = await store.asearch(facts_namespace, query=search_query)
            else:
                final_facts = await store.asearch(facts_namespace, query=resolved_query)
            mem_context = "\n".join([f"- {f.value.get('fact')}" for f in final_facts])
            
        return {"retrieved_memory_context": mem_context}
        
    except Exception as e:
        logger.error(f"Memory management failed: {e}")
        return {"retrieved_memory_context": ""}


async def persona_generator_node(state: AgentState, store: BaseStore) -> dict:
    """Assembles prompt and generates final response using G1 Persona."""
    messages = state.get("messages", [])
    rag_context = state.get("retrieved_rag_context", "")
    mem_context = state.get("retrieved_memory_context", "")
    
    try:
        user_id = int(state.get("user_id", 0))
    except ValueError:
        user_id = 0
        
    profile_text = ""
    if user_id:
        session_id = state.get("session_id", "")
        profile_item = await store.aget(("sessions", str(session_id)), "profile")
        if profile_item and profile_item.value.get("name"):
            profile_text = f"User's name: {profile_item.value['name']}\n"
    
    # Strict Rule: Only inject the last 4 STM messages
    recent_msgs = messages[-4:] if len(messages) >= 4 else messages
    
    context_block = ""
    if profile_text:
        context_block += f"Entity Profile:\n{profile_text}\n\n"
    if mem_context:
        context_block += f"Personal Facts about User:\n{mem_context}\n\n"
    if rag_context:
        context_block += f"Document Knowledge:\n{rag_context}\n\n"
        
    system_prompt = f"""
You are the G1 Assistant, a warm, polite, and highly conversational AI.

MANDATORY RULES:
1. Be an engaging, warm, and highly conversational AI companion.
2. BACKGROUND CONTEXT: You are provided with "Entity Profile" and "Personal Facts" about the user. 
3. DIRECT QUESTIONS: If the user explicitly asks you what you remember about them (e.g., "Do you remember what project I created?", "What are my hobbies?"), you MUST answer them explicitly using the provided Personal Facts.
4. NATURAL CONVERSATION: If they are NOT asking about memory, use the facts silently to personalize the conversation without announcing that you know them.
5. NO HALLUCINATIONS: If you do not know a personal detail about the user, do NOT invent, assume, or guess a value. Just ask them naturally.
6. EXTREMELY CONCISE: Keep responses EXTREMELY concise (1-2 sentences maximum, under 20 words if possible) because you are speaking through a physical robot interface.
7. End your response with a relevant, polite follow-up question ONLY IF it naturally fits the flow of the conversation. Do not force questions.

Context:
{context_block}
"""
    
    # We pass the recent messages formatted to the LLM Provider
    llm_messages = [{"role": "system", "content": system_prompt}]
    for msg in recent_msgs:
        role = "user" if isinstance(msg, HumanMessage) else "assistant"
        llm_messages.append({"role": role, "content": msg.content})
        
    # Note: If streaming is required, this node will be awaited differently.
    # For now, we return the sync string content in the state.
    response = llm_service.provider.chat(llm_messages)
    
    return {"messages": [AIMessage(content=response)]}


async def background_summarizer_node(state: AgentState, store: BaseStore) -> dict:
    """Compresses oldest messages if length > 15."""
    messages = state.get("messages", [])
    session_id = state.get("session_id", "")
    
    if len(messages) <= 15:
        return {}
        
    # Keep the last 10, summarize the rest
    messages_to_summarize = messages[:-10]
    messages_to_keep = messages[-10:]
    
    history_text = "\n".join([f"{'User' if isinstance(m, HumanMessage) else 'Assistant'}: {m.content}" for m in messages_to_summarize])
    
    prompt = f"Summarize the following old conversation concisely:\n\n{history_text}"
    summary = llm_service.chat(prompt, system_prompt="You are a concise summarizer.")
    
    # Compress them and store on long term memory with summary
    try: user_id = int(state.get("user_id", 0))
    except ValueError: user_id = 0
    
    if user_id:
        namespace = ("summaries", str(user_id))
        existing = await store.aget(namespace, session_id)
        if existing:
            new_summary = existing.value.get("summary", "") + f"\nLater: {summary}"
            await store.aput(namespace, session_id, {"summary": new_summary})
        else:
            await store.aput(namespace, session_id, {"summary": summary})
                
    # Return RemoveMessage objects to delete old messages from state
    deletions = [RemoveMessage(id=m.id) for m in messages_to_summarize]
    
    return {"messages": deletions}
