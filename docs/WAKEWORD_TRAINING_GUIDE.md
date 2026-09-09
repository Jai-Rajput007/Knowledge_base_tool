# Wake Word Training Guide

**Last updated:** 2026-06-24  
**Backend API:** `http://localhost:8000/api/v1`  
**robot_sync.py (AGX):** `http://192.168.1.61:9000`

---

export BASE=http://localhost:8000/api/v1
uvicorn robot_sync:app --host 0.0.0.0 --port 9000

## Overview

The system supports two training backends. Set once in `.env`, then always use the same `POST /wakeword/train` endpoint.

| Backend | Where training runs | Robot available during training? | Time (draft) |
|---------|--------------------|---------------------------------|--------------|
| `local_agx` | On the robot's AGX GPU | ❌ No — GPU occupied | 2-3 hours |
| `kaggle` | Kaggle free cloud GPU | ✅ Yes | 1.5-2 hours |

---

## One-Time Setup

### 1. Configure backend in `.env`

```bash
# backend/  .env
WAKEWORD_BACKEND=local_agx          # "local_agx" or "kaggle"
WAKEWORD_AGX_IP=192.168.1.107       # AGX WiFi IP (for local_agx only)

# Only needed if WAKEWORD_BACKEND=kaggle
KAGGLE_USERNAME=satishsurya
KAGGLE_KEY=KGAT_xxxxxxxxxxxxxxxx
KAGGLE_KERNEL_NAME=g1-wakeword-trainer
KAGGLE_CONFIG_DATASET=g1-wakeword-config
```

Restart the dashboard backend after any `.env` change:
```bash
cd g1_nlp_dashboard/backend
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000
```
### 2. Start robot_sync.py on AGX (only for local_agx backend)

**On AGX terminal:**
```bash
cd ~/nlp/g1-nlp
pip install fastapi "uvicorn[standard]" psutil python-multipart pyyaml -q
uvicorn robot_sync:app --host 0.0.0.0 --port 9000
```

Verify it's running:
```bash
# From dev machine
curl http://192.168.1.61:9000/health | python3 -m json.tool
```

Expected:
```json
{
  "status": "ok",
  "device_id": "agx-43ae464fbfddcfb1",
  "maintenance_mode": false,
  "pipeline_running": true
}
```

### 3. For Kaggle backend only — push the training kernel (one-time)

```bash
cd g1_nlp_dashboard/kaggle_training
kaggle kernels push -p .
```

---

## Step-by-Step Training Flow

### Step 1 — Check what's currently active

```bash
curl http://localhost:8000/api/v1/wakeword/jobs | python3 -m json.tool
```

If there's an active job (status: queued/uploading/running), cancel it before starting a new one:
```bash
curl -X DELETE http://localhost:8000/api/v1/wakeword/jobs/{job_id}/local-cancel | python3 -m json.tool
# or for Kaggle jobs:
curl -X DELETE http://localhost:8000/api/v1/wakeword/jobs/{job_id} | python3 -m json.tool
```

---

### Step 2 — Enter maintenance mode (local_agx only)

The NLP pipeline must be stopped to free the GPU for training.

```bash
curl -X POST http://localhost:8000/api/v1/wakeword/robot/192.168.1.61/maintenance/start \
| python3 -m json.tool
```

Expected:
```json
{
  "status": "maintenance_started",
  "message": "Robot NLP pipeline stopped. GPU is now free."
}
```

> ⚠️ Robot will NOT respond to wake word or face recognition until maintenance ends.

**Skip this step for Kaggle backend.**

---

### Step 3 — Start training

```bash
curl -X POST http://localhost:8000/api/v1/wakeword/train \
  -F "wake_phrase=hey jai" \
  -F "quality=draft" \
  | python3 -m json.tool
```

**With real audio recordings (improves Indian accent accuracy):**
```bash
curl -X POST http://localhost:8000/api/v1/wakeword/train \
  -F "wake_phrase=hey jai" \
  -F "quality=draft" \
  -F "samples=@/path/to/sample1.wav" \
  -F "samples=@/path/to/sample2.wav" \
  -F "samples=@/path/to/sample3.wav" \
  | python3 -m json.tool
```

**Quality options:**

| Quality | Steps | Samples | AGX time | Kaggle time | Use when |
|---------|-------|---------|----------|-------------|----------|
| `draft` | 30,000 | 5,000 | 2-3 hrs | 1.5 hrs | Testing, quick iteration |
| `standard` | 50,000 | 10,000 | 4-6 hrs | 2.5 hrs | Most deployments |
| `production` | 100,000 | 25,000 | 8-12 hrs | 4.5 hrs | Healthcare, noisy environments |

