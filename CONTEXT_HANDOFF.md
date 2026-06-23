# Humanoid NLP System — Context Handoff

> Feed this file into a new conversation to get full context on what's been built.
> Last updated: 2026-06-20

---

## 1. Repository Map

```
/home/surya/my_research/humanoid/
├── humanoid_nlp/          ← Edge runtime (runs on AGX Thor on robot)
├── g1_nlp_dashboard/      ← Web dashboard (config UI + RAG backend)
└── nlp_production/        ← Client deployment repo (GitHub Actions CI/CD)
```

---

## 2. humanoid_nlp — Edge NLP Pipeline

### 2.1 What it is
Python + C++ real-time voice pipeline running on **NVIDIA AGX Thor** attached to a **Unitree G1 humanoid robot** via Ethernet (`enP2p1s0`, subnet `192.168.123.x`). Never runs on a laptop in production; `HARDWARE_MODE=g1` activates the G1-specific paths.

### 2.2 Physical Setup
```
DJI Mic receiver ──USB-C──► G1 PC1 (robot head computer, Linux)
                                │ multicast UDP 239.168.123.161:5555
                                ▼
AGX Thor (192.168.123.166) ◄─── LAN ───► G1 Robot (192.168.123.1)
│  robot_agent (C++, DDS)
│  main.py (Python NLP pipeline)
│  frs_server.py (Face Recognition)
└─ Docker containers (NLP, FRS images via GHCR)
```

### 2.3 Key Ports
| Port | Protocol | Purpose |
|------|----------|---------|
| 7788 | TCP | Gesture commands → robot_agent |
| 7789 | TCP | PCM audio stream → robot_agent (TTS playback) |
| 5555 | UDP multicast | G1 native mic → AGX (239.168.123.161) |
| 5556 | UDP unicast | DJI mic → AGX (when mic_source = "dji") |
| 8000 | HTTP | ChromaDB / Knowledge base API |
| 8001 | HTTP | FRS (Face Recognition Service) API |

### 2.4 robot_agent.cpp (C++ DDS Bridge)
**Location:** `cpp/robot_agent.cpp`  
**Binary:** `cpp/build/robot_agent`  
**Run:** `./robot_agent <network_interface>` e.g. `./robot_agent wlP1p1s0`

The C++ process is the only thing that touches DDS (Unitree SDK). Python never initializes DDS directly — doing so crashes the C++ process via shared memory conflict.

**What it does:**
- Initializes DDS (`ChannelFactory::Init(0, iface)`)
- Activates robot mic via VoiceClient API 1008 `mode=1` → G1 PC1 starts multicast UDP stream
- Serves gesture TCP server on `:7788`
- Serves audio TCP server on `:7789` (receives PCM from Python TTS, plays via `AudioClient::PlayStream`)
- Manages arm gestures via `G1ArmActionClient` (shake hand, comm gesture loop)

**Key classes in robot_agent.cpp:**
```cpp
// Comm gesture loop — replays a custom teach action while robot speaks long responses
static void comm_gesture_loop(std::string name, int duration_ms);
static void comm_gesture_start(const std::string& name, float duration_s);
static void comm_gesture_stop();

// VoiceClient — activates mic streaming
class VoiceClient : public unitree::robot::Client  // API 1008

// Gesture TCP handler — parses JSON and dispatches
// Supported gestures: wave_hello, wave_goodbye, shake_hand, move_forward,
//                     move_backward, comm_gesture_start, comm_gesture_stop
```

**Comm gesture APIs:**
- `COMM_PLAY_API = 7108` — ExecuteAction (custom teach action)
- `COMM_STOP_API = 7113` — StopCustomAction

### 2.5 main.py — 7-Phase Voice State Machine
**Location:** `main.py`  

```
PHASE 1 — STANDBY:         Wake-word detection
PHASE 2 — COMMAND CAPTURE: Collect speech frames (Silero VAD)
PHASE 3 — VALIDATE:        Check for enough speech chunks
PHASE 4 — ASR:             Transcribe audio
PHASE 5 — DIALOGUE:        Run LLM + queue TTS sentences
PHASE 6 — TTS PLAYBACK:    Speak response
           → BARGE-IN:     Silero VAD detects user speech → stop TTS, capture
PHASE 7 — CONVERSATION:    Stay active, wait for follow-up (30s timeout → PHASE 1)
```

