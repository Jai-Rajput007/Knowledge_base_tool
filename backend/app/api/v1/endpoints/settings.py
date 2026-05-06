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
