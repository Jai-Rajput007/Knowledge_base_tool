# G1 Robot Dashboard — Database Schema

**Version:** 1.1  
**Date:** 2026-06-23  
**Database:** PostgreSQL 16 + pgvector extension  
**Migration tool:** Alembic  

---

## Two-Application Architecture

This system has two separate applications with two separate databases. They are not shared.

```
┌─────────────────────────────────────────────────────────────────┐
│  YOUR COMPANY — Central Dashboard (Cloud, AWS)                   │
│                                                                   │
│  Used by: Your engineering/ops team only (SuperUsers)            │
│  Purpose: Manage all client accounts, licenses, fleet overview   │
│  Data:    Client metadata only — NO client content ever stored   │
│  Schema:  Schema B (small, ~6 tables)                            │
└─────────────────────────────────────────────────────────────────┘
                         ↕ HTTPS heartbeat
                    (robot count, version, status)

┌─────────────────────────────────────────────────────────────────┐
│  CLIENT SITE — Client Dashboard (On-premise, per installation)   │
│                                                                   │
│  Used by: Client staff (Admin, Operator, Viewer)                 │
│  Purpose: Full robot management for this org                     │
│  Data:    All client data — personas, KB, conversations, FRS     │
│  Schema:  Schema A (full, 32 tables)                             │
└─────────────────────────────────────────────────────────────────┘
```

**What goes to cloud:** Robot count, software version running, online/offline status, license validity. Nothing else.

**What stays on-premise:** Personas, knowledge base, conversations, employee records, face profiles, audit logs, settings — everything the client cares about.

---

## Design Principles

1. **Single-org per installation** — the client dashboard has no `tenant_id`. Every installation is one organization. No multi-tenancy at the database level.
2. **`robot_id` scopes robot-specific data** — one client can have multiple robots. Tables that are per-robot carry `robot_id`.
3. **UUID primary keys** — all PKs are UUIDs. Safe to generate client-side, no collision risk.
4. **JSONB for flexible config** — persona configs, skill action configs, integration credentials use JSONB so fields can be added without migrations.
5. **Soft deletes** — deleted records are marked `is_active = false`, not hard-deleted, except where cascade is explicitly intended.
6. **Timestamps always UTC** — all `TIMESTAMP` columns store UTC. Application layer handles timezone conversion for display.
7. **Edge vs Dashboard split** — face feature vectors (biometric) and live ChromaDB embeddings live on AGX only. This schema stores document metadata and chunk references. See Storage Architecture section at the bottom.

---

---

# Schema A — Client Dashboard (On-Premise)

This schema runs on the client's local PostgreSQL instance.  
One installation per client. All data belongs to this one organization.

---

## Table Index

| # | Table | Description |
|---|-------|-------------|
| **Organization** | | |
| 1 | `organization` | Single-row config table for this installation |
| **Users & Access** | | |
| 2 | `users` | Staff users at this org |
| 3 | `roles` | Admin / Operator / Viewer + custom roles |
| 4 | `permissions` | Granular permission codes |
| 5 | `role_permissions` | Which permissions belong to each role |
| 6 | `user_roles` | Role assignments per user, optionally per robot |
| 7 | `invitations` | Pending user invitations |
| **Robot Management** | | |
| 8 | `robots` | Registered AGX Thor devices at this site |
| 9 | `api_keys` | Robot authentication keys |
| 10 | `robot_status_logs` | Telemetry history |
| **Persona** | | |
| 11 | `personas` | Robot persona configurations |
| 12 | `persona_versions` | Full version history for rollback |
| 13 | `persona_templates` | Pre-built and saved persona templates |
| 14 | `multimodal_configs` | Gesture and expression mappings per persona |
| **Knowledge Base** | | |
| 15 | `documents` | Uploaded document metadata |
| 16 | `vector_chunks` | Document chunks with embeddings |
| 17 | `web_scrape_jobs` | Web scraper queue and status |
| **Conversation** | | |
| 18 | `sessions` | Conversation sessions |
| 19 | `messages` | Individual messages within sessions |
| 20 | `memory_facts` | Long-term memory facts (LTM) |
| 21 | `session_summaries` | Compressed session context |
| **Face Recognition (FRS)** | | |
| 22 | `employees` | Employee and visitor records |
| 23 | `face_profiles` | FRS enrollment metadata (not the vectors) |
| 24 | `recognition_events` | Face recognition event log |
| **Intelligence Layer** | | |
| 25 | `prompt_templates` | Reusable system prompt templates |
| 26 | `skills` | Custom skill definitions |
| 27 | `skill_assignments` | Skill to persona assignments |
| 28 | `integrations` | CRM, calendar, IoT connector configs |
| 29 | `webhooks` | Outgoing webhook endpoint definitions |
| 30 | `webhook_deliveries` | Webhook delivery attempt log |
| **Security & Ops** | | |
| 31 | `audit_logs` | Immutable audit trail |
| 32 | `backup_jobs` | Backup tracking |
| 33 | `settings` | Key-value config store |

---

## Entity Relationship Overview

```
organization (single row — this installation's identity)

users ──────── user_roles ── roles ── role_permissions ── permissions
  └── invitations

robots
  ├── api_keys
  ├── robot_status_logs
  └── personas (current_persona_id)

personas
  ├── persona_versions
  ├── multimodal_configs
  └── skill_assignments ── skills

documents
  ├── vector_chunks
  └── web_scrape_jobs

sessions
  ├── messages
  ├── session_summaries
  └── memory_facts

employees
  ├── face_profiles
  └── recognition_events

integrations
webhooks ── webhook_deliveries
audit_logs
backup_jobs
settings
```

---

## Detailed Table Definitions

---

### 1. `organization`

