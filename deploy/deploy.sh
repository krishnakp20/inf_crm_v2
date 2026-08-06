#!/usr/bin/env bash
# Run this from the repo root on the Ubuntu server (e.g. /var/www/inf-crm-v2)
# for every deploy after the first-time setup in deploy/README.md is done.
set -euo pipefail

echo "==> Pulling latest code"
git pull

echo "==> Building frontend"
cd frontend
npm ci
npm run build
cd ..

echo "==> Building and starting backend + postgres"
# --env-file is required here: it's what lets docker-compose substitute
# ${POSTGRES_PASSWORD} inside docker-compose.prod.yml itself. The env_file:
# line inside the compose file only injects vars into the api container's
# runtime — it does not feed compose-file variable substitution.
docker compose -f docker-compose.prod.yml --env-file backend/.env.production up -d --build

echo "==> Waiting for API to come up (migrations + seed run first, can take a while on a fresh DB)"
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:9001/health > /dev/null; then
    echo "API is up."
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "API health check failed after 60s. Check logs with:"
    echo "  docker compose -f docker-compose.prod.yml --env-file backend/.env.production logs api --tail=100"
    exit 1
  fi
  sleep 2
done

echo "==> Reloading Apache (picks up new static files automatically, this is just in case)"
sudo systemctl reload apache2

echo "==> Done. https://inf.dialdesk.in"
