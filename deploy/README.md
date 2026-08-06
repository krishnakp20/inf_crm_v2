# Deploying inf-crm-v2 to inf.dialdesk.in

This replaces the old `inf-crm` (v1) deployment on the same domain. Apache
stays the public entrypoint (as it already is); the app itself runs in
Docker and is only reachable from Apache via `127.0.0.1:9001`, same as
before, so it doesn't interfere with anything else on the box.

Confirmed with the client: the current site has no real data (test/demo
only), so this is a straight swap — no data migration needed.

## 0. Prerequisites

Docker, Node.js, and certbot are already installed and working (they're
what's running the current site). Nothing new to install here.

## 1. Get the new code onto the server

```bash
sudo mkdir -p /var/www/inf-crm-v2
sudo chown $USER:$USER /var/www/inf-crm-v2
git clone <your-new-repo-url> /var/www/inf-crm-v2
cd /var/www/inf-crm-v2
```

Keep `/var/www/inf-crm` (the old v1 checkout) in place for now — don't
delete it until you've confirmed v2 is fully working. It costs nothing to
leave on disk and gives you an instant rollback path.

## 2. Backend secrets

```bash
cp backend/.env.production.example backend/.env.production
```

Edit `backend/.env.production` and fill in real values:
- `POSTGRES_PASSWORD` — any strong random password (can differ from v1's —
  this is a separate database, `infcrm_v2`, not shared with the old app)
- `SECRET_KEY` — generate with `openssl rand -hex 32`
- `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` / `SEED_ADMIN_NAME` — the real
  first admin account (log in and change the password immediately after
  first login)
- `CORS_ORIGINS` is already set to `https://inf.dialdesk.in`

This file has real secrets — it's gitignored, never commit it.

`frontend/.env.production` is already committed (just a public API URL, no
secrets) and points the built frontend at `https://inf.dialdesk.in/api/v1`.

Unlike v1 (which only bootstraps an admin account in production), this
compose file runs the full seed script on first boot — it's idempotent
(skips everything if an admin already exists), so the demo dataset is
created once and never wiped by later restarts.

## 3. Stop the old (v1) stack

The new stack reuses the same `127.0.0.1:9001` port and the same Apache
vhost, so the old containers must come down first:

```bash
cd /var/www/inf-crm
docker compose -f docker-compose.prod.yml --env-file backend/.env.production down
cd /var/www/inf-crm-v2
```

## 4. Apache: point the vhost at v2

```bash
sudo cp deploy/apache-inf.dialdesk.in.conf /etc/apache2/sites-available/inf.dialdesk.in.conf
sudo systemctl reload apache2
```

This is the same vhost file, just with `DocumentRoot` pointing at
`/var/www/inf-crm-v2/frontend/dist` instead of the old path. If a `:443`
block already exists in the live file (from the earlier `certbot --apache`
run for v1), copying this file over it removes that block — re-run
`sudo certbot --apache -d inf.dialdesk.in` afterward to re-add HTTPS (it
reuses the existing certificate, no new one is issued).

## 5. First deploy

```bash
chmod +x deploy/deploy.sh
./deploy/deploy.sh
```

This builds the frontend (`frontend/dist`, which Apache serves directly),
builds and starts the `postgres` + `api` containers, runs the Alembic
migrations, and seeds the demo dataset (idempotent — safe to re-run).

## 6. Verify

- Visit `https://inf.dialdesk.in`, log in with the `SEED_ADMIN_*`
  credentials from step 2, and change the password right away.
- `curl http://127.0.0.1:9001/health` should return `{"status":"ok"}`.
- `docker compose -f docker-compose.prod.yml --env-file backend/.env.production logs -f api`
  to watch logs (the `--env-file` flag is needed any time you run `docker
  compose` by hand against this file — it's what resolves `${POSTGRES_PASSWORD}`
  inside `docker-compose.prod.yml`; `deploy.sh` already does this for you).

## Once you're confident v2 is solid

Remove the old checkout and its volumes to free disk space:

```bash
cd /var/www/inf-crm
docker compose -f docker-compose.prod.yml --env-file backend/.env.production down -v
cd ..
sudo rm -rf inf-crm
```

## Subsequent deploys

Just run `./deploy/deploy.sh` again — it pulls latest code, rebuilds the
frontend, and rebuilds/restarts the containers. Migrations run automatically
on container start via Alembic.

## Notes

- Postgres has no host port mapping — it's only reachable from the `api`
  container over the internal Docker network, not from the outside or from
  other apps on this server.
- The `api` container is bound to `127.0.0.1:9001`, not `0.0.0.0`, so it's
  unreachable from outside even without a firewall rule — only Apache's
  reverse proxy on this same machine can reach it.
- Uploaded files (creator attachments) persist in a named Docker volume
  (`upload_data`), not inside the container, so they survive rebuilds.
- The database is `infcrm_v2`, separate from v1's `infcrm` — no shared
  state between the two deployments.
