<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1Aj4IUmCJL4CAcQLuF9APd2d9sfLiEsPy

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Backend (New)

Backend service lives in `backend/`.

1. `cd backend`
2. `cp .env.example .env` (or create `.env` manually on Windows)
3. `npm install`
4. Setup PostgreSQL and run migrations (see `backend/README.md`)
5. `npm run dev` (API)
6. `npm run dev:worker` (export worker)

## Frontend API Config

Set these in a frontend `.env.local` when needed:

```bash
VITE_API_BASE_URL=http://localhost:4000/api/v1
VITE_DEV_USER_ID=00000000-0000-4000-8000-000000000001
VITE_GOOGLE_OAUTH_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
VITE_GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000
```

## Deploy On Server (Docker)

Deployment assets are in `deploy/`.

1. Copy env file:
   ```bash
   cp deploy/.env.server.example deploy/.env.server
   ```
2. Update secrets and provider keys in `deploy/.env.server`.
3. Start DB and apply migrations:
   ```bash
   docker compose -f deploy/docker-compose.server.yml --env-file deploy/.env.server up -d postgres
   docker compose -f deploy/docker-compose.server.yml --env-file deploy/.env.server --profile tools run --rm migrator
   ```
4. Start app services:
   ```bash
   docker compose -f deploy/docker-compose.server.yml --env-file deploy/.env.server up -d backend worker frontend
   ```

Detailed guide: `deploy/README.md`.
