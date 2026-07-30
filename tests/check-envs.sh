#!/bin/bash
# ============================================================
# check-envs.sh — Checks all .env files in the project
# Run from: ~/veda/knowledge_base_tool/
# Usage: bash check-envs.sh
# ============================================================

BOLD="\033[1m"
GREEN="\033[0;32m"
RED="\033[0;31m"
YELLOW="\033[0;33m"
CYAN="\033[0;36m"
RESET="\033[0m"

PASS=0
FAIL=0

check_var() {
  local file=$1
  local key=$2
  local value
  value=$(grep "^${key}=" "$file" 2>/dev/null | cut -d'=' -f2- | tr -d '"' | tr -d "'")

  if [ -z "$value" ]; then
    echo -e "  ${RED}✗ MISSING${RESET}  $key"
    FAIL=$((FAIL + 1))
  else
    # Mask passwords/secrets
    if echo "$key" | grep -qiE "PASSWORD|SECRET|TOKEN|KEY"; then
      echo -e "  ${GREEN}✓ SET${RESET}     $key = ${CYAN}[hidden]${RESET}"
    else
      echo -e "  ${GREEN}✓ SET${RESET}     $key = ${CYAN}$value${RESET}"
    fi
    PASS=$((PASS + 1))
  fi
}

check_env_file() {
  local file=$1
  local label=$2
  shift 2
  local required_keys=("$@")

  echo ""
  echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo -e "${BOLD}📂 $label${RESET}"
  echo -e "   Path: $file"

  if [ ! -f "$file" ]; then
    echo -e "  ${RED}✗ FILE NOT FOUND — .env is MISSING!${RESET}"
    FAIL=$((FAIL + 1))
    return
  fi

  echo -e "  ${GREEN}✓ File exists${RESET}"
  for key in "${required_keys[@]}"; do
    check_var "$file" "$key"
  done
}

# Determine the absolute path to the project root
# The script is in tests/, so the root is one level up
PROJECT_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$PROJECT_ROOT" || { echo "Failed to cd to $PROJECT_ROOT"; exit 1; }

echo ""
echo -e "${BOLD}🔍 G1 Universe — .env Health Check${RESET}"
echo -e "   Running from: $(pwd)"

# ── 1. Python Backend ────────────────────────────────────────
check_env_file "backend/.env" \
  "Backend (Python/FastAPI)" \
  "DATABASE_URL" \
  "DEVICE_MODE" \
  "AGX_IP" \
  "WAKEWORD_BACKEND" \
  "WAKEWORD_AGX_IP" \
  "FRS_URL" \
  "ROBOT_AGENT_HOST" \
  "ROBOT_AGENT_PORT" \
  "ROBOT_SYNC_HOST" \
  "ROBOT_SYNC_PORT" \
  "LOCATIONS_JSON_PATH" \
  "ROBOT_SYNC_URL"

# ── 2. Client Dashboard (Next.js) ────────────────────────────
check_env_file "frontend/g1-dashboard/.env.local" \
  "Client Dashboard (Next.js)" \
  "NEXT_PUBLIC_API_URL"

# Also check .env if .env.local doesn't exist
if [ ! -f "frontend/g1-dashboard/.env.local" ]; then
  check_env_file "frontend/g1-dashboard/.env" \
    "Client Dashboard (Next.js) — .env fallback" \
    "NEXT_PUBLIC_API_URL"
fi

# ── 3. Super Admin Frontend ───────────────────────────────────
check_env_file "super_admin/frontend/.env" \
  "Super Admin Frontend (Next.js + Prisma)" \
  "DATABASE_URL" \
  "SA_JWT_SECRET" \
  "MASTER_ADMIN_EMAIL" \
  "MASTER_ADMIN_PASSWORD"

# ── 4. Docker / DB Health ────────────────────────────────────
echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${BOLD}🐳 Docker Containers (Databases)${RESET}"
if command -v docker &>/dev/null; then
  docker ps --format "  {{.Names}}: {{.Status}} (ports: {{.Ports}})" 2>/dev/null | grep -E "g1|kpi|postgres|pgvector" || echo -e "  ${YELLOW}No matching containers running${RESET}"
else
  echo -e "  ${YELLOW}Docker not available${RESET}"
fi

# ── 5. MQTT Broker ───────────────────────────────────────────
echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${BOLD}📡 MQTT Broker (localhost:1883)${RESET}"
if nc -z localhost 1883 2>/dev/null; then
  echo -e "  ${GREEN}✓ MQTT broker is RUNNING on port 1883${RESET}"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗ MQTT broker is NOT RUNNING — start with: sudo systemctl start mosquitto${RESET}"
  FAIL=$((FAIL + 1))
fi

# ── Summary ──────────────────────────────────────────────────
echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${BOLD}📊 Summary${RESET}"
echo -e "  ${GREEN}✓ Passed: $PASS${RESET}"
if [ "$FAIL" -gt 0 ]; then
  echo -e "  ${RED}✗ Failed/Missing: $FAIL${RESET}"
  echo ""
  echo -e "  ${YELLOW}⚠ Fix the missing variables above before starting services.${RESET}"
else
  echo -e "  ${GREEN}All checks passed! 🎉${RESET}"
fi
echo ""
