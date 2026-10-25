#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
for service in gateway analytics; do
  if [[ -f "$ROOT/run/$service.pid" ]] && kill -0 "$(cat "$ROOT/run/$service.pid")" 2>/dev/null; then echo "$service: running"; else echo "$service: stopped"; fi
done
curl --fail --silent http://127.0.0.1:8080/api/health
echo
