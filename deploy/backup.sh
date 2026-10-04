#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
mkdir -p backups
docker compose -f compose.prod.yaml exec -T db pg_dump -U macromate macromate | gzip > "backups/macromate-$(date +%F).sql.gz"
ls -1t backups/macromate-*.sql.gz | tail -n +15 | xargs -r rm --
