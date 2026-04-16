import { FastifyPluginAsync } from "fastify";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireAdminUser } from "../services/auth-helpers.js";
import { env } from "../config.js";
import { ensureServiceEnabled } from "../services/service-controls.js";

const connectorTypeSchema = z.enum([
  "google_drive",
  "web_url",
  "postgres",
  "mysql",
  "manual_upload",
]);

const connectorStatusSchema = z.enum(["active", "paused", "error"]);

const createConnectorSchema = z.object({
  name: z.string().min(1),
  connectorType: connectorTypeSchema,
  configJson: z.record(z.any()).default({}),
  secretJson: z.record(z.any()).optional(),
  defaultCurriculumVersionId: z.string().uuid().optional(),
});

const updateConnectorSchema = z.object({
  name: z.string().min(1).optional(),
  status: connectorStatusSchema.optional(),
  configJson: z.record(z.any()).optional(),
  secretJson: z.record(z.any()).optional(),
  defaultCurriculumVersionId: z.string().uuid().nullable().optional(),
});

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

const googleDriveOauthExchangeSchema = z.object({
  authorizationCode: z.string().min(1),
  redirectUri: z.string().min(1).optional(),
});

const googleDriveConnectSchema = z.object({
  oauthSessionId: z.string().uuid(),
  name: z.string().min(1),
  mode: z.enum(["folder", "files"]).default("folder"),
  folderId: z.string().min(1).optional(),
  fileIds: z.array(z.string().min(1)).default([]),
  programme: z.string().min(1).optional(),
  sourceType: z.enum(["syllabus", "standards", "guideline"]).default("guideline"),
  defaultCurriculumVersionId: z.string().uuid().optional(),
});

const googleDriveBrowseSchema = z
  .object({
  accessToken: z.string().min(1).optional(),
  oauthSessionId: z.string().uuid().optional(),
  connectorId: z.string().uuid().optional(),
  folderId: z.string().min(1).optional(),
  pageSize: z.coerce.number().int().positive().max(200).default(100),
  pageToken: z.string().optional(),
  })
  .refine(
    (value) =>
      Boolean(value.accessToken || value.oauthSessionId || value.connectorId),
    {
      message:
        "Provide one of accessToken, oauthSessionId, or connectorId to browse Google Drive.",
    },
  );

type GoogleOauthSession = {
  id: string;
  userId: string;
  accessToken: string;
  refreshToken?: string;
  scope?: string;
  tokenType?: string;
  expiresAt: number;
  createdAt: number;
};

const GOOGLE_OAUTH_SESSION_TTL_MS = 1000 * 60 * 20;
const googleOauthSessions = new Map<string, GoogleOauthSession>();
const SHARED_WITH_ME_FOLDER_TOKEN = "__shared_with_me__";

function normalizeGoogleDriveFolderId(raw?: string) {
  if (!raw) return "root";
  const input = raw.trim();
  if (!input) return "root";

  const folderPathMatch = input.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderPathMatch?.[1]) {
    return folderPathMatch[1];
  }

  const idQueryMatch = input.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idQueryMatch?.[1]) {
    return idQueryMatch[1];
  }

  if (
    input.toLowerCase() === "sharedwithme" ||
    input.toLowerCase() === "shared_with_me" ||
    input.toLowerCase() === "shared-with-me"
  ) {
    return SHARED_WITH_ME_FOLDER_TOKEN;
  }

  return input;
}

async function fetchWithTimeout(url: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.CONNECTOR_HTTP_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function requireGoogleOauthConfig() {
  if (!env.GOOGLE_OAUTH_CLIENT_ID || !env.GOOGLE_OAUTH_CLIENT_SECRET) {
    throw new Error(
      "Google OAuth is not configured. Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET.",
    );
  }
}

function cleanupGoogleOauthSessions() {
  const now = Date.now();
  for (const [sessionId, session] of googleOauthSessions.entries()) {
    if (now - session.createdAt > GOOGLE_OAUTH_SESSION_TTL_MS) {
      googleOauthSessions.delete(sessionId);
    }
  }
}

function sessionToSecretJson(session: GoogleOauthSession) {
  const expiresAtIso = new Date(session.expiresAt).toISOString();
  return {
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    expiresAt: expiresAtIso,
    tokenType: session.tokenType,
    scope: session.scope,
    googleOAuth: {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      expiresAt: expiresAtIso,
      tokenType: session.tokenType,
      scope: session.scope,
    },
  };
}

async function exchangeGoogleAuthorizationCode(
  authorizationCode: string,
  redirectUri: string,
) {
  requireGoogleOauthConfig();

  const response = await fetchWithTimeout("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code: authorizationCode,
      client_id: env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const body = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !body.access_token) {
    const details = body.error_description ?? body.error ?? "OAuth exchange failed.";
    throw new Error(`Google OAuth exchange failed: ${details}`);
  }

  const expiresIn = typeof body.expires_in === "number" ? body.expires_in : 3600;
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    scope: body.scope,
    tokenType: body.token_type,
    expiresAt: Date.now() + expiresIn * 1000,
  };
}

