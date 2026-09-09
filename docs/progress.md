# RAG Robot System - Progress Tracker

## Project Overview

Offline RAG document management system for robot with 128GB Thor AGX. Hybrid architecture (metadata + hierarchical + vector search) using Next.js 16.2, FastAPI, PostgreSQL/pgvector, Ollama.

---

## Architecture Summary

| Layer           | Technology                                                  |
| --------------- | ----------------------------------------------------------- |
| Frontend        | Next.js 16.2 + React 19.2 + TypeScript + Tailwind + Zustand |
| Backend         | FastAPI + LangChain                                         |
| Database        | PostgreSQL + pgvector                                       |
| LLM             | Ollama (configurable)                                       |
| Embeddings      | nomic-embed-text (switchable)                               |
| Document Parser | unstructured[pdf] + pytesseract                             |

---

## Features Checklist

### Phase 1: Core Infrastructure

- [X] **1.1** Project setup - Next.js 16.2 frontend structure
  - [X] Amber Minimal theme setup (light/dark modes)
  - [X] Theme toggle functionality
  - [X] Dashboard layout with navigation
- [X] **1.2** FastAPI backend structure with async support
  - [X] Modular folder structure (api, core, db, models, schemas, services)
  - [X] Configuration management with env vars
  - [X] Logging setup
  - [X] Exception handling
- [X] **1.3** Database setup (SQLite with SQLAlchemy, ready for PostgreSQL/pgvector)
  - [X] Document model with status tracking
  - [X] Activity log model
  - [X] Settings persistence model
- [ ] **1.4** Ollama integration with model registry
- [X] **1.5** Environment configuration (.env.example, config.py)

### Phase 2: Document Processing Pipeline

- [X] **2.1** Document upload API with async processing support
- [X] **2.2** Rich metadata extraction (filename, date, author, pages, sections, tags)
- [X] **2.3** Comprehensive Document Loaders (8 formats supported):
  - [X] **PDF Loader**: Text, headings, images, tables (camelot/pdfplumber)
  - [X] **DOCX Loader**: Text, headings, lists, tables, images
  - [X] **Markdown Loader**: Full MD syntax (headings, code blocks, tables, lists, images)
  - [X] **HTML Loader**: Structured content extraction (BeautifulSoup)
  - [X] **CSV/TSV Loader**: Table structure with stats
  - [X] **JSON/JSONL Loader**: Structured data with flattening
  - [X] **Text Loader**: Plain text with basic structure
  - [X] **Loader Factory**: Auto-detect file type and use appropriate loader
  - [X] **LangChain Integration**: Fallback loaders for extended format support
    - [X] EPUB (ebooks)
    - [X] PPTX (PowerPoint presentations)
    - [X] ODT (OpenDocument Text)
    - [X] RTF (Rich Text Format)
    - [X] XML documents
    - [X] Wrapper converts LangChain output to our `DocumentContent` format with structure detection
- [X] **2.4** Structure-aware chunking:
  - [X] **Recursive + Heading/Section based chunking**: Respects document hierarchy
  - [X] **Streaming processing**: Real-time progress updates during chunking
  - [X] **Hierarchy metadata preservation**: Section path, headings hierarchy, parent-child relationships
  - [X] **Complex structure preservation**:
    - Tables: Preserved as units or split by rows with headers
    - Lists: Kept intact as logical groups
    - Code blocks: Split at logical boundaries (comments, blank lines)
    - Headings: Always included as context in overlapping chunks
  - [X] **Rich metadata extraction per chunk**:
    - Source info: filename, file_type
    - Document metadata: title, author, created/modified dates
    - Position: chunk_index, total_chunks, page_number
    - Hierarchy: section_level, section_path, headings_hierarchy, parent_section
    - Content types: contains_table/list/code/image flags
    - Stats: char_count, word_count, sentence_count, token_estimate
    - Tags and keywords extracted from content
  - [X] Configurable size and overlap with boundary respect
- [X] **2.5** Embedding generation (batch + CPU optimized):
  - [X] **Batch processing**: Configurable batch size with controlled concurrency
  - [X] **CPU optimization**: Worker threads based on CPU count, smaller batches for local inference
  - [X] **Async with progress tracking**: Real-time progress callbacks during embedding generation
  - [X] **Retry logic**: Automatic retries with exponential backoff for failed requests
  - [X] **Streaming support**: `embed_documents_streaming()` for yield-as-completed
  - [X] **Multi-provider support**: Ollama (optimized for local), OpenAI (native batching)
  - [X] **Stats and monitoring**: Provider info, batch sizes, concurrency levels exposed
- [X] **2.6** Vector storage with pgvector (PostgreSQL native):
  - [X] **pgvector extension**: Uses PostgreSQL's vector extension for storage
  - [X] **Cosine similarity search**: Efficient vector search with metadata filtering
  - [X] **Fallback mode**: In-memory storage when PostgreSQL unavailable (development)
  - [X] **Unified storage**: Vectors stored alongside metadata in PostgreSQL
