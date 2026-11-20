#!/usr/bin/env bash
# One-command local start for UptimeIQ (API + UI + Go agent)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

ensure_env() {
  [[ -f "$2" ]] || [[ ! -f "$1" ]] || cp "$1" "$2"
}

echo "UptimeIQ — starting local stack..."

ensure_env "$ROOT/backend/.env.example" "$ROOT/backend/.env"
ensure_env "$ROOT/frontend/.env.example" "$ROOT/frontend/.env"

echo "→ backend deps"
(cd "$ROOT/backend" && python -m pip install -q -r requirements.txt)

echo "→ frontend deps"
(cd "$ROOT/frontend" && [[ -d node_modules ]] || npm install --silent)

echo "→ agent deps"
(cd "$ROOT/agent-go" && go mod download >/dev/null 2>&1 || true)

(cd "$ROOT/backend" && python -m uvicorn app.main:app --host 127.0.0.1 --port 8002) &
API_PID=$!
(cd "$ROOT/frontend" && npm run dev) &
UI_PID=$!
(cd "$ROOT/agent-go" && AGENT_WS_URL=ws://localhost:8002/ws/metrics go run .) &
AGENT_PID=$!

cleanup() {
  kill "$API_PID" "$UI_PID" "$AGENT_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo ""
echo "Running:"
echo "  UI     http://localhost:5173"
echo "  API    http://localhost:8002"
echo "  Login  admin / admin123  (demo only)"
echo ""
echo "Ctrl+C to stop."
wait