Single-row table. Stores identity and config for this installation.  
Never insert more than one row. Treat as a config file in the database.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | Fixed UUID, set during installation |
| `name` | VARCHAR(255) | NOT NULL | "Medikold Hospital" |
| `slug` | VARCHAR(100) | NOT NULL | "medikold" — used in central cloud registration |
| `license_key` | VARCHAR(255) | NULL | Issued by central cloud, validated on startup |
| `license_plan` | VARCHAR(50) | DEFAULT 'starter' | starter / pro / enterprise |
| `license_expires_at` | TIMESTAMP | NULL | NULL = perpetual |
| `max_robots` | INTEGER | DEFAULT 5 | From license |
| `max_users` | INTEGER | DEFAULT 10 | From license |
| `max_documents` | INTEGER | DEFAULT 500 | From license |
| `contact_name` | VARCHAR(255) | NULL | |
| `contact_email` | VARCHAR(255) | NULL | |
| `contact_phone` | VARCHAR(50) | NULL | |
| `address` | TEXT | NULL | |
| `timezone` | VARCHAR(50) | DEFAULT 'Asia/Kolkata' | |
| `logo_url` | VARCHAR(500) | NULL | |
| `software_version` | VARCHAR(20) | NULL | Currently installed dashboard version: "1.2.3" |
| `central_cloud_url` | VARCHAR(255) | NULL | Your company's central dashboard URL for heartbeat |
| `last_heartbeat_sent` | TIMESTAMP | NULL | Last time this installation phoned home |
| `installed_at` | TIMESTAMP | DEFAULT now() | |
| `updated_at` | TIMESTAMP | DEFAULT now() | |

---

### 2. `users`

Staff members who log into the client dashboard.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `username` | VARCHAR(50) | UNIQUE, NOT NULL | Login username |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL | |
| `hashed_password` | VARCHAR(255) | NOT NULL | bcrypt hash, minimum 12 rounds |
| `first_name` | VARCHAR(100) | NULL | |
| `last_name` | VARCHAR(100) | NULL | |
| `avatar_url` | VARCHAR(500) | NULL | |
| `is_active` | BOOLEAN | DEFAULT true | Disabled users cannot log in |
| `is_verified` | BOOLEAN | DEFAULT false | Email verification status |
| `last_login` | TIMESTAMP | NULL | |
| `failed_login_count` | INTEGER | DEFAULT 0 | Reset on successful login |
| `locked_until` | TIMESTAMP | NULL | Lock account after 5 consecutive failures |
| `created_at` | TIMESTAMP | DEFAULT now() | |
| `updated_at` | TIMESTAMP | DEFAULT now() | |

**Notes:**
- First user created during installation setup is automatically assigned the `admin` role.
- Use bcrypt (not SHA-256) for password hashing.

---

### 3. `roles`

Three system roles ship with every installation. Custom roles can be added by admin.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `name` | VARCHAR(50) | NOT NULL | admin / operator / viewer / custom name |
| `display_name` | VARCHAR(100) | NOT NULL | "Admin", "Operator", "Viewer" |
| `description` | TEXT | NULL | |
| `is_system` | BOOLEAN | DEFAULT false | true = seeded by migration, cannot be deleted |
| `created_at` | TIMESTAMP | DEFAULT now() | |

**System roles seeded by migration:**

| name | display_name | Description |
|------|-------------|-------------|
| `admin` | Admin | Full access to this installation. Manage users, robots, personas, KB. |
| `operator` | Operator | Manage robots and personas. View conversations. Cannot manage users. |
| `viewer` | Viewer | Read-only access to everything. Cannot change any data. |

---

### 4. `permissions`

Atomic permission codes. Every API endpoint checks at least one.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `code` | VARCHAR(100) | UNIQUE, NOT NULL | `robots.read`, `personas.write` |
| `display_name` | VARCHAR(150) | NOT NULL | "View Robots" |
| `description` | TEXT | NULL | |
| `module` | VARCHAR(50) | NOT NULL | robots / personas / documents / users / settings / analytics |

**Permission codes seeded by migration:**

| module | code | Admin | Operator | Viewer |
|--------|------|-------|----------|--------|
| robots | robots.read | ✓ | ✓ | ✓ |
| robots | robots.write | ✓ | ✓ | |
| robots | robots.delete | ✓ | | |
| robots | robots.sync | ✓ | ✓ | |
| personas | personas.read | ✓ | ✓ | ✓ |
| personas | personas.write | ✓ | ✓ | |
| personas | personas.delete | ✓ | | |
| personas | personas.rollback | ✓ | ✓ | |
| personas | personas.sync | ✓ | ✓ | |
| documents | documents.read | ✓ | ✓ | ✓ |
| documents | documents.write | ✓ | ✓ | |
| documents | documents.delete | ✓ | | |
| documents | documents.reindex | ✓ | ✓ | |
| users | users.read | ✓ | | |
| users | users.write | ✓ | | |
| users | users.delete | ✓ | | |
| users | users.invite | ✓ | | |
| settings | settings.read | ✓ | ✓ | ✓ |
| settings | settings.write | ✓ | | |
| analytics | analytics.read | ✓ | ✓ | ✓ |
| audit | audit.read | ✓ | | |

---

### 5. `role_permissions`

Junction table. Maps permissions to roles.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `role_id` | UUID | FK → roles(id), PK(composite) | |
| `permission_id` | UUID | FK → permissions(id), PK(composite) | |

---

### 6. `user_roles`

Assigns a role to a user. Can be scoped to a specific robot.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `user_id` | UUID | FK → users(id) ON DELETE CASCADE | |
| `role_id` | UUID | FK → roles(id) | |
| `robot_id` | UUID | FK → robots(id), NULL | NULL = applies to all robots in this installation |
| `assigned_by` | UUID | FK → users(id) | |
| `assigned_at` | TIMESTAMP | DEFAULT now() | |
| `expires_at` | TIMESTAMP | NULL | Optional expiry for temporary access |

**Example:** An Operator scoped to Robot A (`robot_id = agx-001`) cannot access Robot B's persona or conversations.

---

### 7. `invitations`

Pending email invitations for new staff members.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `email` | VARCHAR(255) | NOT NULL | |
| `role_id` | UUID | FK → roles(id) | Role to assign on acceptance |
| `robot_id` | UUID | FK → robots(id), NULL | Optional robot-scoped role |
| `invited_by` | UUID | FK → users(id) | |
| `token_hash` | VARCHAR(255) | UNIQUE, NOT NULL | SHA-256 of the invitation token. Show token once, store hash. |
| `status` | VARCHAR(20) | DEFAULT 'pending' | pending / accepted / expired / cancelled |
| `expires_at` | TIMESTAMP | NOT NULL | Typically now() + 7 days |
| `created_at` | TIMESTAMP | DEFAULT now() | |
| `accepted_at` | TIMESTAMP | NULL | |

---

### 8. `robots`