- [X] **2.7** Ingestion pipeline with progress tracking:
  - [X] 5-stage pipeline: Upload → Extract → Chunk → Embed → Index
  - [X] Real-time progress updates with callbacks
  - [X] Activity logging for all operations
  - [X] Error handling with detailed messages

### Phase 3: Retrieval & Query (Complete with Hierarchy)

- [X] **3.1** Query processing (user question understanding + metadata filter extraction)
  - [X] **Query intent detection**: Classify queries as factual, definition, comparison, procedure, summary, search, locate, temporal
  - [X] **Keyword extraction**: Extract important keywords from queries
  - [X] **Filter extraction**: Automatically extract filters from query text
    - [X] Document references: "in document X", "from file Y"
    - [X] Section references: "in section X", "chapter Y"
    - [X] Content type detection: "table", "list", "code", "heading"
    - [X] Page references: "on page 5"
  - [X] **Query expansion**: Generate query variations for better retrieval
  - [X] **Confidence scoring**: Confidence level for each extraction
  - [X] Document ID filtering (search specific documents)
  - [X] Metadata filter support (arbitrary key-value filters)
- [X] **3.2** Hybrid retrieval (vector + metadata filtering + hierarchy)
  - [X] Vector similarity search with cosine distance
  - [X] **Prefiltering** - Metadata filters applied BEFORE vector search (SQL WHERE)
  - [X] **Postfiltering** - Complex filters applied after search (operators: NE, GT, GTE, LT, LTE, IN, NIN, CONTAINS)
  - [X] Multiple document ID filtering
  - [X] Similarity threshold filtering
  - [X] Content type filtering (table, list, code, heading)
  - [X] Date range filtering
- [X] **3.3** Hierarchy retrieval (section-based context)
  - [X] **Section path filtering** - Search within specific sections
  - [X] **Parent section filtering** - Search within parent context
  - [X] **Heading level filtering** - Filter by section hierarchy depth
  - [X] **Parent context inclusion** - Include parent section info in results
  - [X] Headings hierarchy tracking (H1 > H2 > H3 paths)
  - [X] Section path metadata in results
  - [X] `retrieve_by_hierarchy()` method for section-aware search
  - [X] `retrieve_with_parent_context()` for contextual results
- [X] **3.4** Context builder (top-k chunks + source metadata + page/section info + hierarchy context)
  - [X] **Multiple context strategies**:
    - [X] **Hierarchy**: Group by document > section > parent-child relationships
    - [X] **Relevance**: Sort by similarity score (highest first)
    - [X] **Chronological**: Sort by page/position in document
    - [X] **Compress**: Truncate long chunks to fit context window
    - [X] **Standard**: Simple list format
  - [X] **Source metadata inclusion**: filename, page, section, relevance score
  - [X] **Hierarchy context**: section_path, headings_hierarchy, parent_section
  - [X] **Context optimization**: Automatic truncation to fit LLM context window
  - [X] **Token estimation**: Estimate token count for context budgeting
  - [X] **Relevance levels**: High/medium/low based on similarity score
  - [X] **Source deduplication**: Avoid duplicate content
  - [X] **Formatted output**: Structured with separators and clear source labeling
- [X] **3.5** LLM integration with Ollama streaming
  - [X] Ollama API integration for chat completions
  - [X] Streaming response support (Server-Sent Events)
  - [X] Non-streaming (standard) response support
  - [X] Model list endpoint (fetches from Ollama)
  - [X] Hierarchy-aware system prompts
- [X] **3.6** Response formatting with citations
  - [X] Source citations in responses
  - [X] Relevance scores for each source
  - [X] Document metadata in sources (page, section, excerpt)
  - [X] Section path in source citations
- [X] **3.7** Frontend integration (Query Processing & Context Building)
  - [X] **Query Processing Controls**:
    - [X] "Auto-detect intent" toggle for enabling query processing
    - [X] "Use extracted filters" toggle for auto-applying filters
  - [X] **Context Strategy Selector**:
    - [X] Hierarchy (group by document/section)
    - [X] Relevance (sort by score)
    - [X] Chronological (by page/position)
    - [X] Compress (truncate long chunks)
    - [X] Standard (simple list)
  - [X] **Hierarchy Filters**:
    - [X] Section path input in chat
    - [X] Parent section input in chat
    - [X] Content type filters (table, list, code, heading)
    - [X] "Include parent context" toggle
  - [X] API client updated with all query processing and context building parameters

### Phase 4: UI/UX (Frontend-Backend Connected)

- [X] **4.1** Document upload interface with progress
  - [X] File upload with drag-and-drop support
  - [X] Progress tracking with polling for status
  - [X] Real-time status updates (processing → indexed)
