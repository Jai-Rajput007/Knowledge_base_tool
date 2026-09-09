# RAG Document Processing System - Complete Project Details

**For Windsurf AI Assistant** - Comprehensive knowledge base for debugging and development.

---

## 1. PROJECT OVERVIEW

**Name:** RAG Robot System  
**Purpose:** Offline RAG document management system for robot with 128GB Thor AGX  
**Status:** Phase 4 Complete (Frontend-Backend Integration)  
**Architecture:** Hybrid (metadata + hierarchical + vector search)  

**Tech Stack:**
- Frontend: Next.js 16.2 + React 19.2 + TypeScript + Tailwind + Zustand
- Backend: FastAPI + LangChain + SQLAlchemy
- Database: PostgreSQL + pgvector
- LLM: Ollama (local, configurable)
- Embeddings: nomic-embed-text (switchable)
- Document Parsing: unstructured[pdf] + pytesseract

---

## 2. PROJECT STRUCTURE

```
Implementation/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── v1/
│   │   │       ├── endpoints/
│   │   │       │   ├── chat.py          # Chat endpoints with RAG
│   │   │       │   ├── dashboard.py     # Dashboard stats
│   │   │       │   ├── documents.py     # Document CRUD + upload
│   │   │       │   └── settings.py      # Configuration
│   │   │       └── router.py
│   │   ├── core/
│   │   │   ├── config.py                # All settings from env
│   │   │   ├── exceptions.py            # Custom exceptions
│   │   │   └── logging.py               # Logger setup
│   │   ├── db/
│   │   │   └── database.py              # SQLAlchemy setup
│   │   ├── models/
│   │   │   ├── activity.py              # Activity log
│   │   │   ├── chunk.py                 # Document chunks
│   │   │   ├── document.py              # Document metadata
│   │   │   └── setting.py               # App settings
│   │   ├── schemas/
│   │   │   └── document.py              # Pydantic schemas
│   │   └── services/
│   │       ├── __init__.py
│   │       ├── chat_service.py          # Main chat orchestration
│   │       ├── context_builder_service.py # Context assembly strategies
│   │       ├── document_loaders/          # All document parsers
│   │       │   ├── base.py
│   │       │   ├── csv_loader.py
│   │       │   ├── docx_loader.py
│   │       │   ├── html_loader.py
│   │       │   ├── json_loader.py
│   │       │   ├── langchain_loader.py  # Fallback wrappers
│   │       │   ├── loader_factory.py    # Auto-detection
│   │       │   ├── markdown_loader.py
│   │       │   ├── pdf_loader.py
│   │       │   └── text_loader.py
│   │       ├── embedding_service.py     # Basic embedding
│   │       ├── embedding_service_optimized.py  # Batch + CPU optimized
│   │       ├── ingestion_pipeline.py    # 5-stage pipeline
│   │       ├── llm_service.py          # LLM abstraction
│   │       ├── query_processing_service.py # Intent detection + filters
│   │       ├── retrieval_service.py     # Hybrid search + hierarchy
│   │       ├── structure_aware_chunker.py # Hierarchy-preserving chunker
│   │       └── vector_db_service.py     # pgvector storage
│   ├── uploads/                         # Document storage
│   ├── venv/                            # Python virtual env
│   ├── .env                             # Environment variables
│   ├── .env.example                     # Template
│   ├── requirements.txt
│   └── main.py                          # FastAPI entry
├── frontend/
│   └── g1-dashboard/
│       ├── app/
│       │   ├── chat/                    # Chat page
│       │   ├── dashboard/               # Dashboard page
│       │   ├── layout.tsx
│       │   ├── library/                 # Document library
│       │   ├── page.tsx
│       │   └── settings/                # Settings page
│       ├── components/
│       │   ├── ui/                      # shadcn components
│       │   └── ChatBubble.tsx
│       ├── lib/
│       │   ├── api.ts                   # API client
│       │   └── utils.ts
│       ├── public/
│       ├── styles/
│       ├── .env.local
│       ├── next.config.js
│       ├── package.json
│       └── tailwind.config.ts
├── details.md                          # THIS FILE
├── progress.md                         # Progress tracker
└── SETUP_LINUX.md                      # Linux setup guide
```

