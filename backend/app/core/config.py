"""Application configuration management."""

from typing import List, Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings with environment variable support."""

    # App
    APP_NAME: str = "RAG System API"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False
    API_V1_STR: str = "/api/v1"

    # Server
    API_HOST: str = "0.0.0.0"
    PORT: int = 8000

    # CORS — stored as plain string, split into list via property
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000,http://192.168.201.146:3000,http://192.168.1.61:3000"

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    # Database (SQLite for metadata)
    DATABASE_URL: str = "sqlite:///./rag_system.db"

    # LLM Configuration
    LLM_PROVIDER: str = "ollama"
    LLM_MODEL: str = "qwen2.5:7b"
    LLM_TEMPERATURE: float = 0.7
    LLM_MAX_TOKENS: int = 8192
    LLM_TOP_P: float = 0.9
    LLM_SYSTEM_PROMPT: str = "You are a helpful AI assistant. Answer questions based on the provided context."

    # Embedding Configuration
    EMBEDDING_PROVIDER: str = "ollama"
    EMBEDDING_MODEL: str = "nomic-embed-text:latest"
    EMBEDDING_DIMENSIONS: int = 768

    # Chunking Configuration
    CHUNK_SIZE: int = 3000      # ~750 tokens — large enough for narrative context
    CHUNK_OVERLAP: int = 200
    CHUNKING_STRATEGY: str = "semantic"

    # Embedding tuning
    BATCH_SIZE: int = 32
    EMBEDDING_BATCH_SIZE: int = 16
    EMBEDDING_CONCURRENCY: int = 4
    EMBEDDING_MAX_RETRIES: int = 3
    EMBEDDING_RETRY_DELAY: float = 1.0
    EMBEDDING_CPU_OPTIMIZED: bool = True

    # Retrieval
    TOP_K: int = 10
    SIMILARITY_THRESHOLD: float = 0.1

    # Reranker (cross-encoder — requires sentence-transformers)
    RERANKER_ENABLED: bool = True
    RERANKER_MODEL: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"
    RERANKER_CANDIDATES: int = 20  # fed to reranker; top TOP_K returned to LLM

    # Security
    SECRET_KEY: str = "09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7"

    # Admin seed account
    ADMIN_USERNAME: str = "admin"
    ADMIN_EMAIL: str = "admin@g1system.local"
    ADMIN_PASSWORD: str = "admin123"

    # API Keys (optional)
    OPENAI_API_KEY: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None
    COHERE_API_KEY: Optional[str] = None

    # FRS (Facial Recognition Service)
    FRS_URL: str = "http://localhost:8001"

    # File Upload
    UPLOAD_DIR: str = "./uploads"
    MAX_FILE_SIZE: int = 50 * 1024 * 1024  # 50 MB
    ALLOWED_EXTENSIONS: str = ".pdf,.docx,.txt,.md,.html,.csv,.json,.xlsx,.xls,.epub,.pptx,.odt,.rtf,.xml"

    @property
    def allowed_extensions_list(self) -> List[str]:
        return [e.strip() for e in self.ALLOWED_EXTENSIONS.split(",") if e.strip()]

    # Robot agent (runs on AGX — connect via WiFi IP from laptop)
    ROBOT_AGENT_HOST:       str = "192.168.1.61"   # AGX WiFi IP reachable from this machine
    ROBOT_AGENT_PORT:       int = 7788

    # Wake word training
    # "local_agx" = train on robot GPU | "kaggle" = train on Kaggle cloud GPU
    WAKEWORD_BACKEND:       str = "local_agx"
    WAKEWORD_AGX_IP:        str = "192.168.1.61"
    WAKEWORD_MODELS_DIR:    str = "./wakeword_models"
    WAKEWORD_SAMPLES_DIR:   str = "./wakeword_samples"

    # Kaggle (only needed when WAKEWORD_BACKEND=kaggle)
    KAGGLE_USERNAME:        str = ""
    KAGGLE_KEY:             str = ""
    KAGGLE_KERNEL_NAME:     str = "g1-wakeword-trainer"
    KAGGLE_CONFIG_DATASET:  str = "g1-wakeword-config"
    KAGGLE_EXTRA_DATASETS:  str = ""

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


# Global settings instance
settings = Settings()