- [X] **4.2** Document listing with filters (search, status)
  - [X] Live document list from backend API
  - [X] Search by filename
  - [X] Filter by status (all, uploaded, processing, indexed, error)
  - [X] Document statistics (total, indexed, processing, size)
- [X] **4.3** Document details view (preview, metadata, re-index, delete)
  - [X] Document content preview API
  - [X] Delete document with API call
  - [X] Re-index document with progress polling
- [X] **4.4** Dashboard with real-time data
  - [X] Stats cards connected to backend
  - [X] Recent documents list
  - [X] Recent activities feed
  - [X] Model status display
  - [X] Auto-refresh every 30 seconds
- [X] **4.5** Chat interface with streaming responses
  - [X] Connected to backend chat API
  - [X] Message history with sources/citations
  - [X] Model selection from available models
  - [X] Streaming text display
  - [X] Error handling
- [X] **4.6** Model configuration panel (LLM + embedding settings)
  - [X] Load settings from backend on mount
  - [X] Save settings to backend
  - [X] All configuration tabs: General, LLM, Embedding, Chunking, Vector DB, API Keys
  - [X] Save status indicator (saving/saved/error)
- [X] **4.7** API client for frontend-backend communication
  - [X] Centralized API client (`lib/api.ts`)
  - [X] All endpoints typed and ready
  - [X] Error handling and response parsing

### Phase 5: Advanced Features

- [X] **5.1** Document re-processing/re-indexing (via Library UI)
- [ ] **5.2** OCR for scanned PDFs/images
- [ ] **5.3** Multilingual support (Hindi/English)
- [ ] **5.4** Incremental indexing
- [ ] **5.5** Archive old documents
- [ ] **5.6** Graph RAG extension hooks (future)

### Phase 6: Auth & Multi-user (Future)

- [ ] **6.1** Single-user auth (current)
- [ ] **6.2** Role-based access (admin, editor, viewer)
- [ ] **6.3** Private vs shared collections

---

## Database Schema

```sql
-- Documents table
CREATE TABLE documents (
    id UUID PRIMARY KEY,
    filename TEXT,
    file_path TEXT,
    file_size BIGINT,
    upload_date TIMESTAMP,
    author TEXT,
    doc_type TEXT,
    collection TEXT,
    total_pages INT,
    metadata JSONB,
    status VARCHAR(20) -- 'processing', 'completed', 'error'
);

-- Sections (hierarchical indexing)
CREATE TABLE document_sections (
    id UUID PRIMARY KEY,
    document_id UUID REFERENCES documents(id),
    parent_section_id UUID REFERENCES document_sections(id),
    section_title TEXT,
    section_level INT, -- 1=H1, 2=H2, etc.
    page_number INT,
    content TEXT
);

-- Vector chunks with metadata
CREATE TABLE chunks (
    id UUID PRIMARY KEY,
    document_id UUID REFERENCES documents(id),
    section_id UUID REFERENCES document_sections(id),
    chunk_index INT,
    content TEXT,
    page_number INT,
    metadata JSONB,
    embedding vector(768) -- for nomic-embed-text
);
```

---

## Current Status

**Last Updated:** 2026-05-05
**Current Phase:** Frontend-Backend Integration Complete
**Next Action:** Implement Retrieval & Query pipeline (Phase 3)

### Completed

- [X] Embedding generation optimized (batch + CPU)
- [X] Frontend-Backend API integration
- [X] Dashboard, Library, Chat, Settings pages connected
- [X] Real-time document processing with polling

### Ready for Linux Deployment

- [X] Modular backend code (PostgreSQL-compatible)
- [X] All models use SQLAlchemy (ORM-agnostic)
- [X] Vector DB abstraction layer (ChromaDB now, pgvector ready)
- [X] CPU-optimized embedding with configurable concurrency

---

## Working Notes

### Key Decisions Log

- **2026-04-30:** Switched from LanceDB to pgvector (better metadata filtering, no migration pain)
- **2026-05-01:** Confirmed Next.js 16.2 with AI features (AGENTS.md, Cache Components, React 19.2)
- **2026-04-30:** Graph RAG deferred - architecture has extension hooks
- **2026-04-30:** Single-user auth for MVP, multi-user later
- **2026-04-30:** Streaming upload (<10MB), async background (>10MB)

### Resource Allocation (128GB Thor AGX)

- RAG System: ~64GB available
- Embedding batch size: 512-1024
- Parallel document processing: 2-4 files
- CPU cores: Use 50% (other processes + NLP tasks)

---

## Verification Checklist

Before marking complete, verify:

- [ ] Feature works as specified
- [ ] Tests pass (if applicable)
- [ ] No dead code or unused imports
- [ ] Code follows existing style
- [ ] Documentation updated

---

## Quick Links

- Original research: `RAG documentation.md`
- Architecture: `Final Arch.txt`
- Guidelines: `SKILL.md`, `CURSOR.md`
