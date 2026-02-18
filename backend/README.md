# EduNurse Backend

Node/TypeScript API for curriculum-grounded document generation.

## Stack

- Fastify
- Prisma + PostgreSQL
- pgvector-ready schema

## Quick start

1. Copy `.env.example` to `.env`.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Ensure DB exists and run extensions:
   ```bash
   psql "$DATABASE_URL" -f prisma/sql/enable_extensions.sql
   ```
   If `psql` is unavailable:
   ```bash
   npx prisma db execute --file prisma/sql/enable_extensions.sql --schema prisma/schema.prisma
   ```
4. Apply schema:
   ```bash
   npx prisma migrate dev --name init
   ```
5. Vector/FTS indexes + trigger are now included in migrations. Do not run `prisma/sql/post_migration_indexes.sql` during normal setup.
   If your database was created before migration `20260216223000_curriculum_chunk_search_indexes` and `prisma migrate dev` reports drift on `curriculum_chunks` indexes, run once:
   ```bash
   npx prisma migrate resolve --applied 20260216223000_curriculum_chunk_search_indexes
   ```
6. Run API:
   ```bash
   npm run dev
   ```
7. In a second terminal, run export worker:
   ```bash
   npm run dev:worker
   ```
8. Optional seed data:
   ```bash
   npm run db:seed
   ```

## Auth model

Superadmin login endpoint:

- `POST /api/v1/auth/login`

Request body:

```json
{
  "email": "superadmin@edunurse.local",
  "password": "ChangeMe123!"
}
```

Auth tokens are signed using `AUTH_TOKEN_SECRET` and sent as:

- `Authorization: Bearer <token>`

During development, user-scoped endpoints still accept fallback:

- `x-user-id: <user-uuid>`

Default superadmin credentials are configured via:

- `SUPERADMIN_EMAIL`
- `SUPERADMIN_PASSWORD`

Curriculum management endpoints are superadmin-only:

- `POST /api/v1/curriculum/sources`
- `POST /api/v1/curriculum/versions`
- `POST /api/v1/curriculum/versions/:versionId/activate`
- `POST /api/v1/curriculum/sources/:sourceId/chunks/bulk`
- `GET /api/v1/admin/rag/connectors`
- `POST /api/v1/admin/rag/connectors`
- `PATCH /api/v1/admin/rag/connectors/:connectorId`
- `POST /api/v1/admin/rag/google-drive/oauth/exchange`
- `POST /api/v1/admin/rag/google-drive/connect`
- `POST /api/v1/admin/rag/google-drive/browse`
- `POST /api/v1/admin/rag/connectors/:connectorId/sync`
- `GET /api/v1/admin/rag/runs/:runId`

## API base

- `/api/v1/health`
- `/api/v1/auth/login`
- `/api/v1/users/me`
- `/api/v1/users/preferences`
- `/api/v1/templates`
- `/api/v1/admin/ai/health` (superadmin only)
- `/api/v1/admin/rag/*` (superadmin only)
- `/api/v1/admin/users` (superadmin only)
- `/api/v1/admin/users/:userId` (superadmin only)
- `/api/v1/admin/plans` (superadmin only)
- `/api/v1/admin/plans/:planId` (superadmin only)
- `/api/v1/admin/subscriptions` (superadmin only)
- `/api/v1/admin/subscriptions/:subscriptionId` (superadmin only)
- `/api/v1/admin/transactions` (superadmin only)
- `/api/v1/admin/transactions/:transactionId` (superadmin only)
- `/api/v1/admin/ops/overview` (superadmin only)
- `/api/v1/admin/ops/generation/runs` (superadmin only)
- `/api/v1/admin/ops/exports/jobs` (superadmin only)
- `/api/v1/admin/ops/curriculum/versions` (superadmin only)
- `/api/v1/admin/ops/curriculum/versions/:versionId/activate` (superadmin only)
- `/api/v1/documents`
- `/api/v1/curriculum`
- `/api/v1/generation/runs`
- `/api/v1/exports`
- `/api/v1/exports/:exportJobId/download`

## AI Provider Routing

Generation uses provider fallback in order from `LLM_PROVIDER_PRIORITY`.

Example:

