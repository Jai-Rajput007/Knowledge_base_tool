# RAG System Backend

A modular FastAPI backend for the RAG (Retrieval-Augmented Generation) System.

## Features

- **Modular Architecture**: Easy to add/remove features
- **Document Management**: Upload, process, and index documents
- **Vector Search**: ChromaDB for semantic search
- **LLM Integration**: Support for Ollama, OpenAI, Anthropic, Cohere
- **Embeddings**: Multiple embedding providers
- **Chat Interface**: RAG-powered chat with source citations
- **REST API**: Full CRUD operations

## Project Structure

```
backend/
├── app/
│   ├── api/
│   │   └── v1/
│   │       ├── endpoints/      # API endpoint handlers
│   │       │   ├── chat.py
│   │       │   ├── dashboard.py
│   │       │   ├── documents.py
│   │       │   ├── health.py
│   │       │   └── settings.py
│   │       └── router.py       # API router aggregation
│   ├── core/                   # Core configuration
│   │   ├── config.py
│   │   ├── exceptions.py
│   │   └── logging.py
│   ├── db/                     # Database
│   │   └── database.py
│   ├── models/                 # SQLAlchemy models
│   │   ├── activity.py
│   │   ├── document.py
│   │   └── setting.py
│   ├── schemas/                # Pydantic schemas
│   │   ├── chat.py
│   │   └── document.py
│   ├── services/               # Business logic
│   │   ├── document_processor.py
│   │   ├── embedding_service.py
│   │   ├── llm_service.py
│   │   └── vector_db_service.py
│   └── utils/                  # Utilities
│       └── helpers.py
├── tests/                      # Test suite
├── uploads/                    # File uploads directory
├── chroma_data/                # Vector DB storage
├── logs/                       # Application logs
├── main.py                     # Entry point
├── requirements.txt
└── .env.example
```

## Setup

1. **Create virtual environment:**
   ```bash
   python -m venv venv
   source venv/bin/activate  # Linux/Mac
   venv\Scripts\activate     # Windows
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

4. **Run the server:**
   ```bash
   python main.py
   ```

The API will be available at `http://localhost:8000`

## API Documentation

Once running, visit:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Modules

### Document Processing (`services/document_processor.py`)
- Extracts text from PDF, DOCX, TXT, MD files
- Implements chunking strategies (semantic, fixed, recursive)
- Handles file uploads and storage

### Embedding Service (`services/embedding_service.py`)
- Generates embeddings using configured provider
- Supports Ollama, OpenAI, Cohere, Hugging Face
- Batch processing for efficiency

### LLM Service (`services/llm_service.py`)
- Chat completion with RAG context
- Supports multiple providers
- Streaming responses

### Vector DB Service (`services/vector_db_service.py`)
- Manages ChromaDB (or other vector DBs)
- Handles document indexing and search
- Similarity search with threshold filtering

## Configuration

All settings are managed via `app/core/config.py` and can be overridden via environment variables.

## Development

### Adding a New Feature

1. Create models in `app/models/`
2. Create schemas in `app/schemas/`
3. Create API endpoints in `app/api/v1/endpoints/`
4. Add business logic in `app/services/`
5. Register router in `app/api/v1/router.py`

### Running Tests

```bash
pytest
```

## License

MIT
