from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session

from app.services.memory.stm_service import STMManager
from app.services.memory.ltm_service import LTMService
from app.services.memory.summarization_service import SummarizationService
from app.services.memory.coreference_service import CoreferenceService
from app.core.logging import logger

from langgraph.store.base import BaseStore

class MemoryOrchestrator:
    """Central hub for coordinating all memory layers."""
    
    def __init__(self, db: Session, store: Optional[BaseStore] = None):
        self.db = db
        self.store = store
        self.stm = STMManager(db)
        self.ltm = LTMService(db, store=self.store)
        self.summarizer = SummarizationService(db)
        self.coref = CoreferenceService()

    async def build_context(self, session_id: str, user_id: int, query: str) -> Dict[str, Any]:
        """
        Build a comprehensive context string from all memory layers.
        Returns a dict with 'context_text' and 'resolved_query'.
        
        STM window: last 15 full turns (30 messages) are loaded.
        Coreference resolution uses the full 15-turn history.
        LLM prompt context uses the last 15 turns (to match STM window).
        """
        try:
            # 1. Get STM history — last 15 full turns (30 messages)
            stm_history = self.stm.get_context(session_id, k=15)
            history_dicts = [
                {"role": "user" if msg.type == "human" else "assistant", "content": msg.content}
                for msg in stm_history
            ]
            
            # 2. Resolve Coreferences using full 15-turn history
            #    e.g. "How is the weather here?" -> "How is the weather in Indore?"
            resolved_query = await self.coref.resolve(query, history_dicts)
            logger.info(f"Resolved query for memory search: '{query}' -> '{resolved_query}'")
            
            # 3. Format STM text — pass ALL 15 turns to LLM prompt (not just last 4)
            stm_text = ""
            if stm_history:
                stm_text = "Recent conversation history:\n"
                for msg in stm_history:
                    role = "User" if msg.type == "human" else "Assistant"
                    stm_text += f"{role}: {msg.content}\n"
            
            # 4. Get LTM facts relevant to the resolved query
            ltm_facts = await self.ltm.retrieve_relevant_facts(user_id, resolved_query, top_k=5)
            logger.info(f"Retrieved {len(ltm_facts)} LTM facts for context")
            ltm_text = ""
            if ltm_facts:
                ltm_text = "Persistent facts about the user and project:\n"
                for fact in ltm_facts:
                    ltm_text += f"- {fact.fact_text}\n"
            
            # 5. Get latest session summary
            latest_summary = await self.summarizer.get_latest_summary(session_id)
            summary_text = ""
            if latest_summary:
                summary_text = f"Previous conversation summary: {latest_summary}\n"
            
            # Combine all layers
            full_context = ""
            if ltm_text:
                full_context += ltm_text + "\n"
            if summary_text:
                full_context += summary_text + "\n"
            if stm_text:
                full_context += stm_text
                
            return {
                "context_text": full_context,
                "resolved_query": resolved_query
            }
            
        except Exception as e:
            logger.error(f"Error building memory context: {e}")
            return {"context_text": "", "resolved_query": query}

    async def post_process_message(self, session_id: str, user_id: int, turn_number: int, messages: List[Any] = None):
        """
        Run background tasks after an assistant response.
        NOTE: Fact extraction (LTM) and Summarization have been disabled per user request.
        The system now relies entirely on FRS summaries for the physical robot, and stateless chat (STM only) for the web.
        """
        # Only trigger after assistant responses (even turn numbers)
        if turn_number % 2 != 0:
            return

        exchange_count = turn_number // 2
        
        try:
            # 1. Fact extraction (every exchange) - DISABLED
            # await self.ltm.extract_facts_from_chat(...)
            
            # 2. Summarization (every 10 full exchanges) - DISABLED
            # await self.summarizer.summarize_recent_turns(...)
            
            # 3. Archival Summarization (every 30 full exchanges) - DISABLED
            # await self.summarizer.archive_session_summary(...)
            
            pass # No post-processing needed currently
                
        except Exception as e:
            logger.error(f"Error in memory post-processing: {e}")