```env
LLM_PROVIDER_PRIORITY=azure,gemini,deepseek
```

If the first provider fails, backend automatically tries the next configured one.

Required env vars by provider:

- Azure OpenAI:
  - `AZURE_OPENAI_ENDPOINT`
  - `AZURE_OPENAI_API_KEY`
  - `AZURE_OPENAI_DEPLOYMENT`
  - optional `AZURE_OPENAI_API_VERSION`
- Gemini:
  - `GEMINI_API_KEY`
  - optional `GEMINI_MODEL`
- DeepSeek:
  - `DEEPSEEK_API_KEY`
  - optional `DEEPSEEK_MODEL`
  - optional `DEEPSEEK_BASE_URL`

Embedding retrieval (hybrid RAG):

- `INGESTION_EMBEDDINGS_ENABLED=true`
- `EMBEDDING_PROVIDER_PRIORITY=azure,gemini,local`
- `EMBEDDING_VECTOR_DIM=1536`

Azure embedding config:

- `AZURE_OPENAI_EMBEDDING_DEPLOYMENT` (recommended `text-embedding-3-small` deployment)
- optional `AZURE_OPENAI_EMBEDDING_API_VERSION`

Gemini embedding config:

- `GEMINI_EMBEDDING_MODEL` (default `text-embedding-004`)

If cloud embedding providers are unavailable, backend falls back to local hashed embeddings so vector search still works.

Superadmin endpoint:

- `GET /api/v1/admin/ai/health`
- `GET /api/v1/admin/ai/health?probe=true`
  - `probe=true` performs live network checks (small billable requests) to configured providers.

## RAG Connectors

Connector types implemented:

- `google_drive`
- `web_url`
- `postgres`
- `mysql`

Sync lifecycle:

1. Create connector via `POST /api/v1/admin/rag/connectors` (or Google-specific OAuth flow below)
2. Queue sync via `POST /api/v1/admin/rag/connectors/:connectorId/sync`
3. Worker ingests into `curriculum_sources` + `curriculum_chunks`
4. Inspect run logs/counters via `GET /api/v1/admin/rag/runs/:runId`

Google Drive OAuth flow:

1. Frontend obtains Google authorization code (GIS code client)
2. Exchange code: `POST /api/v1/admin/rag/google-drive/oauth/exchange`
3. Browse folders/files: `POST /api/v1/admin/rag/google-drive/browse` with `oauthSessionId`
4. Create connector: `POST /api/v1/admin/rag/google-drive/connect`

Example connector payloads:

Google Drive (`POST /api/v1/admin/rag/google-drive/connect`)
```json
{
  "name": "NMCZ Drive Folder",
  "oauthSessionId": "b95d595a-f9c7-47d5-9225-7a51f49d5ca3",
  "mode": "folder",
  "folderId": "your-folder-id",
  "programme": "Registered Nursing",
  "sourceType": "syllabus"
}
```

Web URLs
```json
{
  "name": "Guideline URLs",
  "connectorType": "web_url",
  "configJson": {
    "urls": ["https://example.org/guideline-a", "https://example.org/guideline-b"],
    "programme": "Midwifery",
    "sourceType": "guideline"
  }
}
```

Postgres
```json
{
  "name": "Institution Postgres",
  "connectorType": "postgres",
  "configJson": {
    "connectionString": "postgresql://user:pass@host:5432/db",
    "query": "SELECT id, title, body, updated_at FROM curriculum_docs",
    "idColumn": "id",
    "titleColumn": "title",
    "textColumns": ["body"],
    "programme": "Registered Nursing",
    "sourceType": "standards"
  }
}
```

## Notes

- `generation_runs` and `generation_run_retrievals` are first-class audit records.
- `document_versions` stores immutable snapshots for reliable export + rollback.
- `curriculum_chunks` supports both vector and keyword retrieval paths.
- Export files are generated by worker into `EXPORT_STORAGE_DIR` and downloaded through the API route above.

## Production deployment

Use the server deployment stack in the repo root:

- `deploy/docker-compose.server.yml`
- `deploy/.env.server.example`
- `deploy/README.md`

`CORS_ORIGIN` supports comma-separated origins in production (for example app + ops domains).