Physical AGX Thor devices registered at this site.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `name` | VARCHAR(255) | NOT NULL | "Jai — Reception Robot" |
| `device_id` | VARCHAR(100) | UNIQUE, NOT NULL | Hardware fingerprint: "agx-3f7a9c2d1e4b8f60" |
| `serial_number` | VARCHAR(100) | NULL | Manufacturer serial number |
| `location` | VARCHAR(255) | NULL | "Main Lobby, Floor 1" |
| `local_ip` | VARCHAR(50) | NULL | 192.168.123.166 |
| `bridge_mode` | VARCHAR(20) | DEFAULT 'onpremise' | onpremise / hybrid / iot_core |
| `iot_endpoint` | VARCHAR(255) | NULL | AWS IoT Core endpoint (iot_core mode only) |
| `current_persona_id` | UUID | FK → personas(id), NULL | Active persona |
| `is_active` | BOOLEAN | DEFAULT true | |
| `status` | VARCHAR(20) | DEFAULT 'offline' | online / offline / error |
| `battery_level` | INTEGER | NULL | 0–100 |
| `last_seen` | TIMESTAMP | NULL | Last heartbeat from AGX |
| `config_hash` | VARCHAR(64) | NULL | SHA-256 of last synced config. Robot compares this to detect change. |
| `software_version` | VARCHAR(20) | NULL | humanoid_nlp version running: "2.1.0" |
| `hardware_info` | JSONB | DEFAULT '{}' | {"model": "AGX Thor", "memory_gb": 64, "gpu": "128-core"} |
| `created_at` | TIMESTAMP | DEFAULT now() | |
| `updated_at` | TIMESTAMP | DEFAULT now() | |

---

### 9. `api_keys`

Authentication keys used by robots to call the dashboard API.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `robot_id` | UUID | FK → robots(id) ON DELETE CASCADE | |
| `key_hash` | VARCHAR(255) | NOT NULL | bcrypt hash of the full key. Never store plaintext. |
| `key_prefix` | VARCHAR(12) | NOT NULL | First 8 chars for display: "rk_live_" |
| `label` | VARCHAR(100) | DEFAULT 'Default Key' | |
| `is_active` | BOOLEAN | DEFAULT true | Revoke without deleting |
| `last_used` | TIMESTAMP | NULL | |
| `created_at` | TIMESTAMP | DEFAULT now() | |
| `expires_at` | TIMESTAMP | NULL | NULL = never expires |

**Note:** Full key shown to user once at generation, then only `key_prefix` is visible.

---

### 10. `robot_status_logs`

Time-series telemetry from each robot. Retain 90 days, then archive or purge.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `robot_id` | UUID | FK → robots(id) ON DELETE CASCADE | |
| `status` | VARCHAR(20) | NOT NULL | online / offline / error |
| `battery_level` | INTEGER | NULL | 0–100 |
| `phase` | VARCHAR(30) | NULL | STANDBY / COMMAND_CAPTURE / ASR / DIALOGUE / TTS_PLAYBACK |
| `uptime_seconds` | INTEGER | NULL | Seconds since last restart |
| `cpu_percent` | FLOAT | NULL | |
| `memory_percent` | FLOAT | NULL | |
| `active_session_id` | UUID | NULL | Session in progress if any |
| `error_code` | VARCHAR(50) | NULL | "ASR_TIMEOUT", "LLM_UNAVAILABLE" |
| `error_message` | TEXT | NULL | |
| `recorded_at` | TIMESTAMP | DEFAULT now() | Timestamp from AGX, not server receive time |

**Index:** `(robot_id, recorded_at DESC)` for time-range dashboard queries.

---

### 11. `personas`

Robot persona configurations. One robot has one active persona at a time, but can have many saved versions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `robot_id` | UUID | FK → robots(id) | |
| `name` | VARCHAR(255) | NOT NULL | "Jai v2 — Professional" (internal label) |
| `robot_display_name` | VARCHAR(100) | NOT NULL | What the robot calls itself: "Jai" |
| **Wake Word** | | | |
| `wake_word` | VARCHAR(100) | NOT NULL | "hey_jai" |
| `wake_word_model_path` | VARCHAR(255) | NOT NULL | Path to .onnx model file |
| `wake_word_threshold` | FLOAT | DEFAULT 0.45 | Detection sensitivity |
| `wake_word_backend` | VARCHAR(20) | DEFAULT 'livekit' | livekit / custom |
| **System Prompt** | | | |
| `system_prompt` | TEXT | NOT NULL | Full system prompt sent to LLM |
| `prompt_template_id` | UUID | FK → prompt_templates(id), NULL | Source template if cloned from one |
| **LLM** | | | |
| `llm_mode` | VARCHAR(20) | DEFAULT 'local' | local / groq / openai / enterprise |
| `llm_model` | VARCHAR(100) | DEFAULT 'qwen2.5:7b' | |
| `llm_base_url` | VARCHAR(255) | NULL | http://localhost:11434 for Ollama |
| `llm_temperature` | FLOAT | DEFAULT 0.7 | |
| `llm_max_tokens` | INTEGER | DEFAULT 8192 | |
| `llm_top_p` | FLOAT | DEFAULT 0.9 | |
| **ASR** | | | |
| `asr_mode` | VARCHAR(20) | DEFAULT 'parakeet' | parakeet / whisper |
| `asr_model` | VARCHAR(100) | DEFAULT 'nvidia/parakeet-tdt-0.6b-v2' | |
| `asr_language` | VARCHAR(10) | DEFAULT 'en' | |
| **TTS** | | | |
| `tts_mode` | VARCHAR(20) | DEFAULT 'g1_bridge' | g1_bridge / aplay |
| `tts_model_path` | VARCHAR(255) | NOT NULL | Path to Piper ONNX model |
| `tts_speed` | FLOAT | DEFAULT 1.0 | |
| `tts_pitch` | FLOAT | DEFAULT 1.0 | |
| **Behaviour** | | | |
| `language` | VARCHAR(10) | DEFAULT 'en' | Primary language |
| `multilingual` | BOOLEAN | DEFAULT false | Allow non-English responses |
| `response_length` | VARCHAR(20) | DEFAULT 'medium' | short / medium / long |
| `safety_filter` | BOOLEAN | DEFAULT true | Reject unsafe content |
| `context_window_turns` | INTEGER | DEFAULT 10 | Conversation turns to keep in context |
| **Gestures** | | | |
| `gestures_enabled` | BOOLEAN | DEFAULT true | |
| `comm_gesture_name` | VARCHAR(100) | DEFAULT 'com_gesture' | |
| `comm_gesture_duration` | FLOAT | DEFAULT 8.0 | Seconds per gesture loop |
| `comm_gesture_min_words` | INTEGER | DEFAULT 10 | Min response words before gesturing |
| **FRS** | | | |
| `frs_enabled` | BOOLEAN | DEFAULT true | |
| `frs_url` | VARCHAR(255) | DEFAULT 'http://localhost:8001' | |
| `frs_camera_type` | VARCHAR(20) | DEFAULT 'realsense' | realsense / webcam / ipcam |
| **Versioning & Sync** | | | |
| `version` | INTEGER | DEFAULT 1 | Increments on every save |
| `is_active` | BOOLEAN | DEFAULT true | Only one active persona per robot |
| `is_template` | BOOLEAN | DEFAULT false | Appears in template library if true |
| `source_template_id` | UUID | FK → persona_templates(id), NULL | |
| `last_synced_at` | TIMESTAMP | NULL | When last pushed to robot |
| `sync_status` | VARCHAR(20) | DEFAULT 'not_synced' | not_synced / synced / pending / error |
| **Audit** | | | |
| `created_by` | UUID | FK → users(id) | |
| `created_at` | TIMESTAMP | DEFAULT now() | |
| `updated_at` | TIMESTAMP | DEFAULT now() | |