---

## 3. KEY SERVICES & ARCHITECTURE

### 3.1 Ingestion Pipeline (`ingestion_pipeline.py`)

**5-Stage Pipeline:**
1. **Upload** → File saved to disk, DB record created
2. **Extract** → Document parsed using appropriate loader
3. **Chunk** → Structure-aware chunking with hierarchy preservation
4. **Embed** → Batch embedding generation (CPU optimized)
5. **Index** → Store in pgvector with rich metadata

**Key Classes:**
- `IngestionPipeline` - Main orchestrator
- `IngestionProgress` - Progress tracking dataclass
- `IngestionStage` - Enum: UPLOADED, EXTRACTING, CHUNKING, EMBEDDING, INDEXING, COMPLETED, FAILED

**Progress Callbacks:**
```python
register_progress_callback(document_id, callback)
get_progress(document_id)
```

### 3.2 Document Loaders (`document_loaders/`)

**Factory Pattern:** `loader_factory.py` auto-detects file type

**Native Loaders (8 formats):**
- `PDFLoader` - camelot/pdfplumber for tables, pytesseract for OCR
- `DOCXLoader` - python-docx for Word docs
- `MarkdownLoader` - regex-based MD parser
- `HTMLLoader` - BeautifulSoup
- `CSVLoader` / `TSVLoader` - pandas
- `JSONLoader` / `JSONLLoader` - json module
- `TextLoader` - plain text

**LangChain Fallback (`langchain_loader.py`):**
- EPUB, PPTX, ODT, RTF, XML
- Converts LangChain output to `DocumentContent` format

**DocumentContent Structure:**
```python
class DocumentContent:
    elements: List[DocumentElement]  # Text, Heading, Table, List, Image
    metadata: DocumentMetadata       # title, author, pages, etc.
    
    def get_headings() -> List[HeadingElement]
    def get_tables() -> List[TableElement]
    def get_lists() -> List[ListElement]
    def to_text() -> str
```

### 3.3 Structure-Aware Chunker (`structure_aware_chunker.py`)

**Features:**
- Respects document boundaries (headings, sections)
- Preserves tables, lists, code blocks as units
- Hierarchical metadata: section_path, headings_hierarchy, parent_section
- Content type flags: contains_table, contains_list, contains_code, contains_image
- Streaming support with progress callbacks

**ChunkMetadata:**
```python
@dataclass
class ChunkMetadata:
    chunk_index: int
    total_chunks: int
    filename: str
    file_type: str
    page_number: Optional[int]
    section_level: int
    section_path: str
    headings_hierarchy: List[str]
    parent_section: Optional[str]
    contains_table: bool
    contains_list: bool
    contains_code: bool
    contains_image: bool
    char_count: int
    word_count: int
    token_estimate: int
    tags: List[str]
```

### 3.4 Embedding Service (`embedding_service_optimized.py`)

**CPU Optimizations:**
- Batch processing (configurable size, default 32)
- Concurrent workers (default 4 for CPU)
- Exponential backoff retry logic
- Streaming: `embed_documents_streaming()`

**Providers:**
- Ollama (default, local): `nomic-embed-text:latest`, 768 dimensions
- OpenAI (optional): `text-embedding-3-small`

**Key Methods:**
```python
async embed_documents(texts: List[str], progress_callback=None) -> List[List[float]]
async embed_query(text: str) -> List[float]
async embed_documents_streaming(texts: List[str]) -> AsyncGenerator
get_stats() -> Dict  # Provider, model, batch_size, concurrency
```

### 3.5 Vector Database (`vector_db_service.py`)