**Key classes:**
- `LivekitWakeWord` — wraps livekit wake word model with 2s rolling buffer
- `G1MulticastStream` — UDP multicast listener for native G1 mic (port 5555)
- `DjiMicStream` — UDP unicast listener for DJI mic (port 5556) — drop-in swap
- `LiveAudioPipeline` — main state machine class

**Audio capture selection (config-driven):**
```python
# In main.py ~line 1055
mic_source = g1_cfg.get("mic_source", "native")
if mic_source == "dji":
    capture_context = DjiMicStream(audio_queue, port=dji_port, ...)
else:
    capture_context = G1MulticastStream(audio_queue, interface=..., local_ip=..., ...)
```

**Barge-in logic:**
- Energy pre-filter: `BARGE_IN_MIN_MIC_ENERGY = 0.025` (absolute floor)
- Silero VAD confirmation: 2 consecutive chunks above threshold
- Grace period: `BARGE_IN_GRACE_SECONDS = 0.3` after each TTS sentence starts
- Adaptive noise floor: slow EMA (`NOISE_FLOOR_ALPHA = 0.005`)
- Dynamic threshold: `max(noise_floor × 2.5, 0.025)`

**Known bug fixed:**
- After conversation ends, wakeword model's 2s rolling buffer still contained robot's own voice → false wake word triggers in PHASE 1
- Fix: added `wakeword_model.reset()` + `await asyncio.sleep(ECHO_DECAY_SECONDS)` + re-drain before re-entering PHASE 1
- Also fixed: barge-in preroll was feeding 3.2s of robot voice to ASR; now capped to last 6 chunks (~480ms = actual user speech onset)

### 2.6 Services

#### ASR (`services/asr/asr_service.py`)
- `ParakeetASR` — NeMo Parakeet TDT 0.6B (CUDA, production default)
- `FasterWhisperASR` — Whisper fallback (CPU/CUDA)
- Both implement `IASRProvider` interface
- Hallucination filter: rejects output with < 80% ASCII chars

#### TTS (`services/tts/tts_service.py`)
- `g1_bridge` mode: sends PCM audio via TCP to `robot_agent:7789` → plays through G1 speaker
- `aplay` mode: local audio playback (laptop/dev)
- Model: Piper ONNX (`models/en_US-ryan-medium.onnx`)

#### Gesture (`services/gesture/gesture_service.py`)
- `GestureService` — sends JSON over TCP to `robot_agent:7788`
- Supported: `wave_hello`, `wave_goodbye`, `shake_hand`, `move_forward`, `move_backward`
- `CommunicationGestureLooper` — sends `comm_gesture_start`/`comm_gesture_stop` via TCP
  - Used during long robot responses to loop a communication gesture
  - Fires if response is ≥ `min_words` (default 10)

#### FRS (`frs/frs_server.py` + `services/perception/frs_client.py`)
- Face recognition service runs as a separate Docker container
- Camera backends: `realsense`, `webcam`, `ipcam` — set via `FRS_CAMERA_BACKEND` env or config
- Default (Docker): `realsense` (requires `privileged: true` + `/dev/bus/usb` device mount)
- FRS client polls `http://localhost:8001` for face recognition events
- On face detected → triggers wake word without user needing to say it

#### G1 Audio Driver (`services/hardware/g1_audio_driver.py`)
- Creates PulseAudio virtual devices (`g1_microphone`, `g1_speaker`)
- Mic: multicast UDP → PA FIFO pipe
- Speaker: PA FIFO pipe → DDS `PlayStream`
- Used in dev/laptop mode, NOT in production G1 mode (G1 mode uses direct UDP)