---

### 12. `persona_versions`

Immutable snapshots of a persona. One row per save. Enables rollback to any previous state.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `persona_id` | UUID | FK → personas(id) ON DELETE CASCADE | |
| `version` | INTEGER | NOT NULL | Version number at time of this snapshot |
| `snapshot` | JSONB | NOT NULL | Full copy of all persona fields. Not a diff — a complete snapshot. |
| `change_summary` | TEXT | NULL | "Updated wake word to hey_jai, changed LLM temperature to 0.5" |
| `synced_to_robot` | BOOLEAN | DEFAULT false | Was this version ever pushed to the physical robot |
| `synced_at` | TIMESTAMP | NULL | |
| `created_by` | UUID | FK → users(id) | |
| `created_at` | TIMESTAMP | DEFAULT now() | |

**Rollback process:** Take `snapshot` JSONB of target version → apply all fields to `personas` row → increment `version` → insert new `persona_versions` row → mark `sync_status = 'pending'`.

---

### 13. `persona_templates`

Saved persona configurations that can be cloned to create new personas.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `name` | VARCHAR(255) | NOT NULL | "Professional Educator" |
| `description` | TEXT | NULL | |
| `category` | VARCHAR(50) | NULL | healthcare / education / hospitality / corporate |
| `tags` | TEXT[] | DEFAULT '{}' | ['professional', 'english', 'formal'] |
| `is_system` | BOOLEAN | DEFAULT false | true = shipped with the software, cannot be deleted |
| `template_data` | JSONB | NOT NULL | Full persona config minus robot-specific fields (no robot_id, no local IPs) |
| `use_count` | INTEGER | DEFAULT 0 | How many times cloned |
| `created_by` | UUID | FK → users(id) | |
| `created_at` | TIMESTAMP | DEFAULT now() | |
| `updated_at` | TIMESTAMP | DEFAULT now() | |

---

### 14. `multimodal_configs`

Maps conversation states to physical robot gestures and expressions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `persona_id` | UUID | FK → personas(id) ON DELETE CASCADE | |
| `trigger` | VARCHAR(100) | NOT NULL | 'greeting' / 'thinking' / 'agreement' / 'farewell' / 'listening' |
| `gesture_name` | VARCHAR(100) | NULL | Command sent to robot_agent: 'wave_hello' / 'shake_hand' |
| `expression` | VARCHAR(100) | NULL | Facial expression if hardware supports it |
| `led_pattern` | VARCHAR(100) | NULL | LED colour or pattern if hardware supports it |
| `duration_seconds` | FLOAT | DEFAULT 2.0 | |
| `priority` | INTEGER | DEFAULT 0 | Higher = takes precedence when multiple triggers fire simultaneously |
| `is_active` | BOOLEAN | DEFAULT true | |
| `created_at` | TIMESTAMP | DEFAULT now() | |

---

### 15. `documents`

Metadata for every uploaded or scraped document. The file itself is on local disk.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `robot_id` | UUID | FK → robots(id), NULL | NULL = available to all robots at this site |
| `uploaded_by` | UUID | FK → users(id), NULL | NULL if auto-scraped |
| `name` | VARCHAR(255) | NOT NULL | Display name in dashboard |
| `original_filename` | VARCHAR(255) | NOT NULL | |
| `file_path` | VARCHAR(500) | NOT NULL | Local disk path |
| `file_type` | VARCHAR(20) | NOT NULL | pdf / docx / txt / md / html / csv / json / xlsx / epub / pptx |
| `file_size` | BIGINT | NOT NULL | Bytes |
| `status` | VARCHAR(20) | DEFAULT 'pending' | pending / processing / ready / error |
| `chunks_count` | INTEGER | DEFAULT 0 | |
| `source_type` | VARCHAR(20) | DEFAULT 'upload' | upload / web_scrape / api |
| `source_url` | VARCHAR(500) | NULL | Original URL if scraped |
| `error_message` | TEXT | NULL | |
| `processing_started_at` | TIMESTAMP | NULL | |
| `processing_completed_at` | TIMESTAMP | NULL | |
| `created_at` | TIMESTAMP | DEFAULT now() | |
| `updated_at` | TIMESTAMP | DEFAULT now() | |

---

### 16. `vector_chunks`

Document text chunks with 768-dim embeddings. Core of the RAG knowledge base.

