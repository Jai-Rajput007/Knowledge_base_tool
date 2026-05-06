"""Settings model for storing application configuration."""

from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Text, Float, Boolean

from app.db.database import Base


class Setting(Base):
    """Settings model for persisting configuration."""
    
    __tablename__ = "settings"
    
    id = Column(Integer, primary_key=True)
    
    # General Settings
    auto_save_conversations = Column(Boolean, default=True)
    show_source_citations = Column(Boolean, default=True)
    streaming_enabled = Column(Boolean, default=True)
    dark_mode_default = Column(Boolean, default=False)
    
    # LLM Settings
    llm_provider = Column(String(50), default="ollama")
    llm_model = Column(String(100), default="llama3.2:latest")
    llm_temperature = Column(Float, default=0.7)
    llm_max_tokens = Column(Integer, default=2048)
    llm_top_p = Column(Float, default=0.9)
    llm_system_prompt = Column(Text, default="You are a helpful AI assistant. Answer questions based on the provided context.")
    
    # Embedding Settings
    embedding_provider = Column(String(50), default="ollama")
    embedding_model = Column(String(100), default="nomic-embed-text:latest")
    embedding_dimensions = Column(Integer, default=768)
    
    # Chunking Settings
    chunk_size = Column(Integer, default=512)
    chunk_overlap = Column(Integer, default=50)
    chunking_strategy = Column(String(50), default="semantic")
    batch_size = Column(Integer, default=32)
    
    # Vector DB Settings
    vector_db_type = Column(String(50), default="chroma")
    top_k = Column(Integer, default=5)
    similarity_threshold = Column(Float, default=0.7)
    
    # API Keys (encrypted in production)
    openai_api_key = Column(String(500), nullable=True)
    anthropic_api_key = Column(String(500), nullable=True)
    cohere_api_key = Column(String(500), nullable=True)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        """Convert to dictionary for API response."""
        return {
            # General
            "autoSave": self.auto_save_conversations,
            "showSources": self.show_source_citations,
            "streamingEnabled": self.streaming_enabled,
            "darkModeDefault": self.dark_mode_default,
            # LLM
            "llmProvider": self.llm_provider,
            "llmModel": self.llm_model,
            "temperature": self.llm_temperature,
            "maxTokens": self.llm_max_tokens,
            "topP": self.llm_top_p,
            "systemPrompt": self.llm_system_prompt,
            # Embedding
            "embeddingProvider": self.embedding_provider,
            "embeddingModel": self.embedding_model,
            "embeddingDimensions": self.embedding_dimensions,
            # Chunking
            "chunkSize": self.chunk_size,
            "chunkOverlap": self.chunk_overlap,
            "chunkingStrategy": self.chunking_strategy,
            "batchSize": self.batch_size,
            # Vector DB
            "vectorDbType": self.vector_db_type,
            "topK": self.top_k,
            "similarityThreshold": self.similarity_threshold,
        }
