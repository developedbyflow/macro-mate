#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

docker compose up -d --wait

cleanup() {
  trap '' INT TERM
  kill 0 2>/dev/null || true
  wait 2>/dev/null || true
  docker compose stop
}
trap cleanup EXIT

dotnet run --project api/MacroMate.Api &
pnpm --dir web dev