> **Note on edge vs dashboard split:**  
> The AGX runs ChromaDB locally and is the live query store during conversations. This table is the dashboard's view of the same data — used for document management UI (chunk preview, reindex, delete). When a document is processed on AGX, AGX writes to its local ChromaDB AND sends chunk metadata + embeddings to this table for dashboard sync.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `document_id` | UUID | FK → documents(id) ON DELETE CASCADE | |
| `robot_id` | UUID | FK → robots(id), NULL | |
| `chunk_index` | INTEGER | NOT NULL | Position within document, 0-based |
| `content` | TEXT | NOT NULL | Raw text of this chunk |
| `embedding` | vector(768) | NULL | nomic-embed-text output. NULL until processed. |
| `token_count` | INTEGER | NULL | |
| `metadata` | JSONB | DEFAULT '{}' | {section_path, heading, page_number, content_type, table_data} |
| `created_at` | TIMESTAMP | DEFAULT now() | |

**Indexes:**
```sql
CREATE INDEX ON vector_chunks USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
CREATE INDEX ON vector_chunks (document_id);
CREATE INDEX ON vector_chunks (robot_id);
```

---

### 17. `web_scrape_jobs`

Queue and status for URL scraping jobs.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `robot_id` | UUID | FK → robots(id), NULL | |
| `url` | VARCHAR(500) | NOT NULL | Starting URL |
| `depth` | INTEGER | DEFAULT 1 | How many link levels to follow |
| `status` | VARCHAR(20) | DEFAULT 'queued' | queued / running / done / error |
| `pages_scraped` | INTEGER | DEFAULT 0 | |
| `documents_created` | INTEGER | DEFAULT 0 | |
| `error_message` | TEXT | NULL | |
| `created_by` | UUID | FK → users(id) | |
| `created_at` | TIMESTAMP | DEFAULT now() | |
| `started_at` | TIMESTAMP | NULL | |
| `completed_at` | TIMESTAMP | NULL | |

---

### 18. `sessions`

A conversation session. Created when wake word fires, face is recognized, or chat simulator is used.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `robot_id` | UUID | FK → robots(id), NULL | NULL = chat simulator session from dashboard |
| `user_id` | UUID | FK → users(id), NULL | Set when session started from dashboard |
| `persona_id` | UUID | FK → personas(id), NULL | Active persona during this session |
| `employee_id` | UUID | FK → employees(id), NULL | Set if triggered by face recognition |
| `title` | VARCHAR(255) | DEFAULT 'New Conversation' | Auto-generated from first message |
| `session_type` | VARCHAR(20) | DEFAULT 'robot' | robot / chat_simulator / api |
| `trigger_type` | VARCHAR(20) | DEFAULT 'wake_word' | wake_word / face_recognition / manual / api |
| `total_messages` | INTEGER | DEFAULT 0 | Denormalised count |
| `total_turns` | INTEGER | DEFAULT 0 | User turn count |
| `status` | VARCHAR(20) | DEFAULT 'active' | active / ended / archived |
| `ended_at` | TIMESTAMP | NULL | |
| `created_at` | TIMESTAMP | DEFAULT now() | |
| `updated_at` | TIMESTAMP | DEFAULT now() | |

---

### 19. `messages`

Individual messages within a session.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `session_id` | UUID | FK → sessions(id) ON DELETE CASCADE | |
| `turn_number` | INTEGER | NOT NULL | Position in conversation, 1-based |
| `role` | VARCHAR(20) | NOT NULL | user / assistant / system |
| `content` | TEXT | NOT NULL | |
| `sources` | JSONB | NULL | [{document_id, chunk_id, relevance_score, excerpt}] — RAG citations |
| `tokens_used` | INTEGER | NULL | |
| `asr_confidence` | FLOAT | NULL | For user messages: ASR confidence 0.0–1.0 |
| `pipeline_latency_ms` | INTEGER | NULL | User speech end → robot speech start |
| `tts_duration_ms` | INTEGER | NULL | Duration of robot's spoken response |
| `llm_model_used` | VARCHAR(100) | NULL | Actual model name used |
| `created_at` | TIMESTAMP | DEFAULT now() | |

---

### 20. `memory_facts`

Long-term memory about people and topics. Persists across sessions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `robot_id` | UUID | FK → robots(id), NULL | NULL = applies to all robots at this site |
| `employee_id` | UUID | FK → employees(id), NULL | Who this fact is about |
| `session_id` | UUID | FK → sessions(id), NULL | Session where this was learned |
| `content` | TEXT | NOT NULL | "Prefers formal greetings. Works in cardiology." |
| `fact_type` | VARCHAR(50) | NOT NULL | preference / biographical / appointment / project / other |
| `source` | VARCHAR(30) | DEFAULT 'conversation' | conversation / explicit / system |
| `importance` | INTEGER | DEFAULT 5 | 1 (low) – 10 (critical) |
| `confidence` | FLOAT | DEFAULT 1.0 | 0.0–1.0 |
| `embedding` | vector(768) | NULL | For semantic memory search |
| `is_active` | BOOLEAN | DEFAULT true | Soft delete |
| `expires_at` | TIMESTAMP | NULL | Auto-expire transient facts |
| `access_count` | INTEGER | DEFAULT 0 | |
| `last_accessed` | TIMESTAMP | NULL | |
| `created_at` | TIMESTAMP | DEFAULT now() | |

---

### 21. `session_summaries`

Compressed summaries of conversations. Used to maintain context beyond context window limit.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `session_id` | UUID | FK → sessions(id) ON DELETE CASCADE, UNIQUE | One summary per session |
| `summary_level` | INTEGER | DEFAULT 1 | 1=recent turns, 2=full session, 3=archived |
| `turn_range_start` | INTEGER | NOT NULL | |
| `turn_range_end` | INTEGER | NOT NULL | |
| `summary_text` | TEXT | NOT NULL | |
| `key_facts` | JSONB | DEFAULT '[]' | Structured extracted facts |
| `tokens_saved` | INTEGER | NULL | Tokens this summary replaced |
| `created_at` | TIMESTAMP | DEFAULT now() | |

---

### 22. `employees`

People registered at this site — staff, visitors, patients depending on use case.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `employee_id` | VARCHAR(50) | UNIQUE, NOT NULL | Internal ID: "EMP-001" |
| `name` | VARCHAR(255) | NOT NULL | |
| `email` | VARCHAR(255) | NULL | |
| `phone` | VARCHAR(50) | NULL | |
| `department` | VARCHAR(100) | NULL | "Cardiology" |
| `designation` | VARCHAR(100) | NULL | "Dr.", "Head Nurse" |
| `photo_url` | VARCHAR(500) | NULL | Local path to profile photo |
| `face_enrolled` | BOOLEAN | DEFAULT false | Has FRS enrollment been completed |
| `photo_count` | INTEGER | DEFAULT 0 | Number of training photos |
| `is_active` | BOOLEAN | DEFAULT true | |
| `metadata` | JSONB | DEFAULT '{}' | Extra fields: room number, schedule, access level |
| `created_at` | TIMESTAMP | DEFAULT now() | |
| `updated_at` | TIMESTAMP | DEFAULT now() | |

