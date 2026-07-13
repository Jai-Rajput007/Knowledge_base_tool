import httpx
import json
import logging
import os
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.persona import Persona, PersonaVersion

router = APIRouter()
logger = logging.getLogger(__name__)

from app.core.config import settings

ROBOT_SYNC_URL = f"http://{settings.ROBOT_SYNC_HOST}:{settings.ROBOT_SYNC_PORT}"

@router.get("/persona")
async def get_active_persona(db: Session = Depends(get_db)):
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            response = await client.get(f"{ROBOT_SYNC_URL}/persona")
            if response.status_code == 200:
                data = response.json()
                data["_source"] = "robot"
                return data
    except Exception as e:
        logger.warning(f"Robot unreachable: {e}")

    active_persona = db.query(Persona).filter(Persona.isActive == True).order_by(Persona.updatedAt.desc()).first()
    if active_persona:
        try:
            rules = json.loads(active_persona.conversationRules)
        except:
            rules = []
            
        return {
            "identity": {
                "name": active_persona.robotName,
                "company": active_persona.robotCompany,
                "location": active_persona.robotLocation,
                "role": active_persona.robotRole,
            },
            "system_prompt": active_persona.systemPrompt,
            "conversation_rules": rules,
            "_db_id": active_persona.id,
            "_version": active_persona.version,
            "_source": "db",
            "_warning": "Robot unreachable — showing last saved config"
        }
        
    raise HTTPException(status_code=404, detail="No persona found")

@router.post("/persona")
async def update_active_persona(payload: Dict[Any, Any] = Body(...), db: Session = Depends(get_db)):
    identity = payload.get("identity", {})
    rules = payload.get("conversation_rules", [])
    
    robot_payload = {
        "identity": identity,
        "system_prompt": payload.get("system_prompt", ""),
        "conversation_rules": rules
    }
    
    robot_synced = False
    robot_message = ""
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.post(f"{ROBOT_SYNC_URL}/persona", json=robot_payload)
            if response.status_code == 200:
                robot_synced = True
                robot_message = "Persona hot-reloaded on robot — active immediately"
            else:
                robot_message = f"Robot sync failed: {response.status_code}"
    except Exception as e:
        robot_message = "Robot unreachable — saved to DB only"

    existing = db.query(Persona).filter(Persona.isActive == True).first()
    db_version = 1
    
    if existing:
        existing.robotName = identity.get("name", existing.robotName)
        existing.robotCompany = identity.get("company", existing.robotCompany)
        existing.robotLocation = identity.get("location", existing.robotLocation)
        existing.robotRole = identity.get("role", existing.robotRole)
        existing.systemPrompt = payload.get("system_prompt", existing.systemPrompt)
        existing.conversationRules = json.dumps(rules)
        existing.version += 1
        existing.syncStatus = "synced" if robot_synced else "pending"
        db_version = existing.version
    else:
        new_persona = Persona(
            name="Main Robot Persona",
            robotName=identity.get("name", "Jarvis"),
            robotCompany=identity.get("company", ""),
            robotLocation=identity.get("location", ""),
            robotRole=identity.get("role", ""),
            systemPrompt=payload.get("system_prompt", ""),
            conversationRules=json.dumps(rules),
            syncStatus="synced" if robot_synced else "pending"
        )
        db.add(new_persona)
        db.flush()
        db_version = new_persona.version
        
    db.commit()
    
    return {
        "success": True,
        "robot_synced": robot_synced,
        "message": robot_message,
        "version": db_version
    }

@router.get("/")
async def list_personas(db: Session = Depends(get_db)):
    personas = db.query(Persona).all()
    return personas

@router.post("/")
async def create_persona(payload: Dict[Any, Any] = Body(...), db: Session = Depends(get_db)):
    payload["isActive"] = False
    new_persona = Persona(**payload)
    db.add(new_persona)
    db.commit()
    db.refresh(new_persona)
    return new_persona

@router.put("/{id}")
async def update_persona(id: str, payload: Dict[Any, Any] = Body(...), db: Session = Depends(get_db)):
    persona = db.query(Persona).filter(Persona.id == id).first()
    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found")
    
    for key, value in payload.items():
        if hasattr(persona, key):
            setattr(persona, key, value)
            
    db.commit()
    db.refresh(persona)
    return persona