**Response:**
```json
{
  "job_id": 6,
  "wake_phrase": "hey jai",
  "model_name": "hey_jai",
  "backend": "local_agx",
  "quality": "draft",
  "steps": 30000,
  "n_samples": 5000,
  "samples_uploaded": 3,
  "status": "uploading",
  "estimated_minutes": 150,
  "message": "Training started on local_agx. Poll /wakeword/jobs/6 for status.",
  "warning": "Robot is in maintenance mode and unavailable during training."
}
```

Note the `job_id` — you need it for all following commands.

---

### Step 4 — Monitor training

**Option A — Live log stream (recommended, runs until training finishes):**
```bash
curl http://192.168.1.61:9000/wakeword/train/logs/stream
```
Press `Ctrl+C` to stop watching. The stream ends automatically when training completes.

**Option B — Detailed progress via API:**
```bash
curl http://localhost:8000/api/v1/wakeword/jobs/6/local-status | python3 -m json.tool
```
Returns step number, percentage, and last 10 log lines.

**Option C — Simple DB status (for Kaggle or general status):**
```bash
curl http://localhost:8000/api/v1/wakeword/jobs/6 | python3 -m json.tool
```

**Option D — Watch loop (auto-refresh every 60s):**
```bash
while true; do
  clear
  echo "=== $(date) ==="
  curl -s http://localhost:8000/api/v1/wakeword/jobs/6/local-status | python3 -c "
import json, sys
d = json.load(sys.stdin)
live = d['agx_live']
pct = d['progress_pct']
bar = '█' * (pct // 5) + '░' * (20 - pct // 5)
print(f'[{bar}] {pct}% — Step {live[\"step\"]}/{live[\"total_steps\"]}')
print(f'Status:  {live[\"status\"]}')
print(f'Message: {live[\"message\"]}')
print()
for l in live.get('log_tail', []): print(l)
"
  sleep 60
done
```

**Training steps you'll see in the logs:**
```
[1/6] Cloning + installing livekit-wakeword    (~5-10 min)
[2/6] Writing training config
[3/6] Downloading assets (TTS model, ~1.2 GB)  (~5-15 min depending on network)
[3/6] Generating synthetic clips               (~20-30 min)
[4/6] Augmenting clips + extracting features   (~30-40 min)
[5/6] Training (30,000 steps)                  (~60-90 min) ← longest
[6/6] Exporting to ONNX
[6/6] Evaluating model
=== TRAINING COMPLETE ===
```

---

### Step 5 — Verify training completed

```bash
curl http://localhost:8000/api/v1/wakeword/jobs/6 | python3 -m json.tool
```

Look for `"status": "ready"` and the eval metrics:
```json
{
  "status": "ready",
  "optimal_threshold": 0.94,
  "recall": 0.912,
  "fpph": 0.08
}
```

**Metrics explained:**
- `recall` — what % of "Hey Jai" utterances the model detects (higher = better, aim for >0.85)
- `fpph` — false positives per hour (lower = better, aim for <0.5)
- `optimal_threshold` — use this value when deploying

---

### Step 6 — Deploy model to robot

```bash
curl -X POST http://localhost:8000/api/v1/wakeword/jobs/6/deploy | python3 -m json.tool
```

Response includes the exact config snippet to use:
```json
{
  "status": "deployed",
  "onnx_path": "./wakeword_models/hey_jai.onnx",
  "threshold": 0.94,
  "recall": 0.912,
  "fpph": 0.08,
  "robot_config": {
    "wake_word": {
      "backend": "livekit",
      "model": "models/hey_jai.onnx",
      "threshold": 0.94
    }
  },
  "message": "Copy ./wakeword_models/hey_jai.onnx to your robot's models/ directory..."
}
```

**Apply to robot:**

1. Copy the ONNX file to the AGX:
```bash
scp ./wakeword_models/hey_jai.onnx unitree@192.168.1.61:~/nlp/g1-nlp/models/hey_jai.onnx
```

2. Update `config/app_config.json` on AGX:
```json
"wake_word": {
  "backend": "livekit",
  "model": "models/hey_jai.onnx",
  "threshold": 0.94
}
```

3. Restart the NLP pipeline (or exit maintenance mode — it restarts automatically):
```bash
curl -X POST http://localhost:8000/api/v1/wakeword/robot/192.168.1.61/maintenance/stop \
  | python3 -m json.tool
```

---

## All API Endpoints — Quick Reference

### Training