---

### 23. `face_profiles`

FRS enrollment metadata. The actual face feature vectors (512-dim biometric data) are stored only on the AGX and never sent anywhere else.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `employee_id` | UUID | FK → employees(id) ON DELETE CASCADE | |
| `face_id` | VARCHAR(100) | UNIQUE, NOT NULL | ID used inside AGX FRS database |
| `enrollment_status` | VARCHAR(20) | DEFAULT 'pending' | pending / enrolled / failed / needs_update |
| `photo_count` | INTEGER | DEFAULT 0 | |
| `photo_paths` | TEXT[] | DEFAULT '{}' | Local paths to training photos (kept for re-enrollment) |
| `enrolled_on_devices` | TEXT[] | DEFAULT '{}' | device_ids where this face is currently enrolled |
| `last_enrolled_at` | TIMESTAMP | NULL | |
| `failure_reason` | TEXT | NULL | |
| `created_at` | TIMESTAMP | DEFAULT now() | |
| `updated_at` | TIMESTAMP | DEFAULT now() | |

**Privacy note:** `photo_paths` point to training photos only. Feature vectors are computed and stored entirely on AGX. Photos are retained only for re-enrollment if device resets.

---

### 24. `recognition_events`

Log of every face recognition event, synced from AGX to dashboard.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `robot_id` | UUID | FK → robots(id) | |
| `employee_id` | UUID | FK → employees(id), NULL | NULL = unknown face |
| `face_id` | VARCHAR(100) | NULL | FRS-internal reference |
| `confidence` | FLOAT | NOT NULL | 0.0–1.0 |
| `event_type` | VARCHAR(20) | NOT NULL | recognized / unknown / low_confidence |
| `triggered_session_id` | UUID | FK → sessions(id), NULL | Session opened as result |
| `recognized_at` | TIMESTAMP | NOT NULL | Timestamp from AGX (not server receive time) |
| `created_at` | TIMESTAMP | DEFAULT now() | When synced to dashboard |

---

### 25. `prompt_templates`

Reusable system prompt templates. Can be assigned to personas.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `name` | VARCHAR(255) | NOT NULL | "Medical Receptionist — Formal English" |
| `description` | TEXT | NULL | |
| `content` | TEXT | NOT NULL | Template with placeholders: {robot_name}, {department}, {date} |
| `variables` | TEXT[] | DEFAULT '{}' | ['robot_name', 'department', 'date'] |
| `category` | VARCHAR(50) | NULL | system / greeting / task / domain |
| `is_system` | BOOLEAN | DEFAULT false | Shipped with software, cannot be deleted |
| `is_active` | BOOLEAN | DEFAULT true | |
| `created_by` | UUID | FK → users(id) | |
| `created_at` | TIMESTAMP | DEFAULT now() | |
| `updated_at` | TIMESTAMP | DEFAULT now() | |

---

### 26. `skills`

Custom task definitions that a persona can execute when triggered by user speech.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `name` | VARCHAR(255) | NOT NULL | "Book Appointment" |
| `description` | TEXT | NULL | |
| `trigger_phrases` | TEXT[] | NOT NULL | ['book appointment', 'schedule meeting', 'set up a visit'] |
| `action_type` | VARCHAR(50) | NOT NULL | api_call / webhook / response_template / script |
| `action_config` | JSONB | NOT NULL | {url, method, headers, body_template, response_mapping} |
| `response_template` | TEXT | NULL | "Your appointment is booked for {date}" |
| `timeout_ms` | INTEGER | DEFAULT 5000 | |
| `is_active` | BOOLEAN | DEFAULT true | |
| `created_by` | UUID | FK → users(id) | |
| `created_at` | TIMESTAMP | DEFAULT now() | |
| `updated_at` | TIMESTAMP | DEFAULT now() | |

---

### 27. `skill_assignments`

Which skills are active for which persona.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `skill_id` | UUID | FK → skills(id) ON DELETE CASCADE | |
| `persona_id` | UUID | FK → personas(id) ON DELETE CASCADE | |
| `priority` | INTEGER | DEFAULT 0 | Higher = checked first when multiple skills match |
| `is_active` | BOOLEAN | DEFAULT true | |
| `created_at` | TIMESTAMP | DEFAULT now() | |
| UNIQUE | | (skill_id, persona_id) | |

---

### 28. `integrations`

External service connections — Google Calendar, CRM, IoT.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `type` | VARCHAR(50) | NOT NULL | google_calendar / salesforce / slack / custom_api |
| `name` | VARCHAR(255) | NOT NULL | "Google Calendar — Appointments" |
| `config` | JSONB | NOT NULL | Connection config: {client_id, redirect_uri, scopes} — encrypt at rest |
| `credentials` | JSONB | NULL | OAuth tokens: {access_token, refresh_token, expires_at} — encrypt at rest |
| `is_active` | BOOLEAN | DEFAULT true | |
| `last_synced` | TIMESTAMP | NULL | |
| `last_error` | TEXT | NULL | |
| `created_by` | UUID | FK → users(id) | |
| `created_at` | TIMESTAMP | DEFAULT now() | |
| `updated_at` | TIMESTAMP | DEFAULT now() | |

**Security:** `config` and `credentials` must be AES-256 encrypted at application layer before writing. Never store OAuth tokens in plaintext.

---

### 29. `webhooks`

Outgoing endpoints that receive robot events.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `name` | VARCHAR(255) | NOT NULL | "Slack Notifications" |
| `url` | VARCHAR(500) | NOT NULL | |
| `secret` | VARCHAR(255) | NOT NULL | HMAC-SHA256 signing secret |
| `events` | TEXT[] | NOT NULL | ['face.recognized', 'wake_word.detected', 'session.ended', 'robot.offline'] |
| `is_active` | BOOLEAN | DEFAULT true | |
| `failure_count` | INTEGER | DEFAULT 0 | Auto-disable after 10 consecutive failures |
| `created_by` | UUID | FK → users(id) | |
| `created_at` | TIMESTAMP | DEFAULT now() | |