@router.delete("/{id}")
async def delete_persona(id: str, db: Session = Depends(get_db)):
    persona = db.query(Persona).filter(Persona.id == id).first()
    if persona:
        db.delete(persona)
        db.commit()
    return {"success": True}


@router.post("/{id}/deploy")
async def deploy_persona(id: str, db: Session = Depends(get_db)):
    """
    Deploy a saved persona to the robot.
    - Marks it as isActive in the DB
    - Pushes the full persona payload to robot_sync at port 9000
    - robot_sync writes persona.json and sends SIGHUP to main.py for hot-reload
    """
    persona = db.query(Persona).filter(Persona.id == id).first()
    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found")

    # Deactivate all others first
    db.query(Persona).filter(Persona.id != id).update({"isActive": False})
    persona.isActive = True
    db.commit()
    db.refresh(persona)

    try:
        rules = json.loads(persona.conversationRules) if isinstance(persona.conversationRules, str) else (persona.conversationRules or [])
    except Exception:
        rules = []

    robot_payload = {
        "identity": {
            "name":     persona.robotName or "",
            "company":  persona.robotCompany or "",
            "location": persona.robotLocation or "",
            "role":     persona.robotRole or "",
            "voice":    persona.robotVoice or "Male",
        },
        "system_prompt":       persona.systemPrompt or "",
        "conversation_rules":  rules,
        "wake_word":           persona.wakeWord or "hey_jarvis",
    }

    robot_synced = False
    message = ""
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.post(f"{ROBOT_SYNC_URL}/persona", json=robot_payload)
            if response.status_code == 200:
                robot_synced = True
                message = "Persona deployed and hot-reloaded on robot instantly"
                persona.syncStatus = "synced"
            else:
                message = f"robot_sync responded with {response.status_code}"
                persona.syncStatus = "pending"
    except Exception as e:
        message = f"robot_sync unreachable: {e}"
        persona.syncStatus = "pending"
        logger.warning(f"[deploy] {message}")

    db.commit()

    return {
        "success":      True,
        "robot_synced": robot_synced,
        "message":      message,
        "persona_id":   id,
    }

@router.post("/generate")
async def generate_persona(payload: Dict[Any, Any] = Body(...), db: Session = Depends(get_db)):
    name = payload.get("name", "")
    robotName = payload.get("robotName", "")
    role = payload.get("role", "")
    location = payload.get("location", "")
    context = payload.get("context", "")

    prompt = f"""You are an expert AI persona designer. Your task is to generate a comprehensive configuration for a physical robot based on the following user request.
    
User Request:
- Internal Profile Name: {name}
- Robot Name: {robotName}
- Robot Role: {role}
- Location: {location}
- Context/Description: {context}

You must output ONLY raw JSON matching this exact structure:
{{
  "robotName": "{robotName or 'A catchy name for the robot'}",
  "robotCompany": "A suitable company name",
  "robotLocation": "{location}",
  "robotRole": "{role}",
  "systemPrompt": "A highly detailed, 3-5 sentence master instruction prompt dictating the robot's exact personality, tone, and goals.",
  "conversationRules": [
    "Rule 1 about what it must do",
    "Rule 2 about what it must never do",
    "Rule 3 about its communication style",
    "Rule 4 about safety or privacy"
  ]
}}"""

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post("http://127.0.0.1:11434/api/generate", json={
                "model": "qwen2.5:7b",
                "prompt": prompt,
                "stream": False,
                "format": "json"
            })
            
            if response.status_code != 200:
                raise HTTPException(status_code=500, detail=f"Ollama API failed: {response.text}")
                
            result = response.json()
            
            try:
                generated = json.loads(result.get("response", "{}"))
            except:
                raise HTTPException(status_code=500, detail="LLM did not return valid JSON")
                
            new_persona = Persona(
                name=name or f"{generated.get('robotName', 'Robot')} Generated Profile",
                robotName=generated.get('robotName', ''),
                robotCompany=generated.get('robotCompany', ''),
                robotLocation=generated.get('robotLocation', location),
                robotRole=generated.get('robotRole', role),
                systemPrompt=generated.get('systemPrompt', ''),
                conversationRules=json.dumps(generated.get('conversationRules', [])),
                isActive=False,
                syncStatus='not_synced'
            )
            
            db.add(new_persona)
            db.commit()
            db.refresh(new_persona)
            
            return {"success": True, "persona": new_persona}
            
    except Exception as e:
        logger.error(f"Generative persona error: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate persona")
