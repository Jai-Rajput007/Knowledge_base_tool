#!/bin/bash
# Start g1_nlp_dashboard (backend + frontend)
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Backend ──────────────────────────────────────────────────────────────────
BACKEND="$SCRIPT_DIR/backend"
VENV="$BACKEND/venv"

if [ ! -d "$VENV" ]; then
    echo "[setup] Creating Python venv..."
    python3 -m venv "$VENV"
    "$VENV/bin/pip" install --upgrade pip -q
    "$VENV/bin/pip" install -r "$BACKEND/requirements.txt" -q
    echo "[setup] Dependencies installed."
fi

echo "[backend] Starting FastAPI on :8000..."
cd "$BACKEND"
"$VENV/bin/uvicorn" app.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
echo "[backend] PID $BACKEND_PID"

# ── Frontend ──────────────────────────────────────────────────────────────────
FRONTEND="$SCRIPT_DIR/frontend/g1-dashboard"

if [ ! -d "$FRONTEND/node_modules" ]; then
    echo "[setup] Installing npm packages..."
    cd "$FRONTEND" && npm install -q
fi

echo "[frontend] Starting Next.js on :3000..."
cd "$FRONTEND"
npm run dev &
FRONTEND_PID=$!
echo "[frontend] PID $FRONTEND_PID"

# ── Cleanup on Ctrl-C ─────────────────────────────────────────────────────────
trap "echo; echo '[stop] Shutting down...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM

echo ""
echo "  Dashboard:  http://localhost:3000"
echo "  API:        http://localhost:8000"
echo "  API docs:   http://localhost:8000/docs"
echo ""
echo "  Press Ctrl-C to stop."
wait