### 2.7 Configuration (`config/app_config.json`)
```json
{
  "hardware_mode": "g1",
  "g1": {
    "dds_interface": "enP2p1s0",
    "local_ip": "192.168.123.166",
    "mic_source": "native",         // "native" | "dji"
    "dji_mic_udp_port": 5556,
    "gestures_enabled": true
  },
  "llm": {
    "mode": "local",               // "local" | "groq" | "enterprise"
    "local": { "model_name": "qwen2.5:7b", "base_url": "http://localhost:11434" },
    "groq": { "model": "llama-3.1-8b-instant" }
  },
  "tts": {
    "mode": "g1_bridge",
    "model_path": "models/en_US-ryan-medium.onnx"
  },
  "asr": {
    "mode": "parakeet",
    "model_name": "nvidia/parakeet-tdt-0.6b-v2"
  },
  "wake_word": {
    "backend": "livekit",
    "model": "models/hey_jarvis_kaggle.onnx",
    "threshold": 0.45
  },
  "frs": {
    "url": "http://localhost:8001",
    "camera": { "type": "realsense" }
  },
  "communication_gesture": {
    "name": "com_gesture",
    "duration": 8.0,
    "min_words": 10
  }
}
```

### 2.8 DJI Mic Integration
- **Streamer** (runs on G1 PC1): `scripts/dji_mic_streamer.py`
  - Auto-detects DJI USB audio device
  - Captures 48kHz stereo → resamples to 16kHz mono int16
  - Sends 5120-byte UDP chunks to AGX IP:5556
  - `pip3 install sounddevice numpy scipy`
- **Receiver** (on AGX): `DjiMicStream` class in `main.py`
  - Listens on UDP port 5556 (unicast)
  - Same interface as `G1MulticastStream`
- **Test script** (on G1 PC1): `scripts/test_dji_mic.py`
  - `--live` flag: continuous real-time transcription using faster-whisper
  - Shows VU meter + saves WAV + transcribes

### 2.9 Docker / Deployment
- Images: `ghcr.io/bidyut-robotics/g1-nlp:latest`, `ghcr.io/bidyut-robotics/g1-frs:latest`
- Compose: `docker-compose.yml` at repo root
- CI/CD: `nlp_production` repo with GitHub Actions self-hosted runner on AGX Thor (tegra-ubuntu, Medikold)
- Config injection: `APP_CONFIG` GitHub Secret (base64-encoded `app_config.json`) → decoded at deploy time
- TTS model: downloaded from Google Drive (file ID `176Hnmfrqo-7Qn5onERR8jByiNf600yLI`)
- Wake word model: `models/hey_jarvis_kaggle.onnx` committed to `nlp_production` repo
- Restart: `docker compose up -d --force-recreate --remove-orphans` (force-recreate needed when only volume-mounted files change)

---

## 3. g1_nlp_dashboard — Web Dashboard

### 3.1 What it is
A web application for managing robot configuration, knowledge base, and conversations. **Separate from the edge runtime.** The dashboard is the config/management layer; `humanoid_nlp` is the runtime that executes on the robot.

**Location:** `/home/surya/my_research/humanoid/g1_nlp_dashboard/`

**Stack:**
- Frontend: Next.js 16.2 + React 19 + TypeScript + Tailwind CSS
- Backend: FastAPI + SQLAlchemy + PostgreSQL + pgvector
- LLM: Ollama (local, configurable)
- Embeddings: nomic-embed-text via Ollama (768-dim)
- Document parsing: unstructured + pytesseract + camelot

