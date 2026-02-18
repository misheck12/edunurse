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
