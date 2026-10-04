#!/usr/bin/env bash
set -euo pipefail

main() {
  local target="${1:-${SSH_ORIGINAL_COMMAND:-}}"

  cd "$(dirname "$(readlink -f "$0")")/.."
  git fetch --quiet origin main
  if [ -z "$target" ]; then
    target="$(git rev-parse origin/main)"
  fi
  if ! [[ "$target" =~ ^[0-9a-f]{40}$ ]]; then
    echo "Expected a full commit id, got: $target" >&2
    exit 1
  fi

  git checkout --quiet --detach "$target"
  echo "Deploying $(git log --oneline -1)"

  cd deploy
  docker compose -f compose.prod.yaml up -d --build --remove-orphans

  for _ in $(seq 1 30); do
    if docker compose -f compose.prod.yaml exec -T web wget -qO- http://api:8080/api/health >/dev/null 2>&1; then
      docker image prune -f >/dev/null
      docker builder prune -f --filter until=168h >/dev/null
      echo "Deployed $(git rev-parse --short HEAD)"
      exit 0
    fi
    sleep 2
  done

  echo "The API did not answer /api/health after the deploy" >&2
  docker compose -f compose.prod.yaml logs api --tail 50 >&2
  exit 1
}

main "$@"