### 3.2 Backend Structure
```
backend/app/
├── api/v1/endpoints/
│   ├── auth.py          ← JWT login/register/refresh
│   ├── chat.py          ← RAG chat with streaming
│   ├── dashboard.py     ← Stats, recent docs, model status
│   ├── documents.py     ← Upload, CRUD, reindex, progress
│   ├── employees.py     ← Employee/contact management
│   ├── memory.py        ← LTM/STM memory management
│   ├── sessions.py      ← Conversation sessions
│   └── settings.py      ← LLM, embedding, chunking config
├── models/
│   ├── user.py          ← User with role (admin/user)
│   ├── document.py      ← Document metadata + status
│   ├── message.py       ← Chat messages
│   ├── session.py       ← Conversation sessions
│   ├── memory_fact.py   ← Long-term memory facts
│   └── activity.py      ← Audit activity log
├── services/
│   ├── ingestion_pipeline.py          ← 5-stage doc pipeline
│   ├── document_loaders/              ← 8 format loaders + LangChain fallback
│   ├── embedding_service_optimized.py ← Batch CPU-optimized embeddings
│   ├── retrieval_service.py           ← Hybrid vector + metadata search
│   ├── query_processing_service.py    ← Intent detection + filter extraction
│   ├── context_builder_service.py     ← 5 context strategies
│   ├── chat_service.py                ← RAG orchestration
│   ├── llm_service.py                 ← LLM abstraction (Ollama/OpenAI)
│   └── memory/                        ← LTM, STM, summarization, coreference
└── graph/                             ← LangGraph pipeline (builder, nodes, state)
```

### 3.3 Frontend Pages (Next.js)
```
frontend/g1-dashboard/app/
├── auth/
│   ├── login/           ← JWT login
│   ├── register/        ← User registration
│   ├── forgot-password/
│   └── reset-password/
├── dashboard/           ← Stats overview
├── chat/                ← RAG chat interface (streaming)
├── library/             ← Document management (upload, search, delete, reindex)
├── employees/           ← Employee/contact list
└── settings/            ← LLM, embedding, chunking config
```

**Components:**
- `limelight-nav.tsx` — main sidebar navigation
- `auth-guard.tsx` — JWT auth protection on routes
- `lib/api.ts` — typed API client for all backend endpoints

### 3.4 RAG Pipeline (What's Implemented)
1. **Ingest**: Upload file → detect type → parse (PDF/DOCX/MD/HTML/CSV/JSON/EPUB/PPTX)
2. **Chunk**: Structure-aware chunking preserving heading hierarchy, tables, code blocks
3. **Embed**: Batch embedding via Ollama nomic-embed-text (768-dim, CPU-optimized)
4. **Store**: pgvector table with rich metadata JSON (section_path, heading hierarchy, content flags)
5. **Retrieve**: Hybrid search — prefilter SQL + vector cosine similarity + postfilter operators
6. **Augment**: 5 context assembly strategies (hierarchy, relevance, chronological, compress, standard)
7. **Generate**: Ollama LLM with streaming SSE, source citations

**Query processing:**
- 8 intent types detected (factual, definition, comparison, procedure, summary, search, locate, temporal)
- Auto-extracts filters from query text (filename, section, page, content type)
- Query expansion per intent

### 3.5 Database Schema
```sql
-- SQLite (dev) or PostgreSQL + pgvector (production)
users           -- id, username, email, hashed_password, role (admin/user)
documents       -- id, name, file_path, file_type, status, chunks_count
vector_chunks   -- id, document_id, chunk_index, content, embedding vector(768), metadata_json
sessions        -- id, user_id, title, created_at
messages        -- id, session_id, role, content, sources_json
memory_facts    -- id, user_id, content, source, importance
activities      -- id, action, target, activity_type, created_at
settings        -- key/value config store
```

### 3.6 What's NOT Yet Implemented (Gap vs Feature Spec)
| Feature | Priority |
|---------|----------|
| Multi-tenancy (tenant model, row-level isolation) | Critical |
| Persona CRUD API + UI (name, wake word, system prompt, gestures) | Critical |
| Robot config sync — push `app_config.json` to AGX via API | Critical |
| Enhanced RBAC (4 roles: SuperUser/Admin/Operator/Viewer + custom builder) | High |
| Persona templates library + versioning + rollback | High |
| Chat simulator scoped to persona (not just global RAG) | High |
| Web scraper → auto-ingest URLs into RAG | High |
| Webhook system for robot events | Medium |
| Audit log expansion (all mutations with actor) | Medium |
| Backup & Restore | Medium |
| MCP web search integration | Medium |
| Task & Skill Library (no-code) | Medium |
| Calendar / CRM integrations | Low |

---

## 4. Integration: Dashboard → Robot