**PostgreSQL + pgvector:**
```python
class VectorChunk(Base):  # SQLAlchemy model
    id: str (PK)
    document_id: str (indexed)
    chunk_index: int
    content: str
    embedding: List[float] (vector type)
    metadata_json: JSONB
```

**Search with Metadata Filtering:**
```python
search(
    query_embedding: List[float],
    top_k: int = 5,
    similarity_threshold: float = 0.7,
    filter_dict: Dict[str, Any] = None  # Metadata filters
) -> List[Dict]
```

**Fallback Mode:**
- When PostgreSQL unavailable (SQLite), uses in-memory storage
- Same interface, different implementation

### 3.6 Retrieval Service (`retrieval_service.py`)

**Hybrid Search:**
1. **Prefiltering** - Metadata filters in SQL WHERE clause (EQ only)
2. **Vector Search** - Cosine similarity with pgvector
3. **Postfiltering** - Complex operators after search

**Filter Operators:**
- EQ (equals) - prefilter
- NE (not equals)
- GT, GTE, LT, LTE (comparisons)
- IN, NIN (in/not in list)
- CONTAINS (substring match)

**Hierarchy Retrieval:**
```python
retrieve_by_hierarchy(section_path="Chapter 1")
retrieve_with_parent_context(include_parent_summary=True)
```

**RetrievalResult:**
```python
@dataclass
class RetrievalResult:
    id: str
    text: str
    score: float
    document_id: str
    chunk_index: int
    metadata: Dict
    section_path: Optional[str]
    headings_hierarchy: List[str]
    parent_section: Optional[str]
```

### 3.7 Query Processing Service (`query_processing_service.py`)

**Intent Detection (Regex-based):**
- FACTUAL: "what is", "tell me"
- DEFINITION: "define", "meaning of"
- COMPARISON: "compare", "difference between"
- PROCEDURE: "how to", "steps to"
- SUMMARY: "summarize", "overview"
- SEARCH: general queries
- LOCATE: "find", "where is"
- TEMPORAL: "when", "timeline"

**Filter Extraction:**
```python
# Auto-extract from query text
"in document report.pdf" → {field: "filename", value: "report.pdf"}
"in section Introduction" → {field: "section_path", value: "Introduction"}
"table showing sales" → {field: "contains_table", value: True}
"on page 5" → {field: "page_number", value: 5}
```

**Query Expansion:**
```python
expand_query(processed_query) -> List[str]
# Definition: adds "definition of X", "meaning X"
# Procedure: adds "steps to X", "how to X"
```

**ProcessedQuery Output:**
```python
@dataclass
class ProcessedQuery:
    original_query: str
    cleaned_query: str
    intent: QueryIntent
    confidence: float
    keywords: List[str]
    extracted_filters: List[ExtractedFilter]
    suggested_content_types: List[str]
```

### 3.8 Context Builder Service (`context_builder_service.py`)

**Strategies:**
1. **HIERARCHY** (default) - Group by document > section > parent-child
2. **RELEVANCE** - Sort by similarity score descending
3. **CHRONOLOGICAL** - Sort by page/position
4. **COMPRESS** - Truncate long chunks (>1000 chars)
5. **STANDARD** - Simple list

**Context Optimization:**
- Automatic truncation to fit LLM context window (70% of max tokens)
- Token estimation: chars / 4
- Relevance levels: high (>0.8), medium (>0.6), low (<0.6)

**AssembledContext:**
```python
@dataclass
class AssembledContext:
    context_text: str      # Formatted for LLM
    sources: List[Dict]    # Source metadata for citations
    total_chunks: int
    total_chars: int
    estimated_tokens: int
    hierarchy_groups: Dict[str, List[ContextChunk]]
```

### 3.9 Chat Service (`chat_service.py`)

**RAG Pipeline (5 steps):**
1. **Process Query** - Detect intent, extract filters
2. **Apply Filters** - Merge extracted with explicit filters
3. **Retrieve** - Hybrid search with hierarchy
4. **Build Context** - Use selected strategy
5. **Generate** - Call Ollama with streaming support

