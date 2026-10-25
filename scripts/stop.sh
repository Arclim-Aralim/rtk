#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
for service in gateway analytics; do
  file="$ROOT/run/$service.pid"
  [[ -f "$file" ]] || continue
  pid="$(cat "$file")"
  [[ "$pid" =~ ^[0-9]+$ ]] || { echo "Invalid PID: $service"; exit 1; }
  if kill -0 "$pid" 2>/dev/null; then
    # Refuse to stop a reused PID belonging to an unrelated process.
    command="$(tr '\0' ' ' < "/proc/$pid/cmdline")"
    if [[ "$service" == gateway && "$command" == *Gateway* ]] || [[ "$service" == analytics && "$command" == *uvicorn* && "$command" == *"$ROOT/services/analytics"* ]]; then
      kill "$pid"
      echo "Stopped $service"
    else
      echo "PID $pid does not match $service; leaving it alone" >&2
      exit 1
    fi
  fi
  rm -f -- "$file"
done