async function refreshGoogleAccessToken(refreshToken: string) {
  requireGoogleOauthConfig();

  const response = await fetchWithTimeout("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });

  const body = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !body.access_token) {
    const details = body.error_description ?? body.error ?? "OAuth refresh failed.";
    throw new Error(`Google OAuth refresh failed: ${details}`);
  }

  const expiresIn = typeof body.expires_in === "number" ? body.expires_in : 3600;
  return {
    accessToken: body.access_token,
    expiresAt: Date.now() + expiresIn * 1000,
    scope: body.scope,
    tokenType: body.token_type,
  };
}

function parseConnectorGoogleSecret(secretRaw: unknown) {
  const secret =
    secretRaw && typeof secretRaw === "object" && !Array.isArray(secretRaw)
      ? (secretRaw as Record<string, unknown>)
      : {};
  const googleOAuth =
    secret.googleOAuth &&
    typeof secret.googleOAuth === "object" &&
    !Array.isArray(secret.googleOAuth)
      ? (secret.googleOAuth as Record<string, unknown>)
      : {};

  const accessToken =
    (typeof googleOAuth.accessToken === "string" && googleOAuth.accessToken) ||
    (typeof secret.accessToken === "string" ? secret.accessToken : "");
  const refreshToken =
    (typeof googleOAuth.refreshToken === "string" && googleOAuth.refreshToken) ||
    (typeof secret.refreshToken === "string" ? secret.refreshToken : "");
  const expiresAtRaw =
    (typeof googleOAuth.expiresAt === "string" && googleOAuth.expiresAt) ||
    (typeof secret.expiresAt === "string" ? secret.expiresAt : "");
  const expiresAt = expiresAtRaw ? Date.parse(expiresAtRaw) : 0;

  return {
    accessToken,
    refreshToken,
    expiresAt: Number.isFinite(expiresAt) ? expiresAt : 0,
    tokenType:
      (typeof googleOAuth.tokenType === "string" && googleOAuth.tokenType) ||
      (typeof secret.tokenType === "string" ? secret.tokenType : undefined),
    scope:
      (typeof googleOAuth.scope === "string" && googleOAuth.scope) ||
      (typeof secret.scope === "string" ? secret.scope : undefined),
  };
}

function hasConnectorSecret(secretRaw: unknown) {
  return Boolean(
    secretRaw &&
      typeof secretRaw === "object" &&
      !Array.isArray(secretRaw) &&
      Object.keys(secretRaw as Record<string, unknown>).length > 0,
  );
}

function toPublicConnector<T extends { connectorType: string; secretJson?: unknown }>(
  connector: T,
) {
  const googleDriveConnected =
    connector.connectorType === "google_drive"
      ? Boolean(parseConnectorGoogleSecret(connector.secretJson).refreshToken)
      : null;
  const hasStoredSecret = hasConnectorSecret(connector.secretJson);
  const connectorRecord = connector as T & { secretJson?: unknown };
  const { secretJson: _secretJson, ...safeConnector } = connectorRecord;

  return {
    ...safeConnector,
    hasStoredSecret,
    googleDriveConnected,
  } as Omit<T, "secretJson"> & {
    hasStoredSecret: boolean;
    googleDriveConnected: boolean | null;
  };
}

type IngestionQualitySummary = {
  chunksIndexed: number;
  chunksEmbedded: number;
  semesterMetadataCoveragePct: number;
  courseMetadataCoveragePct: number;
};