| Method | Endpoint | What it does |
|--------|----------|--------------|
| `POST` | `/wakeword/train` | Start training (backend from .env) |
| `GET` | `/wakeword/jobs` | List all training jobs |
| `GET` | `/wakeword/jobs/{id}` | Status of a specific job |
| `GET` | `/wakeword/jobs/{id}/local-status` | Live AGX progress (step + logs) |
| `POST` | `/wakeword/jobs/{id}/sync` | Force-sync status from Kaggle |
| `POST` | `/wakeword/jobs/{id}/deploy` | Deploy trained model to robot |
| `DELETE` | `/wakeword/jobs/{id}` | Cancel a Kaggle job |
| `DELETE` | `/wakeword/jobs/{id}/local-cancel` | Cancel an AGX job + restore robot |
| `GET` | `/wakeword/presets` | List quality presets with times |
| `GET` | `/wakeword/kaggle-status` | Live Kaggle kernel status |

### Robot / AGX Management

| Method | Endpoint | What it does |
|--------|----------|--------------|
| `GET` | `/wakeword/robot/{ip}/status` | Check AGX reachability + maintenance state |
| `POST` | `/wakeword/robot/{ip}/maintenance/start` | Stop NLP pipeline, free GPU |
| `POST` | `/wakeword/robot/{ip}/maintenance/stop` | Restart NLP pipeline |

### robot_sync.py endpoints (direct to AGX :9000)

| Method | Endpoint | What it does |
|--------|----------|--------------|
| `GET` | `:9000/health` | AGX health check |
| `GET` | `:9000/maintenance/status` | Maintenance + training state |
| `GET` | `:9000/wakeword/train/status` | Current training step + message |
| `GET` | `:9000/wakeword/train/logs` | Last 50 log lines (snapshot) |
| `GET` | `:9000/wakeword/train/logs/stream` | Live log stream (SSE) |
| `DELETE` | `:9000/wakeword/train` | Stop training on AGX directly |
| `GET` | `:9000/wakeword/models` | List ONNX models on AGX |
| `GET` | `:9000/wakeword/models/{filename}` | Download a model file |

---

## Switching Backends

To switch from AGX to Kaggle (or back), change one line in `.env`:

```bash
# Train on AGX (robot unavailable during training)
WAKEWORD_BACKEND=local_agx

# Train on Kaggle cloud (robot stays operational)
WAKEWORD_BACKEND=kaggle
```

Then restart the backend. The `POST /wakeword/train` call is identical either way.

---

## Recording Samples for Better Accuracy

Without real recordings, training uses only synthetic TTS clips (US English accent). This gives ~60-75% recall for Indian accents. Adding 50+ real recordings improves this to ~90-95%.

**What to record:**
- Say the wake phrase clearly (e.g. "Hey Jai") — 1-2 seconds per clip
- Record 50-100 clips minimum
- Use different speakers, distances from mic, and tones
- Save as `.wav` or `.mp3` files

**Upload recordings when starting training:**
```bash
curl -X POST http://localhost:8000/api/v1/wakeword/train \
  -F "wake_phrase=hey jai" \
  -F "quality=standard" \
  -F "samples=@recording_001.wav" \
  -F "samples=@recording_002.wav" \
  -F "samples=@recording_003.wav" \
  ...
```

---

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `Cannot reach AGX at X:9000` | robot_sync.py not running | SSH into AGX and run `uvicorn robot_sync:app --host 0.0.0.0 --port 9000` |
| `Robot NOT in maintenance mode` | Step 2 skipped | Run maintenance/start first |
| `Job already active` | Previous job still running | Cancel it with DELETE /jobs/{id}/local-cancel |
| `Got unexpected extra argument` | Old `train_local.py` bug | Run fix on AGX: `sed -i 's/"setup", str/"setup", "--config", str/' ~/nlp/g1-nlp/wakeword_training/train_local.py` |
| `no such column: backend` | DB schema out of date | Run: `python3 -c "import sqlite3; c=sqlite3.connect('rag_system.db'); c.execute(\"ALTER TABLE wakeword_jobs ADD COLUMN backend VARCHAR(20) DEFAULT 'kaggle'\"); c.execute(\"ALTER TABLE wakeword_jobs ADD COLUMN robot_ip VARCHAR(50)\"); c.commit()"` |
| Training stuck at step 1 | pip install slow on AGX | Wait — first run installs ~500MB of packages |
| `TRAINING ERROR` after assets download | CUDA OOM or disk full | Check `nvidia-smi` and `df -h` on AGX |
| Status still `running` after server restart | Orphaned background task | Call `POST /wakeword/jobs/{id}/sync` to force-check |
