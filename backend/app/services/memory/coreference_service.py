from typing import List, Dict, Any, Optional
import re
from app.services.llm_service import llm_service
from app.core.logging import logger

class CoreferenceService:
    """Service for entity tracking and pronoun resolution."""
    
    def __init__(self):
        pass

    async def resolve(self, query: str, history: List[Dict[str, str]]) -> str:
        """
        Resolve pronouns in the query based on conversation history.
        Example: "Why is it popular?" -> "Why is Python popular?"
        """
        if not history:
            return query
            
        # Check if query likely contains pronouns or location references
        pronouns = ["it", "they", "them", "this", "that", "those", "he", "she", "him", "her", "here", "there"]
        
        # Use regex to match whole words regardless of punctuation
        pattern = r'\b(?:' + '|'.join(pronouns) + r')\b'
        if not re.search(pattern, query.lower()):
            return query
            
        try:
            # Format history
            history_text = "\n".join([f"{msg['role'].capitalize()}: {msg['content']}" for msg in history[-6:]])
            
            prompt = f"""
            Task: Coreference Resolution
            Given the conversation history, rewrite the LATEST USER QUERY to replace ALL pronouns (like "it", "they", "this", "that", "he", "she", "him", "her") with the actual names, places, or objects they refer to.
            
            Example 1:
            History: User: Do you know about Python? AI: Yes.
            Query: What is the stable version of it?
            Resolved: What is the stable version of Python?
            
            Example 2:
            History: User: I live in Rau. AI: Nice place.
            Query: How is the weather there?
            Resolved: How is the weather in Rau?
            
            Current Conversation:
            {history_text}
            
            LATEST USER QUERY: {query}
            
            Resolved Query (return ONLY the rewritten query text):
            """
            
            resolved_query = llm_service.chat(
                user_message=prompt,
                system_prompt="You are a linguistic expert. You rewrite queries to be perfectly clear by resolving all pronouns. Return ONLY the resolved text."
            )
            
            resolved_query = resolved_query.strip().strip('"')
            if resolved_query:
                logger.info(f"Resolved coreference: '{query}' -> '{resolved_query}'")
                return resolved_query
            return query
            
        except Exception as e:
            logger.error(f"Coreference resolution failed: {e}")
            return query