function toCount(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function toCoverage(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return Number(((numerator / denominator) * 100).toFixed(1));
}

function emptyIngestionQuality(): IngestionQualitySummary {
  return {
    chunksIndexed: 0,
    chunksEmbedded: 0,
    semesterMetadataCoveragePct: 0,
    courseMetadataCoveragePct: 0,
  };
}

function qualityFromCounts(input: {
  chunksIndexed: unknown;
  chunksEmbedded: unknown;
  chunksWithSemester: unknown;
  chunksWithCourse: unknown;
}) {
  const chunksIndexed = toCount(input.chunksIndexed);
  const chunksEmbedded = toCount(input.chunksEmbedded);
  const chunksWithSemester = toCount(input.chunksWithSemester);
  const chunksWithCourse = toCount(input.chunksWithCourse);

  return {
    chunksIndexed,
    chunksEmbedded,
    semesterMetadataCoveragePct: toCoverage(chunksWithSemester, chunksIndexed),
    courseMetadataCoveragePct: toCoverage(chunksWithCourse, chunksIndexed),
  } satisfies IngestionQualitySummary;
}

async function getConnectorIngestionQuality(
  app: Parameters<FastifyPluginAsync>[0],
  connectorId: string,
) {
  const rows = await app.prisma.$queryRawUnsafe<
    Array<{
      chunksIndexed: bigint | number | string;
      chunksEmbedded: bigint | number | string;
      chunksWithSemester: bigint | number | string;
      chunksWithCourse: bigint | number | string;
    }>
  >(
    `
      SELECT
        COUNT(*) AS "chunksIndexed",
        COUNT(*) FILTER (WHERE cc.embedding IS NOT NULL) AS "chunksEmbedded",
        COUNT(*) FILTER (
          WHERE COALESCE(NULLIF(cc.year_tag, ''), NULLIF(cc.metadata_json ->> 'semester', '')) IS NOT NULL
        ) AS "chunksWithSemester",
        COUNT(*) FILTER (
          WHERE COALESCE(NULLIF(cc.metadata_json ->> 'courseTitle', ''), NULLIF(cc.course_code, '')) IS NOT NULL
        ) AS "chunksWithCourse"
      FROM curriculum_chunks cc
      INNER JOIN curriculum_sources cs ON cs.id = cc.source_id
      WHERE cs.connector_id = '${connectorId}'::uuid
    `,
  );

  if (!rows[0]) {
    return emptyIngestionQuality();
  }

  return qualityFromCounts(rows[0]);
}

async function getRunIngestionQualityMap(
  app: Parameters<FastifyPluginAsync>[0],
  runIds: string[],
) {
  if (runIds.length === 0) {
    return new Map<string, IngestionQualitySummary>();
  }

  const inList = runIds.map((id) => `'${id}'::uuid`).join(", ");
  const rows = await app.prisma.$queryRawUnsafe<
    Array<{
      runId: string;
      chunksIndexed: bigint | number | string;
      chunksEmbedded: bigint | number | string;
      chunksWithSemester: bigint | number | string;
      chunksWithCourse: bigint | number | string;
    }>
  >(
    `
      SELECT
        cl.connector_run_id::text AS "runId",
        COUNT(*) AS "chunksIndexed",
        COUNT(*) FILTER (WHERE cc.embedding IS NOT NULL) AS "chunksEmbedded",
        COUNT(*) FILTER (
          WHERE COALESCE(NULLIF(cc.year_tag, ''), NULLIF(cc.metadata_json ->> 'semester', '')) IS NOT NULL
        ) AS "chunksWithSemester",
        COUNT(*) FILTER (
          WHERE COALESCE(NULLIF(cc.metadata_json ->> 'courseTitle', ''), NULLIF(cc.course_code, '')) IS NOT NULL
        ) AS "chunksWithCourse"
      FROM chunk_lineages cl
      INNER JOIN curriculum_chunks cc ON cc.id = cl.curriculum_chunk_id
      WHERE cl.connector_run_id IN (${inList})
      GROUP BY cl.connector_run_id
    `,
  );

  const map = new Map<string, IngestionQualitySummary>();
  for (const row of rows) {
    map.set(row.runId, qualityFromCounts(row));
  }
  return map;
}

const adminRagRoutes: FastifyPluginAsync = async (app) => {
  app.post("/google-drive/oauth/exchange", async (request) => {
    const admin = await requireAdminUser(app, request);
    cleanupGoogleOauthSessions();
    const body = googleDriveOauthExchangeSchema.parse(request.body);

    const tokenResult = await exchangeGoogleAuthorizationCode(
      body.authorizationCode,
      body.redirectUri ?? env.GOOGLE_OAUTH_REDIRECT_URI,
    );

    const oauthSessionId = randomUUID();
    googleOauthSessions.set(oauthSessionId, {
      id: oauthSessionId,
      userId: admin.id,
      accessToken: tokenResult.accessToken,
      refreshToken: tokenResult.refreshToken,
      scope: tokenResult.scope,
      tokenType: tokenResult.tokenType,
      expiresAt: tokenResult.expiresAt,
      createdAt: Date.now(),
    });

    return {
      oauthSessionId,
      expiresAt: new Date(tokenResult.expiresAt).toISOString(),
      hasRefreshToken: Boolean(tokenResult.refreshToken),
    };
  });

  app.post("/google-drive/connect", async (request, reply) => {
    const admin = await requireAdminUser(app, request);
    cleanupGoogleOauthSessions();
    const body = googleDriveConnectSchema.parse(request.body);

    const session = googleOauthSessions.get(body.oauthSessionId);
    if (!session) {
      throw app.httpErrors.notFound(
        "OAuth session expired. Connect Google Drive again.",
      );
    }
    if (session.userId !== admin.id) {
      throw app.httpErrors.forbidden(
        "OAuth session belongs to another admin user.",
      );
    }

    if (!session.refreshToken) {
      throw app.httpErrors.badRequest(
        "Google did not return refresh token. Reconnect with consent to grant offline access.",
      );
    }

    if (body.mode === "files" && body.fileIds.length === 0) {
      throw app.httpErrors.badRequest("Select at least one file for file mode.");
    }

    const connector = await app.prisma.connector.create({
      data: {
        name: body.name,
        connectorType: "google_drive",
        status: "active",
        configJson: {
          sourceType: body.sourceType,
          programme: body.programme ?? null,
          ...(body.mode === "folder"
            ? { folderId: normalizeGoogleDriveFolderId(body.folderId) }
            : { fileIds: body.fileIds }),
          syncCursor: {
            lastSyncAt: null,
            lastIngestionRunId: null,
          },
        },
        secretJson: sessionToSecretJson(session),
        defaultCurriculumVersionId: body.defaultCurriculumVersionId,
        createdByUserId: admin.id,
      },
    });

    return reply.code(201).send(toPublicConnector(connector));
  });

  app.post("/google-drive/browse", async (request) => {
    const admin = await requireAdminUser(app, request);
    cleanupGoogleOauthSessions();
    const body = googleDriveBrowseSchema.parse(request.body);

    let accessToken = body.accessToken?.trim() ?? "";

    if (!accessToken && body.oauthSessionId) {
      const session = googleOauthSessions.get(body.oauthSessionId);
      if (!session) {
        throw app.httpErrors.notFound(
          "OAuth session expired. Connect Google Drive again.",
        );
      }
      if (session.userId !== admin.id) {
        throw app.httpErrors.forbidden(
          "OAuth session belongs to another admin user.",
        );
      }

      if (Date.now() >= session.expiresAt - 30_000 && session.refreshToken) {
        const refreshed = await refreshGoogleAccessToken(session.refreshToken);
        session.accessToken = refreshed.accessToken;
        session.expiresAt = refreshed.expiresAt;
        session.scope = refreshed.scope ?? session.scope;
        session.tokenType = refreshed.tokenType ?? session.tokenType;
        googleOauthSessions.set(session.id, session);
      }
      accessToken = session.accessToken;
    }

    if (!accessToken && body.connectorId) {
      const connector = await app.prisma.connector.findUnique({
        where: { id: body.connectorId },
        select: {
          id: true,
          connectorType: true,
          secretJson: true,
        },
      });

      if (!connector || connector.connectorType !== "google_drive") {
        throw app.httpErrors.notFound("Google Drive connector not found.");
      }

      const parsed = parseConnectorGoogleSecret(connector.secretJson);
      if (!parsed.accessToken) {
        throw app.httpErrors.badRequest(
          "Connector is missing OAuth access token.",
        );
      }

      let tokenToUse = parsed.accessToken;
      if (Date.now() >= parsed.expiresAt - 30_000 && parsed.refreshToken) {
        const refreshed = await refreshGoogleAccessToken(parsed.refreshToken);
        tokenToUse = refreshed.accessToken;
        await app.prisma.connector.update({
          where: { id: connector.id },
          data: {
            secretJson: {
              accessToken: refreshed.accessToken,
              refreshToken: parsed.refreshToken,
              expiresAt: new Date(refreshed.expiresAt).toISOString(),
              tokenType: refreshed.tokenType ?? parsed.tokenType,
              scope: refreshed.scope ?? parsed.scope,
              googleOAuth: {
                accessToken: refreshed.accessToken,
                refreshToken: parsed.refreshToken,
                expiresAt: new Date(refreshed.expiresAt).toISOString(),
                tokenType: refreshed.tokenType ?? parsed.tokenType,
                scope: refreshed.scope ?? parsed.scope,
              },
            },
          },
        });
      }
      accessToken = tokenToUse;
    }

    if (!accessToken) {
      throw app.httpErrors.badRequest(
        "Unable to resolve Google access token for browsing.",
      );
    }

    const parentFolderId = normalizeGoogleDriveFolderId(body.folderId);
    const query =
      parentFolderId === SHARED_WITH_ME_FOLDER_TOKEN
        ? "sharedWithMe=true and trashed=false"
        : `'${parentFolderId}' in parents and trashed=false`;
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
      query,
    )}&pageSize=${body.pageSize}&fields=nextPageToken,files(id,name,mimeType,modifiedTime,webViewLink)&supportsAllDrives=true&includeItemsFromAllDrives=true${
      body.pageToken ? `&pageToken=${encodeURIComponent(body.pageToken)}` : ""
    }`;

    const response = await fetchWithTimeout(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const details = await response.text();
      throw app.httpErrors.badRequest(
        `Google Drive browse failed: ${response.status} ${details.slice(0, 220)}`,
      );
    }

    const payload = (await response.json()) as {
      nextPageToken?: string;
      files?: Array<{
        id?: string;
        name?: string;
        mimeType?: string;
        modifiedTime?: string;
        webViewLink?: string;
      }>;
    };

    return {
      folderId: parentFolderId,
      nextPageToken: payload.nextPageToken ?? null,
      items: (payload.files ?? []).map((file) => ({
        id: file.id ?? "",
        name: file.name ?? "Untitled",
        mimeType: file.mimeType ?? "application/octet-stream",
        modifiedTime: file.modifiedTime ?? null,
        webViewLink: file.webViewLink ?? null,
        isFolder:
          file.mimeType === "application/vnd.google-apps.folder",
      })),
    };
  });

  app.get("/connectors", async (request) => {
    await requireAdminUser(app, request);
    const query = paginationSchema.parse(request.query);
    const skip = (query.page - 1) * query.pageSize;

    const [total, items] = await app.prisma.$transaction([
      app.prisma.connector.count(),
      app.prisma.connector.findMany({
        include: {
          runs: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: query.pageSize,
      }),
    ]);

    return {
      page: query.page,
      pageSize: query.pageSize,
      total,
      items: items.map((item) => toPublicConnector(item)),
    };
  });

  app.post("/connectors", async (request, reply) => {
    const admin = await requireAdminUser(app, request);
    const body = createConnectorSchema.parse(request.body);

    const connector = await app.prisma.connector.create({
      data: {
        name: body.name,
        connectorType: body.connectorType,
        status: "active",
        configJson: body.configJson,
        secretJson: body.secretJson,
        defaultCurriculumVersionId: body.defaultCurriculumVersionId,
        createdByUserId: admin.id,
      },
    });

    return reply.code(201).send(toPublicConnector(connector));
  });

  app.get("/connectors/:connectorId", async (request) => {
    await requireAdminUser(app, request);
    const params = z.object({ connectorId: z.string().uuid() }).parse(request.params);

    const connector = await app.prisma.connector.findUnique({
      where: { id: params.connectorId },
      include: {
        runs: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        externalDocuments: {
          orderBy: { updatedAt: "desc" },
          take: 20,
          include: {
            latestVersion: {
              select: {
                id: true,
                checksum: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    if (!connector) {
      throw app.httpErrors.notFound("Connector not found");
    }

    const runQualityMap = await getRunIngestionQualityMap(
      app,
      connector.runs.map((run) => run.id),
    );
    const ingestionQuality = await getConnectorIngestionQuality(app, connector.id);

    return {
      ...toPublicConnector(connector),
      runs: connector.runs.map((run) => ({
        ...run,
        ingestionQuality: runQualityMap.get(run.id) ?? emptyIngestionQuality(),
      })),
      ingestionQuality,
    };
  });

  app.patch("/connectors/:connectorId", async (request) => {
    await requireAdminUser(app, request);
    const params = z.object({ connectorId: z.string().uuid() }).parse(request.params);
    const body = updateConnectorSchema.parse(request.body);

    const existing = await app.prisma.connector.findUnique({
      where: { id: params.connectorId },
      select: { id: true },
    });

    if (!existing) {
      throw app.httpErrors.notFound("Connector not found");
    }

    const updated = await app.prisma.connector.update({
      where: { id: params.connectorId },
      data: {
        name: body.name,
        status: body.status,
        configJson: body.configJson,
        secretJson: body.secretJson,
        defaultCurriculumVersionId:
          body.defaultCurriculumVersionId === undefined
            ? undefined
            : body.defaultCurriculumVersionId,
      },
    });

    return toPublicConnector(updated);
  });

  app.post("/connectors/:connectorId/sync", async (request, reply) => {
    const admin = await requireAdminUser(app, request);
    await ensureServiceEnabled(app, "rag_connector_sync");
    const params = z.object({ connectorId: z.string().uuid() }).parse(request.params);

    const connector = await app.prisma.connector.findUnique({
      where: { id: params.connectorId },
      select: {
        id: true,
        status: true,
        connectorType: true,
        secretJson: true,
      },
    });

    if (!connector) {
      throw app.httpErrors.notFound("Connector not found");
    }

    if (connector.status === "paused") {
      throw app.httpErrors.conflict("Connector is paused. Activate before syncing.");
    }

    if (connector.connectorType === "google_drive") {
      const parsed = parseConnectorGoogleSecret(connector.secretJson);
      if (!parsed.refreshToken) {
        throw app.httpErrors.conflict(
          "Google Drive connector is disconnected or missing refresh token. Reconnect from Ops.",
        );
      }
    }

    const run = await app.prisma.connectorRun.create({
      data: {
        connectorId: connector.id,
        initiatedByUserId: admin.id,
        status: "queued",
      },
    });

    await app.prisma.job.create({
      data: {
        jobType: "ingestion",
        status: "queued",
        payloadJson: {
          connectorRunId: run.id,
        },
      },
    });

    return reply.code(202).send({
      message: "Connector sync queued.",
      runId: run.id,
      connectorId: connector.id,
    });
  });

  app.post("/connectors/:connectorId/disconnect", async (request) => {
    await requireAdminUser(app, request);
    const params = z.object({ connectorId: z.string().uuid() }).parse(request.params);

    const connector = await app.prisma.connector.findUnique({
      where: { id: params.connectorId },
      select: {
        id: true,
        connectorType: true,
      },
    });

    if (!connector) {
      throw app.httpErrors.notFound("Connector not found");
    }

    if (connector.connectorType !== "google_drive") {
      throw app.httpErrors.badRequest("Disconnect is only available for google_drive connectors.");
    }

    const updated = await app.prisma.connector.update({
      where: { id: connector.id },
      data: {
        status: "paused",
        secretJson: {},
      },
    });

    return {
      message: "Google Drive connector disconnected.",
      connector: toPublicConnector(updated),
    };
  });

  app.get("/runs/:runId", async (request) => {
    await requireAdminUser(app, request);
    const params = z.object({ runId: z.string().uuid() }).parse(request.params);

    const run = await app.prisma.connectorRun.findUnique({
      where: { id: params.runId },
      include: {
        connector: {
          select: {
            id: true,
            name: true,
            connectorType: true,
          },
        },
      },
    });

    if (!run) {
      throw app.httpErrors.notFound("Connector run not found");
    }

    const runQualityMap = await getRunIngestionQualityMap(app, [run.id]);
    return {
      ...run,
      ingestionQuality: runQualityMap.get(run.id) ?? emptyIngestionQuality(),
    };
  });

  app.get("/connectors/:connectorId/runs", async (request) => {
    await requireAdminUser(app, request);
    const params = z.object({ connectorId: z.string().uuid() }).parse(request.params);
    const query = paginationSchema.parse(request.query);
    const skip = (query.page - 1) * query.pageSize;

    const [total, items] = await app.prisma.$transaction([
      app.prisma.connectorRun.count({
        where: { connectorId: params.connectorId },
      }),
      app.prisma.connectorRun.findMany({
        where: { connectorId: params.connectorId },
        orderBy: { createdAt: "desc" },
        skip,
        take: query.pageSize,
      }),
    ]);

    const runQualityMap = await getRunIngestionQualityMap(
      app,
      items.map((run) => run.id),
    );

    return {
      page: query.page,
      pageSize: query.pageSize,
      total,
      items: items.map((run) => ({
        ...run,
        ingestionQuality: runQualityMap.get(run.id) ?? emptyIngestionQuality(),
      })),
    };
  });
};

export default adminRagRoutes;
