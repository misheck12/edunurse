# Server Deployment (Docker)

This deploy setup runs:

- `frontend` (Vite build served by Nginx)
- `backend` (Fastify API)
- `worker` (export + async jobs)
- `postgres` (database)

## 1) Prepare environment

From repo root:

```bash
cp deploy/.env.server.example deploy/.env.server
```

Edit `deploy/.env.server` and set at minimum:

- `POSTGRES_PASSWORD`
- `AUTH_TOKEN_SECRET`
- `SUPERADMIN_EMAIL`
- `SUPERADMIN_PASSWORD`
- `FRONTEND_URL`
- `CORS_ORIGIN`
- at least one LLM provider key/config

## 2) Start database and run migrations

```bash
docker compose -f deploy/docker-compose.server.yml --env-file deploy/.env.server up -d postgres
docker compose -f deploy/docker-compose.server.yml --env-file deploy/.env.server --profile tools run --rm migrator
```

## 3) Start app services

```bash
docker compose -f deploy/docker-compose.server.yml --env-file deploy/.env.server up -d backend worker frontend
```

App will be available on `http://<server-ip>:${APP_PORT}` (default `80`).

## 4) Useful commands

Logs:

```bash
docker compose -f deploy/docker-compose.server.yml --env-file deploy/.env.server logs -f backend
docker compose -f deploy/docker-compose.server.yml --env-file deploy/.env.server logs -f worker
```

Restart:

```bash
docker compose -f deploy/docker-compose.server.yml --env-file deploy/.env.server restart backend worker frontend
```

Stop:

```bash
docker compose -f deploy/docker-compose.server.yml --env-file deploy/.env.server down
```

Stop and remove volumes (destructive):

```bash
docker compose -f deploy/docker-compose.server.yml --env-file deploy/.env.server down -v
```

## 5) TLS/Domain

Put this stack behind a reverse proxy (Nginx/Caddy/Traefik) with HTTPS and point your domain to the server.

## 6) Upgrade deployment

```bash
git pull
docker compose -f deploy/docker-compose.server.yml --env-file deploy/.env.server build
docker compose -f deploy/docker-compose.server.yml --env-file deploy/.env.server up -d
docker compose -f deploy/docker-compose.server.yml --env-file deploy/.env.server --profile tools run --rm migrator
```

## 7) GitHub Actions deploy

This repo includes `.github/workflows/deploy-production.yml` for automatic server deploys.

Required GitHub secrets:

- `SSH_HOST`
- `SSH_USER`
- `SSH_PRIVATE_KEY`
- `SSH_PORT` (optional, default `22`)
- `GHCR_USERNAME`
- `GHCR_TOKEN` (PAT with `read:packages` for server pull, and package access to this repo/org)
- `SERVER_ENV_FILE` (full contents of `deploy/.env.server`)

Recommended GitHub variable:

- `DEPLOY_PATH` (example: `/var/www/livingilabs/edunurse`)
- `VITE_API_BASE_URL` (optional)
- `VITE_GOOGLE_OAUTH_CLIENT_ID` (optional)
- `VITE_GOOGLE_OAUTH_REDIRECT_URI` (optional)

Behavior:

- Runs on push to `main`
- Supports manual deploy via `workflow_dispatch`
- Builds and pushes `backend`, `worker`, `migrator`, and `frontend` images to GHCR
- SSHes to server, pulls latest code, pulls image tags for current commit, runs migrator, then starts services

Quick setup from command line (`gh` CLI):

```bash
chmod +x deploy/setup-github-actions-env.sh
export SSH_HOST=your.server.host
export SSH_USER=your-ssh-user
export GHCR_TOKEN=ghp_xxx
deploy/setup-github-actions-env.sh --ssh-key-file ~/.ssh/id_rsa
```

What the script does:

- Sets deploy access secrets (`SSH_*`, `GHCR_*`)
- Uploads full `deploy/.env.server` as `SERVER_ENV_FILE`
- Syncs each key from `deploy/.env.server` as an environment secret by default

To skip per-key sync and set only `SERVER_ENV_FILE`:

```bash
deploy/setup-github-actions-env.sh --ssh-key-file ~/.ssh/id_rsa --no-sync-env-keys
```

Windows PowerShell (local terminal):

```powershell
gh auth login
$env:SSH_HOST="your.server.host"
$env:SSH_USER="your_ssh_user"
$env:GHCR_TOKEN="ghp_xxx"
.\deploy\setup-github-actions-env.ps1 -SshKeyFile "$HOME\.ssh\id_rsa"
```

Skip per-key sync:

```powershell
.\deploy\setup-github-actions-env.ps1 -SshKeyFile "$HOME\.ssh\id_rsa" -NoSyncEnvKeys
```
