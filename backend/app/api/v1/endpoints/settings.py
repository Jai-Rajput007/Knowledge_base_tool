"""Settings API endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.db.database import get_db
from app.models.setting import Setting
from app.core.config import settings as app_settings
from app.core.logging import logger

router = APIRouter()


class SettingsResponse(BaseModel):
    """Settings response schema."""
    # General
    autoSave: bool
    showSources: bool
    streamingEnabled: bool
    darkModeDefault: bool
    # LLM
    llmProvider: str
    llmModel: str
    temperature: float
    maxTokens: int
    topP: float
    systemPrompt: str
    # Embedding
    embeddingProvider: str
    embeddingModel: str
    embeddingDimensions: int
    # Chunking
    chunkSize: int
    chunkOverlap: int
    chunkingStrategy: str
    batchSize: int
    # Vector DB
    vectorDbType: str
    topK: int
    similarityThreshold: float


class SettingsUpdate(BaseModel):
    """Settings update schema."""
    autoSave: Optional[bool] = None
    showSources: Optional[bool] = None
    streamingEnabled: Optional[bool] = None
    darkModeDefault: Optional[bool] = None
    llmProvider: Optional[str] = None
    llmModel: Optional[str] = None
    temperature: Optional[float] = None
    maxTokens: Optional[int] = None
    topP: Optional[float] = None
    systemPrompt: Optional[str] = None
    embeddingProvider: Optional[str] = None
    embeddingModel: Optional[str] = None
    embeddingDimensions: Optional[int] = None
    chunkSize: Optional[int] = None
    chunkOverlap: Optional[int] = None
    chunkingStrategy: Optional[str] = None
    batchSize: Optional[int] = None
    vectorDbType: Optional[str] = None
    topK: Optional[int] = None
    similarityThreshold: Optional[float] = None
    openaiApiKey: Optional[str] = None
    anthropicApiKey: Optional[str] = None
    cohereApiKey: Optional[str] = None


@router.get("/", response_model=SettingsResponse)
async def get_settings(db: Session = Depends(get_db)):
    """Get current settings."""
    db_settings = db.query(Setting).first()
    
    if not db_settings:
        # Create default settings
        db_settings = Setting()
        db.add(db_settings)
        db.commit()
        db.refresh(db_settings)
    
    return db_settings.to_dict()


@router.put("/", response_model=SettingsResponse)
async def update_settings(
    settings_update: SettingsUpdate,
    db: Session = Depends(get_db)
):
    """Update settings."""
    db_settings = db.query(Setting).first()
    
    if not db_settings:
        db_settings = Setting()
        db.add(db_settings)
    
    # Update fields
    update_data = settings_update.dict(exclude_unset=True)
    
    # Map frontend names to model fields
    field_mapping = {
        "autoSave": "auto_save_conversations",
        "showSources": "show_source_citations",
        "streamingEnabled": "streaming_enabled",
        "darkModeDefault": "dark_mode_default",
        "llmProvider": "llm_provider",
        "llmModel": "llm_model",
        "temperature": "llm_temperature",
        "maxTokens": "llm_max_tokens",
        "topP": "llm_top_p",
        "systemPrompt": "llm_system_prompt",
        "embeddingProvider": "embedding_provider",
        "embeddingModel": "embedding_model",
        "embeddingDimensions": "embedding_dimensions",
        "chunkSize": "chunk_size",
        "chunkOverlap": "chunk_overlap",
        "chunkingStrategy": "chunking_strategy",
        "batchSize": "batch_size",
        "vectorDbType": "vector_db_type",
        "topK": "top_k",
        "similarityThreshold": "similarity_threshold",
        "openaiApiKey": "openai_api_key",
        "anthropicApiKey": "anthropic_api_key",
        "cohereApiKey": "cohere_api_key",
    }
    
    for frontend_name, model_field in field_mapping.items():
        if frontend_name in update_data:
            setattr(db_settings, model_field, update_data[frontend_name])
    
    db.commit()
    db.refresh(db_settings)
    
    logger.info("Settings updated")
    
    return db_settings.to_dict()

import httpx

@router.get("/voices")
async def get_available_voices():
    """Fetch available TTS voice models from robot_sync."""
    robot_sync_url = f"http://{app_settings.ROBOT_SYNC_HOST}:{app_settings.ROBOT_SYNC_PORT}"
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{robot_sync_url}/tts/models", timeout=5.0)
            resp.raise_for_status()
            return resp.json()
    except Exception as e:
        logger.error(f"Failed to fetch voices from robot_sync: {e}")
        return {"models": []}

class VoiceSelection(BaseModel):
    voice_model: str

@router.put("/voices")
async def update_voice_selection(selection: VoiceSelection):
    """Send updated TTS voice model to robot_sync."""
    robot_sync_url = f"http://{app_settings.ROBOT_SYNC_HOST}:{app_settings.ROBOT_SYNC_PORT}"
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{robot_sync_url}/tts/config",
                json={"voice_model": selection.voice_model},
                timeout=5.0
            )
            resp.raise_for_status()
            return resp.json()
    except Exception as e:
        logger.error(f"Failed to set voice in robot_sync: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/language")
async def get_current_language():
    """Fetch current robot language from robot_sync."""
    robot_sync_url = f"http://{app_settings.ROBOT_SYNC_HOST}:{app_settings.ROBOT_SYNC_PORT}"
    try:
        async with httpx.AsyncClient() as client:
            # Fetch the entire config to extract the language
            resp = await client.get(f"{robot_sync_url}/config", timeout=5.0)
            resp.raise_for_status()
            config_data = resp.json().get("config", {})
            return {"language": config_data.get("robot_language", "en")}
    except Exception as e:
        logger.error(f"Failed to fetch language from robot_sync: {e}")
        return {"language": "en"}

class LanguageSelection(BaseModel):
    language_code: str

@router.put("/language")
async def update_language_selection(selection: LanguageSelection):
    """Send updated robot primary language to robot_sync."""
    robot_sync_url = f"http://{app_settings.ROBOT_SYNC_HOST}:{app_settings.ROBOT_SYNC_PORT}"
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{robot_sync_url}/language/config",
                json={"language_code": selection.language_code},
                timeout=5.0
            )
            resp.raise_for_status()
            return resp.json()
    except Exception as e:
        logger.error(f"Failed to set language in robot_sync: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/voice-params")
async def get_voice_params():
    """Fetch current TTS voice parameters from robot_sync."""
    robot_sync_url = f"http://{app_settings.ROBOT_SYNC_HOST}:{app_settings.ROBOT_SYNC_PORT}"
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{robot_sync_url}/tts/voice-settings", timeout=5.0)
            resp.raise_for_status()
            return resp.json()
    except Exception as e:
        logger.error(f"Failed to fetch voice params from robot_sync: {e}")
        # Return safe defaults so UI still loads
        return {
            "english": {"voice": "af_heart", "speed": 1.0, "gain": 2.0},
            "indic": {
                "pace": 1.0, "temperature": 0.6, "gain": 5.0,
                "language_voices": {
                    "hi": "shubh", "ta": "ratan", "te": "rohan", "gu": "priya",
                    "bn": "ritu", "kn": "ishita", "ml": "suhani", "mr": "ashutosh",
                    "pa": "mani", "or": "neha",
                },
            },
        }


class VoiceParamsUpdate(BaseModel):
    english: Optional[dict] = None
    indic: Optional[dict] = None

@router.put("/voice-params")
async def update_voice_params(payload: VoiceParamsUpdate):
    """Save TTS voice parameters to robot_sync (triggers pipeline hot-reload)."""
    robot_sync_url = f"http://{app_settings.ROBOT_SYNC_HOST}:{app_settings.ROBOT_SYNC_PORT}"
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{robot_sync_url}/tts/voice-settings",
                json=payload.dict(exclude_none=True),
                timeout=8.0,
            )
            resp.raise_for_status()
            return resp.json()
    except Exception as e:
        logger.error(f"Failed to update voice params in robot_sync: {e}")
        raise HTTPException(status_code=500, detail=str(e))