---

### 30. `webhook_deliveries`

Delivery attempt log for every webhook event.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `webhook_id` | UUID | FK → webhooks(id) ON DELETE CASCADE | |
| `event_type` | VARCHAR(100) | NOT NULL | "face.recognized" |
| `payload` | JSONB | NOT NULL | Exact payload sent |
| `status` | VARCHAR(20) | DEFAULT 'pending' | pending / delivered / failed |
| `response_code` | INTEGER | NULL | |
| `response_body` | TEXT | NULL | First 1000 chars |
| `attempt_count` | INTEGER | DEFAULT 0 | |
| `last_attempted_at` | TIMESTAMP | NULL | |
| `delivered_at` | TIMESTAMP | NULL | |
| `created_at` | TIMESTAMP | DEFAULT now() | |

---

### 31. `audit_logs`

Immutable append-only record of all significant actions. No UPDATE or DELETE on this table.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `user_id` | UUID | FK → users(id), NULL | NULL for robot-initiated actions |
| `robot_id` | UUID | FK → robots(id), NULL | Set when action came from robot |
| `action` | VARCHAR(100) | NOT NULL | 'persona.updated', 'document.deleted', 'user.invited' |
| `target_type` | VARCHAR(50) | NULL | persona / document / user / robot / session |
| `target_id` | UUID | NULL | |
| `target_name` | VARCHAR(255) | NULL | Display name at time of action (records may later be deleted) |
| `before_state` | JSONB | NULL | State before the change |
| `after_state` | JSONB | NULL | State after the change |
| `ip_address` | VARCHAR(50) | NULL | |
| `user_agent` | TEXT | NULL | |
| `request_id` | VARCHAR(100) | NULL | Trace ID |
| `created_at` | TIMESTAMP | DEFAULT now() | |

**Retention:** Minimum 12 months. Enforce append-only via DB trigger or application policy.

---

### 32. `backup_jobs`

Tracks backup creation and restore operations.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `backup_type` | VARCHAR(20) | DEFAULT 'full' | full / incremental / config_only |
| `trigger` | VARCHAR(20) | DEFAULT 'manual' | manual / scheduled / pre_update |
| `status` | VARCHAR(20) | DEFAULT 'running' | running / completed / failed |
| `file_path` | VARCHAR(500) | NULL | Local path to backup file |
| `file_size` | BIGINT | NULL | Bytes |
| `tables_included` | TEXT[] | DEFAULT '{}' | |
| `error_message` | TEXT | NULL | |
| `triggered_by` | UUID | FK → users(id), NULL | NULL for scheduled |
| `created_at` | TIMESTAMP | DEFAULT now() | |
| `completed_at` | TIMESTAMP | NULL | |

---

### 33. `settings`

Key-value config store. Supports site-wide defaults and robot-specific overrides.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `robot_id` | UUID | FK → robots(id), NULL | NULL = site-wide default |
| `key` | VARCHAR(100) | NOT NULL | 'rag.top_k', 'rag.similarity_threshold' |
| `value` | JSONB | NOT NULL | Any JSON value |
| `updated_by` | UUID | FK → users(id), NULL | |
| `updated_at` | TIMESTAMP | DEFAULT now() | |
| UNIQUE | | (robot_id, key) | One value per key per scope |

**Resolution order:** robot-specific → site-wide default.

---

---

# Schema B — Central Cloud Dashboard

This schema runs on your company's AWS PostgreSQL instance.  
Used only by your engineering and ops team.  
**No client data is ever stored here.**

---

## Purpose

Track which clients have installed the software, monitor fleet health across all clients at a high level, manage licenses, and deliver software updates.

---

## Tables

---

### B1. `clients`

One row per client organization.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `name` | VARCHAR(255) | NOT NULL | "Medikold Hospital" |
| `slug` | VARCHAR(100) | UNIQUE, NOT NULL | "medikold" — matches `organization.slug` in their local DB |
| `contact_name` | VARCHAR(255) | NULL | |
| `contact_email` | VARCHAR(255) | NULL | |
| `contact_phone` | VARCHAR(50) | NULL | |
| `plan` | VARCHAR(50) | DEFAULT 'starter' | starter / pro / enterprise |
| `is_active` | BOOLEAN | DEFAULT true | |
| `notes` | TEXT | NULL | Internal notes about this client |
| `onboarded_at` | TIMESTAMP | DEFAULT now() | |
| `updated_at` | TIMESTAMP | DEFAULT now() | |

---

### B2. `licenses`

License keys issued to clients.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `client_id` | UUID | FK → clients(id) | |
| `license_key` | VARCHAR(255) | UNIQUE, NOT NULL | Key installed in client's `organization` table |
| `plan` | VARCHAR(50) | NOT NULL | |
| `max_robots` | INTEGER | NOT NULL | |
| `max_users` | INTEGER | NOT NULL | |
| `max_documents` | INTEGER | NOT NULL | |
| `is_active` | BOOLEAN | DEFAULT true | Revoke a license without deleting |
| `issued_at` | TIMESTAMP | DEFAULT now() | |
| `expires_at` | TIMESTAMP | NULL | NULL = perpetual |
| `issued_by` | UUID | FK → super_users(id) | |

---

### B3. `client_installations`

Tracks each installation's software version and last-seen status. Updated via heartbeat from the client dashboard.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `client_id` | UUID | FK → clients(id) | |
| `slug` | VARCHAR(100) | NOT NULL | Matches client's `organization.slug` |
| `software_version` | VARCHAR(20) | NULL | "1.2.3" — sent in heartbeat |
| `robot_count` | INTEGER | DEFAULT 0 | Number of robots in their installation |
| `robots_online` | INTEGER | DEFAULT 0 | Online count at last heartbeat |
| `last_heartbeat` | TIMESTAMP | NULL | When last heard from |
| `ip_address` | VARCHAR(50) | NULL | Sender IP of last heartbeat |
| `is_online` | BOOLEAN | DEFAULT false | True if heartbeat within last 5 minutes |
| `created_at` | TIMESTAMP | DEFAULT now() | |
| `updated_at` | TIMESTAMP | DEFAULT now() | |

