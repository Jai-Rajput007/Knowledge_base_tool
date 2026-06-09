from typing import List, Optional, Dict, Any
import json
import math
import re
from sqlalchemy.orm import Session
from datetime import datetime


def _cosine_distance(a: List[float], b: List[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    mag_a = math.sqrt(sum(x * x for x in a))
    mag_b = math.sqrt(sum(x * x for x in b))
    if mag_a == 0 or mag_b == 0:
        return 1.0
    return 1.0 - dot / (mag_a * mag_b)

from app.models.memory_fact import MemoryFact
from app.services.embedding_service_optimized import embedding_service_optimized
from app.services.llm_service import llm_service
from app.core.logging import logger

from langgraph.store.base import BaseStore

class LTMService:
    """Long-term memory service for cross-session fact retention."""
    
    def __init__(self, db: Session, store: Optional[BaseStore] = None):
        self.db = db
        self.embedding_service = embedding_service_optimized
        self.store = store

    async def add_fact(self, user_id: int, fact_text: str, fact_type: str, confidence: float = 1.0, session_id: Optional[str] = None, is_update: bool = False):
        """Add a new fact to LTM with intelligent deduplication and update support."""
        if not session_id:
            session_id = None
        
        try:
            # 1. Generate embedding for the new fact
            embedding = await self.embedding_service.embed_query_async(fact_text)
            
            # 2. Search for existing similar facts of the SAME type and get distance
            candidates = self.db.query(MemoryFact).filter(
                MemoryFact.user_id == user_id,
                MemoryFact.fact_type == fact_type,
                MemoryFact.is_active == True
            ).all()
            similar_facts = []
            for fact in candidates:
                if fact.embedding:
                    dist = _cosine_distance(embedding, json.loads(fact.embedding))
                    similar_facts.append((fact, dist))
            similar_facts.sort(key=lambda x: x[1])
            similar_facts = similar_facts[:3]
            
            if similar_facts:
                best_match, distance = similar_facts[0]
                similarity = 1.0 - (distance if distance is not None else 1.0)
                
                if similarity > 0.70:
                    if is_update or (similarity > 0.85):
                        # If explicitly an update, or very high similarity, overwrite/archive
                        if is_update:
                            logger.info(f"Updating fact {best_match.id} with new information: {fact_text}")
                            best_match.fact_text = fact_text
                            best_match.embedding = json.dumps(embedding)
                            best_match.confidence = confidence
                            best_match.last_accessed = datetime.utcnow()
                            best_match.access_count += 1
                            self.db.commit()
                            return best_match
                        else:
                            # Just update confidence and timestamp for duplicates
                            best_match.confidence = max(best_match.confidence, confidence)
                            best_match.last_accessed = datetime.utcnow()
                            best_match.access_count += 1
                            self.db.commit()
                            return best_match
            
            # 3. Conflict detection for updates
            if is_update and fact_type in ["biographical", "preference"]:
                old_facts = self.db.query(MemoryFact).filter(
                    MemoryFact.user_id == user_id,
                    MemoryFact.fact_type == fact_type,
                    MemoryFact.is_active == True
                ).all()
                for old in old_facts:
                    # Basic conflict detection: if it's about the same subject
                    if any(word in old.fact_text.lower() for word in ["lives", "location", "address", "name", "call me"]):
                         old.is_active = False
                         logger.info(f"Archived old fact {old.id} due to update")

            # 4. Save new fact to SQLite
            new_fact = MemoryFact(
                user_id=user_id,
                fact_text=fact_text,
                embedding=json.dumps(embedding),
                fact_type=fact_type,
                confidence=confidence,
                source_session_id=session_id
            )
            self.db.add(new_fact)
            self.db.commit()
            self.db.refresh(new_fact)
            
            # 6. Save to LangGraph Native Store (for native graph access)
            if self.store:
                try:
                    import asyncio
                    loop = asyncio.get_event_loop()
                    # Because add_fact is async, we can just await
                    await self.store.aput(
                        ("facts", str(user_id)),
                        str(new_fact.id),
                        {
                            "fact": fact_text,
                            "fact_type": fact_type,
                            "confidence": confidence,
                            "source_session_id": session_id,
                            "created_at": datetime.utcnow().isoformat()
                        }
                    )
                    logger.info(f"Saved fact {new_fact.id} to Native Store for user {user_id}")
                except Exception as store_e:
                    logger.error(f"Failed to save fact to Native Store: {store_e}")
            
            logger.info(f"Added new fact {new_fact.id} for user {user_id}")
            return new_fact
            
        except Exception as e:
            logger.error(f"Failed to add fact: {e}")
            self.db.rollback()
            raise

    async def retrieve_relevant_facts(self, user_id: int, query: str, top_k: int = 5) -> List[MemoryFact]:
        """Retrieve relevant facts from ChromaDB with fallback threshold."""
        try:
            logger.info(f"Retrieving facts for user {user_id} with query: {query}")
            embedding = await self.embedding_service.embed_query_async(query)
            
            all_facts = self.db.query(MemoryFact).filter(
                MemoryFact.user_id == user_id,
                MemoryFact.is_active == True
            ).all()
            scored = []
            for fact in all_facts:
                if fact.embedding:
                    dist = _cosine_distance(embedding, json.loads(fact.embedding))
                    if dist < 0.65:
                        scored.append((fact, dist))
            scored.sort(key=lambda x: x[1])
            db_facts = [f for f, _ in scored[:top_k]]

            if not db_facts:
                return []

            logger.info(f"Found {len(db_facts)} similar facts")
            
            # Update last_accessed
            for fact in db_facts:
                fact.last_accessed = datetime.utcnow()
                fact.access_count += 1
            self.db.commit()
            
            return db_facts
        except Exception as e:
            logger.error(f"Failed to retrieve facts: {e}")
            return []

    async def extract_facts_from_chat(self, user_id: int, session_id: str, messages: List[Dict[str, str]], user_name: str = "The user"):
        """Extract facts from recent chat messages using LLM."""
        try:
            # Format last few messages for extraction (increase to 10 for better context)
            history_text = ""
            for msg in messages[-10:]:
                role = "User" if msg['role'] == "user" else "Assistant"
                history_text += f"{role}: {msg['content']}\n"
            
            prompt = f"""
            Task: Extract EXACT personal facts from the conversation.
            
            Conversation:
            {history_text}
            
            CRITICAL RULES:
            1. Return ONLY a valid JSON object with a "facts" array.
            2. GROUNDED EXTRACTION ONLY: Extract facts ONLY if explicitly stated.
            3. NO PRONOUNS: You MUST replace "I", "my", "he", "she", "the user" with the ACTUAL name of the person if known from the conversation. 
               - The current speaker's active profile name is: "{user_name}"
               - If the speaker says "I" or "my", use "{user_name}" instead.
               - BAD: "The user likes volleyball."
               - GOOD: "{user_name} likes volleyball."
            4. ABSOLUTE SPECIFICITY (FULL SENTENCES): Return facts as full, self-contained sentences.
            
            Schema:
            {{
              "facts": [
                {{
                  "subject_name": "The actual name of the person (e.g., 'Keshav', 'Anil'). Never use 'self' or 'the user'.",
                  "fact": "A complete, self-contained sentence describing the explicit detail (e.g. 'Anil lives in Chennai')",
                  "type": "biographical|preference|interest|project",
                  "confidence": 0.9,
                  "is_update": false
                }}
              ]
            }}
            """
            
            response_text = llm_service.chat(
                user_message=prompt,
                system_prompt="You are a strict data extraction engine. You NEVER hallucinate. You ONLY output a raw JSON object.",
                format="json"
            )
            
            # Clean up markdown if present
            clean_text = response_text.strip()
            if clean_text.startswith("```json"):
                clean_text = clean_text[7:]
            elif clean_text.startswith("```"):
                clean_text = clean_text[3:]
            if clean_text.endswith("```"):
                clean_text = clean_text[:-3]
            
            # Use regex to find a JSON block (array or object)
            json_match = re.search(r"(\[.*\]|\{.*\})", clean_text, re.DOTALL)
            if not json_match:
                logger.error(f"No JSON found in LLM response: {response_text}")
                return 0
                
            clean_json = json_match.group(1)
            
            try:
                data = json.loads(clean_json)
                
                def find_facts_list(obj):
                    if isinstance(obj, dict) and "facts" in obj and isinstance(obj["facts"], list):
                        return obj["facts"]
                    if isinstance(obj, list):
                        # Verify if elements are dicts with 'fact' key
                        if obj and isinstance(obj[0], dict) and "fact" in obj[0]:
                            return obj
                        # If it's a list of something else, keep looking
                        for item in obj:
                            res = find_facts_list(item)
                            if res: return res
                    elif isinstance(obj, dict):
                        # Standard dict search
                        for k, v in obj.items():
                            res = find_facts_list(v)
                            if res: return res
                    return None

                extracted_facts = find_facts_list(data)
                
                # If we found nothing but it's a single fact dict, wrap it
                if not extracted_facts and isinstance(data, dict) and "fact" in data:
                    extracted_facts = [data]
                
                if not extracted_facts:
                    # If it's an empty object or list, just return 0
                    return 0
                
                logger.info(f"Extracted {len(extracted_facts)} facts for session {session_id}:")
                
                from app.models.user import User
                
                for fact_data in extracted_facts:
                    if not isinstance(fact_data, dict): continue
                    fact_str = fact_data.get("fact", "")
                    subject_name = fact_data.get("subject_name", "self")
                    if not fact_str: continue
                    
                    target_user_id = user_id
                    if subject_name and subject_name.lower() not in ["self", "the user", "me", "i"]:
                        if not fact_str.lower().startswith(subject_name.lower()):
                            fact_str = f"Regarding {subject_name}: {fact_str}"
                    
                    logger.info(f"  -> Extracted Fact for user {target_user_id}: '{fact_str}' (Type: {fact_data.get('type')})")
                    await self.add_fact(
                        user_id=target_user_id,
                        fact_text=fact_str,
                        fact_type=fact_data.get("type", "knowledge"),
                        confidence=fact_data.get("confidence", 0.9),
                        session_id=session_id,
                        is_update=fact_data.get("is_update", False)
                    )
                return len(extracted_facts)
            except json.JSONDecodeError:
                logger.error(f"Failed to parse LLM response as JSON: {clean_json}")
                return 0
                
        except Exception as e:
            logger.error(f"Failed to extract facts: {e}")
            return 0