### 4.1 How Config Flows
```
Dashboard UI (persona config)
    │ PUT /api/v1/persona/{id}/sync
    ▼
Dashboard backend (builds app_config.json from DB)
    │ POST http://<AGX_IP>:9000/sync-config   (to be implemented in humanoid_nlp)
    ▼
AGX Thor file: config/app_config.json
    │ main.py reads on startup (or hot-reload)
    ▼
Robot pipeline uses new persona settings
```

### 4.2 What humanoid_nlp reads from app_config.json
- `hardware_mode` — g1 or laptop
- `g1.mic_source` — native or dji
- `g1.dds_interface`, `g1.local_ip` — network config
- `llm.mode` + model params — which LLM to use
- `tts.mode`, `tts.model_path` — TTS engine
- `asr.mode`, `asr.model_name` — ASR model
- `wake_word.model`, `wake_word.threshold` — wake word config
- `robot_info.name`, `robot_info.role` — persona identity
- `communication_gesture.*` — gesture-during-speech config
- `frs.*` — face recognition config

---

## 5. nlp_production — Client Deployment

**Location:** `/home/surya/my_research/humanoid/nlp_production/`  
**Purpose:** Production deployment for client Jetson (tegra-ubuntu, Medikold)

**Key files:**
- `docker-compose.yml` — pulls GHCR images, mounts volumes
- `.github/workflows/deploy.yml` — GitHub Actions CI/CD
  - Trigger: manual dispatch (service = all | frs | nlp)
  - Steps: GHCR login → pull images → write `APP_CONFIG` secret → force-recreate containers
- `setup_runner.sh` — one-time setup on client Jetson
  - Registers GitHub Actions self-hosted runner
  - Downloads TTS model from Google Drive
  - Copies wake word model from repo
- `models/hey_jarvis_kaggle.onnx` — wake word model (committed)
- `config/app_config.json` — placeholder stub (real config injected via secret)

**GitHub Secrets:**
- `GHCR_TOKEN` — for pulling private images
- `APP_CONFIG` — base64 -w0 encoded full app_config.json

---

## 6. Quick Reference — Running Things

### Start robot pipeline (on AGX Thor)
```bash
# 1. Start C++ DDS bridge
cd ~/nlp/g1-nlp/cpp/build
./robot_agent wlP1p1s0   # or enP2p1s0 if ethernet connected

# 2. Start NLP pipeline
cd ~/nlp/g1-nlp
python main.py

# Or via Docker
docker compose up -d
```

### Start dashboard (on dev machine)
```bash
# Backend
cd g1_nlp_dashboard/backend
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Frontend
cd g1_nlp_dashboard/frontend/g1-dashboard
npm run dev
```

### Test DJI mic (on G1 PC1)
```bash
python3 ~/test_dji_mic.py --live          # continuous transcription
python3 ~/test_dji_mic.py --list          # list audio devices
python3 ~/test_dji_mic.py --seconds 10   # record + transcribe
```

### Stream DJI mic to AGX (on G1 PC1)
```bash
python3 scripts/dji_mic_streamer.py --target-ip 192.168.123.166
# Then in app_config.json set "mic_source": "dji"
```

---

## 7. Current Branch / Git State
- `humanoid_nlp`: branch `feat/docker_frs` (recent work on DJI mic, wakeword fix, comm gesture)
- `g1_nlp_dashboard`: separate repo, Phase 4 complete (frontend-backend integration done)
- `nlp_production`: branch `main`, GitHub Actions runner registered on client Jetson

---

## 8. Next Steps (as of last session)
1. **Dashboard**: Add Persona management module (API + UI) — most critical missing piece
2. **Dashboard**: Add robot config sync endpoint in `humanoid_nlp` + "Push to Robot" button in dashboard
3. **Dashboard**: Multi-tenancy layer (Tenant model + RBAC expansion to 4 roles)
4. **humanoid_nlp**: Test comm gesture (comm_gesture_start/stop) end-to-end with rebuilt robot_agent
5. **humanoid_nlp**: Verify wakeword false-trigger fix in production
6. **humanoid_nlp**: Test DJI mic integration end-to-end on G1 PC1