**ChatRequest Options:**
```python
@dataclass
class ChatRequest:
    message: str
    document_ids: Optional[List[str]]
    
    # Query Processing
    enable_query_processing: bool = True
    use_extracted_filters: bool = True
    
    # Hierarchy
    section_path: Optional[str]
    parent_section: Optional[str]
    heading_level: Optional[int]
    include_parent_context: bool = True
    content_types: List[str]  # table, list, code, heading
    
    # Context Building
    context_strategy: str = "hierarchy"
    include_metadata_in_context: bool = True
    include_hierarchy_in_context: bool = True
    
    top_k: int = 5
    stream: bool = True
```

**Hierarchy-Aware System Prompt:**
```
Document Structure Awareness:
- The context is organized by document and section hierarchy
- Sources show their section path (e.g., "Chapter 1 > Introduction")
- Consider the document structure when synthesizing answers
```

---

## 4. API ENDPOINTS

### 4.1 Chat (`/api/v1/chat/`)

**POST /** - Send chat message
```json
{
  "message": "What is this document about?",
  "document_ids": ["doc1", "doc2"],
  "enable_query_processing": true,
  "use_extracted_filters": true,
  "section_path": "Chapter 1",
  "content_types": ["table"],
  "context_strategy": "hierarchy",
  "stream": false
}
```

Response:
```json
{
  "message": {"role": "assistant", "content": "..."},
  "sources": [
    {"id": "chunk1", "document": "report.pdf (Section 1)", "page": 5, "excerpt": "...", "score": 0.85}
  ],
  "model": "llama3.2:latest"
}
```

**POST /stream** - Streaming response (SSE)
Returns: Server-Sent Events stream

**GET /models** - Available Ollama models

### 4.2 Documents (`/api/v1/documents/`)

**GET /** - List all documents
Query params: `status`, `search`

**POST /upload** - Upload file
Form data: `file` (multipart)

**DELETE /{id}** - Delete document

**POST /{id}/reindex** - Re-process document

**GET /{id}/content** - Get document content

**GET /{id}/progress** - Get processing progress

**GET /supported-formats** - List supported file types

**GET /stats/summary** - Document statistics

### 4.3 Dashboard (`/api/v1/dashboard/`)

**GET /stats** - System stats

**GET /recent-documents** - Last 5 documents

**GET /recent-activities** - Last 10 activities

**GET /models** - Model status

### 4.4 Settings (`/api/v1/settings/`)

**GET /** - Get all settings

**PUT /** - Update settings

---

## 5. DATABASE SCHEMA

### Documents Table
```sql
CREATE TABLE documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255),
    file_path TEXT,
    file_type VARCHAR(50),
    file_size BIGINT,
    status VARCHAR(20),  -- uploaded, processing, indexed, error
    chunks_count INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    indexed_at TIMESTAMP
);
```

### Chunks Table (PostgreSQL with pgvector)
```sql
CREATE TABLE vector_chunks (
    id VARCHAR PRIMARY KEY,
    document_id VARCHAR NOT NULL,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding vector(768),  -- pgvector extension
    metadata_json JSONB,
    score FLOAT
);

CREATE INDEX idx_vector_chunks_document_id ON vector_chunks(document_id);
```

### Activities Table
```sql
CREATE TABLE activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action VARCHAR(255),
    target VARCHAR(255),
    target_type VARCHAR(50),
    target_id INTEGER,
    activity_type VARCHAR(20),  -- success, error, info
    details JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Settings Table
```sql
CREATE TABLE settings (
    id INTEGER PRIMARY KEY,
    key VARCHAR(255) UNIQUE,
    value TEXT,
    updated_at TIMESTAMP
);
```

---

## 6. ENVIRONMENT CONFIGURATION

### Backend (.env)
```bash
# Database
DATABASE_URL=postgresql://raguser:ragpassword@localhost:5432/ragdb
# Fallback: sqlite:///./app.db

# Vector Database
VECTOR_DB_TYPE=pgvector  # or chromadb, lancedb

# Ollama (LLM)
OLLAMA_BASE_URL=http://localhost:11434
LLM_PROVIDER=ollama
LLM_MODEL=llama3.2:latest
LLM_TEMPERATURE=0.7
LLM_MAX_TOKENS=2048
LLM_TOP_P=0.9

# Embeddings
EMBEDDING_PROVIDER=ollama
EMBEDDING_MODEL=nomic-embed-text:latest
EMBEDDING_DIMENSIONS=768
EMBEDDING_BATCH_SIZE=32
EMBEDDING_CONCURRENCY=4
EMBEDDING_CPU_OPTIMIZED=true

# Application
APP_NAME="RAG Document System"
APP_VERSION="1.0.0"
DEBUG=false
UPLOAD_DIR=./uploads
CORS_ORIGINS=["http://localhost:3000"]

# Chunking
CHUNK_SIZE=1000
CHUNK_OVERLAP=200
```

### Frontend (.env.local)
```bash
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

---

## 7. COMPLETED FEATURES

### Phase 1: Core Infrastructure ✅
- [X] Next.js 16.2 frontend with Amber Minimal theme
- [X] FastAPI backend with async support
- [X] PostgreSQL/SQLite database with SQLAlchemy
- [X] Environment configuration (.env, config.py)
- [X] Logging and exception handling

### Phase 2: Document Processing ✅
- [X] 8 native document loaders + LangChain fallback
- [X] Structure-aware chunking with hierarchy preservation
- [X] CPU-optimized batch embedding
- [X] pgvector storage with metadata
- [X] 5-stage ingestion pipeline with progress tracking

### Phase 3: Retrieval & Query ✅
- [X] Query intent detection (8 types)
- [X] Automatic filter extraction from queries
- [X] Hybrid retrieval (prefilter + vector + postfilter)
- [X] Hierarchy-aware search (section, parent, heading level)
- [X] 5 context building strategies
- [X] Ollama LLM integration with streaming
- [X] Source citations with hierarchy info

### Phase 4: Frontend-Backend Integration ✅
- [X] Document upload with drag-drop and progress
- [X] Document library with filters and search
- [X] Document details (preview, metadata, re-index, delete)
- [X] Dashboard with real-time stats
- [X] Chat interface with streaming and sources
- [X] Settings panel (LLM, Embedding, Chunking, Vector DB)
- [X] API client with full type support

---

## 8. PENDING FEATURES

### Phase 5: Advanced Features
- [ ] OCR for scanned PDFs/images (pytesseract partially integrated)
- [ ] Multilingual support (Hindi/English)
- [ ] Incremental indexing (update only changed sections)
- [ ] Archive old documents
- [ ] Graph RAG extension (architecture has hooks)

### Phase 6: Auth & Multi-user
- [ ] Role-based access (admin, editor, viewer)
- [ ] Private vs shared collections
- [ ] User management

---

## 9. COMMON ISSUES & SOLUTIONS

### Issue: "Cannot connect to PostgreSQL"
**Solution:**
```bash
# Check if running
docker ps | grep postgres

# Start if not
docker run -d --name rag-postgres -p 5432:5432 \
  -e POSTGRES_PASSWORD=ragpassword ankane/pgvector:latest

# Or use SQLite fallback (auto)
```

### Issue: "Ollama connection refused"
**Solution:**
```bash
# Check Ollama
curl http://localhost:11434/api/tags

# Start Ollama
ollama serve &

# Pull models
ollama pull llama3.2:latest
ollama pull nomic-embed-text:latest
```

### Issue: "Module not found" in Python
**Solution:**
```bash
cd backend
source venv/bin/activate  # Linux
# or .\venv\Scripts\activate  # Windows
pip install -r requirements.txt
```

### Issue: Embedding service slow
**Solution:**
- Check `EMBEDDING_CPU_OPTIMIZED=true` in .env
- Reduce `EMBEDDING_BATCH_SIZE` to 16 or 8
- Check CPU usage: should use 50% of cores

### Issue: Frontend can't connect to backend
**Solution:**
- Check `NEXT_PUBLIC_API_URL` in `.env.local`
- Ensure CORS_ORIGINS includes frontend URL
- Check backend running: `curl http://localhost:8000/health`

---

## 10. KEY TECHNICAL DECISIONS

1. **pgvector over ChromaDB/LanceDB:**
   - Better metadata filtering with SQL
   - No migration pain (same PostgreSQL)
   - Production-ready

2. **CPU-optimized embeddings:**
   - Thor AGX has strong CPU
   - Avoid GPU contention with other processes
   - Batch + concurrency = good throughput

3. **Structure-aware chunking:**
   - Preserves document hierarchy for better context
   - Metadata enables section-based retrieval
   - Essential for technical documents

4. **Query processing before retrieval:**
   - Intent detection improves relevance
   - Auto-extracted filters reduce manual work
   - Confidence scoring prevents bad filters

5. **Multiple context strategies:**
   - Different queries need different context organization
   - Hierarchy for structured documents
   - Relevance for fact-finding
   - Chronological for timelines

---

## 11. DEBUGGING TIPS

### Check Service Logs
```bash
# Backend logs (if using uvicorn)
uvicorn app.main:app --log-level debug

# Ollama logs
ollama serve 2>&1 | tee ollama.log

# PostgreSQL logs
docker logs rag-postgres
```

### Test Individual Components
```bash
# Test embedding
curl -X POST http://localhost:8000/api/v1/test/embed \
  -H "Content-Type: application/json" \
  -d '{"text": "test"}'

# Test retrieval
curl -X POST http://localhost:8000/api/v1/test/retrieve \
  -d '{"query": "test"}'
```

### Database Inspection
```bash
# PostgreSQL
psql -U raguser -d ragdb

# Check chunks
SELECT document_id, count(*) FROM vector_chunks GROUP BY document_id;

# Check embeddings
SELECT id, metadata_json->>'filename' FROM vector_chunks LIMIT 5;
```

---

## 12. FILES TO CHECK FOR ERRORS

When debugging, check these files first:

1. **Backend startup fails:**
   - `backend/app/core/config.py` - Environment variables
   - `backend/app/db/database.py` - Database connection
   - `backend/.env` - Configuration

2. **Document upload fails:**
   - `backend/app/api/v1/endpoints/documents.py`
   - `backend/app/services/ingestion_pipeline.py`
   - Upload directory permissions

3. **Chat/RAG fails:**
   - `backend/app/services/chat_service.py`
   - `backend/app/services/retrieval_service.py`
   - `backend/app/services/query_processing_service.py`
   - `backend/app/services/context_builder_service.py`

4. **Frontend errors:**
   - `frontend/g1-dashboard/lib/api.ts` - API client
   - `frontend/g1-dashboard/.env.local` - API URL

5. **Embedding issues:**
   - `backend/app/services/embedding_service_optimized.py`
   - Check Ollama status

---

## 13. QUICK START (After Setup)

1. **Start PostgreSQL:**
   ```bash
   docker start rag-postgres
   ```

2. **Start Ollama:**
   ```bash
   ollama serve
   ```

3. **Start Backend:**
   ```bash
   cd backend
   source venv/bin/activate
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```

4. **Start Frontend:**
   ```bash
   cd frontend/g1-dashboard
   npm run dev
   ```

5. **Access:**
   - Frontend: http://localhost:3000
   - API Docs: http://localhost:8000/docs
   - Health: http://localhost:8000/health

---

**Last Updated:** 2026-05-05  
**Status:** Phase 4 Complete, Ready for Linux Deployment  
**Total Files:** ~50 Python files, ~30 TypeScript/React files  
**Lines of Code:** ~15,000 (estimated)