**What the heartbeat payload looks like (sent from client dashboard → central cloud):**
```json
{
  "slug": "medikold",
  "license_key": "LIC-xxxx",
  "software_version": "1.2.3",
  "robot_count": 3,
  "robots_online": 2
}
```
No conversation data. No persona data. No employee data. Health summary only.

---

### B4. `software_releases`

Software versions available for client installations to update to.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `version` | VARCHAR(20) | UNIQUE, NOT NULL | "1.3.0" |
| `release_type` | VARCHAR(20) | NOT NULL | stable / beta / hotfix |
| `release_notes` | TEXT | NULL | What changed |
| `download_url` | VARCHAR(500) | NOT NULL | URL to installer/Docker image |
| `checksum` | VARCHAR(64) | NOT NULL | SHA-256 of the download |
| `min_required_version` | VARCHAR(20) | NULL | "1.1.0" — minimum version that can upgrade to this |
| `released_at` | TIMESTAMP | DEFAULT now() | |
| `released_by` | UUID | FK → super_users(id) | |

---

### B5. `update_jobs`

Tracks which clients have been notified of and applied software updates.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `client_id` | UUID | FK → clients(id) | |
| `release_id` | UUID | FK → software_releases(id) | |
| `status` | VARCHAR(20) | DEFAULT 'notified' | notified / downloaded / applied / failed |
| `notified_at` | TIMESTAMP | DEFAULT now() | |
| `applied_at` | TIMESTAMP | NULL | |
| `error_message` | TEXT | NULL | |

---

### B6. `super_users`

Your company's staff who can access the central cloud dashboard.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `name` | VARCHAR(255) | NOT NULL | |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL | |
| `hashed_password` | VARCHAR(255) | NOT NULL | bcrypt |
| `is_active` | BOOLEAN | DEFAULT true | |
| `last_login` | TIMESTAMP | NULL | |
| `created_at` | TIMESTAMP | DEFAULT now() | |

---

---

# Migration Order

## Schema A (Client Dashboard) — run in this order

```
001_enable_pgvector
002_create_organization
003_create_users
004_create_roles
005_create_permissions
006_create_role_permissions
007_create_user_roles
008_create_invitations
009_create_robots
010_create_api_keys
011_create_robot_status_logs
012_create_persona_templates
013_create_prompt_templates
014_create_personas
015_create_persona_versions
016_create_multimodal_configs
017_create_documents
018_create_vector_chunks
019_create_web_scrape_jobs
020_create_employees
021_create_face_profiles
022_create_recognition_events
023_create_sessions
024_create_messages
025_create_memory_facts
026_create_session_summaries
027_create_skills
028_create_skill_assignments
029_create_integrations
030_create_webhooks
031_create_webhook_deliveries
032_create_audit_logs
033_create_backup_jobs
034_create_settings
035_seed_system_roles
036_seed_permissions
037_seed_role_permissions
038_seed_default_admin_user
039_seed_system_persona_templates
040_seed_system_prompt_templates
```

## Schema B (Central Cloud) — separate Alembic project

```
001_create_super_users
002_create_clients
003_create_licenses
004_create_client_installations
005_create_software_releases
006_create_update_jobs
007_seed_default_super_user
```

---

# Key Indexes — Schema A

```sql
-- Robot lookups
CREATE UNIQUE INDEX idx_robots_device_id     ON robots(device_id);
CREATE INDEX        idx_robots_status        ON robots(status);

-- Document and chunk queries
CREATE INDEX idx_documents_robot             ON documents(robot_id);
CREATE INDEX idx_documents_status            ON documents(status);
CREATE INDEX idx_vector_chunks_document      ON vector_chunks(document_id);
CREATE INDEX idx_vector_chunks_robot         ON vector_chunks(robot_id);

-- Embedding similarity search
CREATE INDEX idx_vector_chunks_embedding
  ON vector_chunks USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_memory_facts_embedding
  ON memory_facts USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Session and message queries
CREATE INDEX idx_sessions_robot              ON sessions(robot_id, created_at DESC);
CREATE INDEX idx_sessions_employee           ON sessions(employee_id);
CREATE INDEX idx_messages_session            ON messages(session_id, turn_number);

-- Audit and telemetry time-range queries
CREATE INDEX idx_audit_logs_time             ON audit_logs(created_at DESC);
CREATE INDEX idx_robot_status_logs_time      ON robot_status_logs(robot_id, recorded_at DESC);
CREATE INDEX idx_recognition_events_time     ON recognition_events(robot_id, recognized_at DESC);

-- User auth
CREATE UNIQUE INDEX idx_users_email          ON users(email);
CREATE UNIQUE INDEX idx_users_username       ON users(username);
CREATE UNIQUE INDEX idx_face_profiles_faceid ON face_profiles(face_id);
```

---

# What Is NOT Stored in This Database (Edge-Only)

| Data | Location on AGX | Reason |
|------|-----------------|--------|
| Face feature vectors (512-dim) | AGX FRS local DB | Biometric data. Must not leave the device. |
| Live ChromaDB vector store | AGX ChromaDB | Queried in real-time during conversation |
| Raw conversation audio | AGX RAM only | Deleted after ASR transcription. Never persisted. |
| Short-term memory (STM) | AGX RAM only | Lives for one conversation only |
| Ollama model weights | AGX /models/ | 4GB+, device-specific |
| Parakeet ASR model | AGX /models/ | |
| Piper TTS model | AGX /models/ | |
| Wake word ONNX model | AGX /models/ | |
| FRS detection models | AGX /models/ | |

---

# Sprint Implementation Order

| Sprint | Dates | Schema A Tables |
|--------|-------|-----------------|
| Sprint 1 | Jun 23–29 | organization, users, roles, permissions, role_permissions, user_roles, invitations, robots, api_keys, settings |
| Sprint 2 | Jun 30–Jul 6 | personas, persona_versions, persona_templates, multimodal_configs, prompt_templates |
| Sprint 3 | Jul 7–13 | documents, vector_chunks, web_scrape_jobs, skills, skill_assignments |
| Sprint 4 | Jul 14–20 | sessions, messages, memory_facts, session_summaries, employees, face_profiles, recognition_events, integrations, webhooks, webhook_deliveries, audit_logs, backup_jobs, robot_status_logs |

Schema B (Central Cloud) can be built any time — it is independent of Schema A and has no shared tables.
