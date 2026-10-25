#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
umask 077
mkdir -p run logs data/analytics data/gateway
if [[ ! -f .env ]]; then
  "$ROOT/.venv/bin/python" -c "import secrets; print('ADMIN_USER=admin'); print('ADMIN_PASSWORD='+secrets.token_urlsafe(24))" > .env
fi
set -a
source .env
set +a
if [[ -f run/analytics.pid ]] && kill -0 "$(cat run/analytics.pid)" 2>/dev/null; then
  echo 'Analytics already running'
else
  DATA_DIR="$ROOT/data/analytics" nohup "$ROOT/.venv/bin/python" -m uvicorn main:app --app-dir "$ROOT/services/analytics" --host 127.0.0.1 --port 8091 > logs/analytics.log 2>&1 < /dev/null &
  echo $! > run/analytics.pid
fi
if [[ -f run/gateway.pid ]] && kill -0 "$(cat run/gateway.pid)" 2>/dev/null; then
  echo 'Gateway already running'
else
  (cd "$ROOT/runtime/gateway" && exec env DATA_DIR="$ROOT/data/gateway" ANALYTICS_URL=http://127.0.0.1:8091/ ASPNETCORE_URLS=http://0.0.0.0:8080 DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=1 nohup ./Gateway > "$ROOT/logs/gateway.log" 2>&1 < /dev/null) &
  echo $! > run/gateway.pid
fi
echo 'Application: http://192.168.3.9:8080'
echo 'Initial credentials: .env (readable by owner only)'
