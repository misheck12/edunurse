import { env } from "../config.js";

type EmbeddingProvider = "azure" | "gemini" | "local";

export interface EmbeddingResult {
  vectors: number[][];
  provider: EmbeddingProvider;
  model: string;
}

function normalizeAzureEndpoint(rawEndpoint: string) {
  const trimmed = rawEndpoint.trim().replace(/\/+$/, "");

  try {
    const parsed = new URL(trimmed);
    const pathname = parsed.pathname || "";

    if (pathname.startsWith("/api/projects/")) {
      return parsed.origin;
    }

    if (
      pathname.startsWith("/openai/responses") ||
      pathname.startsWith("/openai/chat/completions") ||
      pathname.startsWith("/openai/deployments/")
    ) {
      return parsed.origin;
    }

    return trimmed;
  } catch {
    return trimmed;
  }
}

function parseProviderPriority(): EmbeddingProvider[] {
  const allowed: EmbeddingProvider[] = ["azure", "gemini", "local"];
  const configured = env.EMBEDDING_PROVIDER_PRIORITY.split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  const picked = configured.filter((value): value is EmbeddingProvider =>
    allowed.includes(value as EmbeddingProvider),
  );

  return picked.length > 0 ? picked : ["azure", "gemini", "local"];
}

function withTimeout(inputMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), inputMs);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  };
}

function normalizeVectorDimension(input: number[]) {
  const targetDim = env.EMBEDDING_VECTOR_DIM;
  const cleaned = input
    .map((value) => (Number.isFinite(value) ? value : 0))
    .slice(0, targetDim);

  while (cleaned.length < targetDim) {
    cleaned.push(0);
  }

  // L2 normalize so cosine distance behaves consistently.
  let norm = 0;
  for (const value of cleaned) {
    norm += value * value;
  }
  const magnitude = Math.sqrt(norm);
  if (magnitude > 0) {
    return cleaned.map((value) => Number((value / magnitude).toFixed(8)));
  }
  return cleaned;
}

function hashToken(token: string) {
  let hash = 2166136261;
  for (let i = 0; i < token.length; i += 1) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function localHashedEmbedding(text: string) {
  const dim = env.EMBEDDING_VECTOR_DIM;
  const vector = new Array<number>(dim).fill(0);
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((value) => value.trim())
    .filter((value) => value.length >= 2);

  for (const token of tokens) {
    const hash = hashToken(token);
    const idx = hash % dim;
    const sign = (hash >>> 31) === 0 ? 1 : -1;
    const tfBoost = Math.min(3, Math.max(1, Math.floor(token.length / 4)));
    vector[idx] += sign * tfBoost;
  }

  return normalizeVectorDimension(vector);
}

async function azureEmbeddings(texts: string[]): Promise<EmbeddingResult> {
  if (
    !env.AZURE_OPENAI_ENDPOINT ||
    !env.AZURE_OPENAI_API_KEY ||
    !env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT
  ) {
    throw new Error("Azure embedding provider is missing configuration.");
  }

  const endpoint = normalizeAzureEndpoint(env.AZURE_OPENAI_ENDPOINT);
  const url =
    `${endpoint}/openai/deployments/${encodeURIComponent(
      env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT,
    )}/embeddings?api-version=${encodeURIComponent(
      env.AZURE_OPENAI_EMBEDDING_API_VERSION,
    )}`;

  const timeout = withTimeout(env.EMBEDDING_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": env.AZURE_OPENAI_API_KEY,
      },
      signal: timeout.signal,
      body: JSON.stringify({
        input: texts,
      }),
    });

    const raw = await response.text();
    if (!response.ok) {
      throw new Error(
        `Azure embedding request failed: HTTP ${response.status} ${raw.slice(0, 200)}`,
      );
    }

    const payload = JSON.parse(raw) as {
      data?: Array<{ embedding?: number[] }>;
      model?: string;
    };
    const vectors = (payload.data ?? [])
      .map((row) => (Array.isArray(row.embedding) ? row.embedding : []))
      .map((vector) => normalizeVectorDimension(vector));

    if (vectors.length !== texts.length) {
      throw new Error(
        `Azure embedding response length mismatch. expected=${texts.length}, got=${vectors.length}`,
      );
    }

    return {
      vectors,
      provider: "azure",
      model:
        payload.model ??
        env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT ??
        "azure-embedding",
    };
  } finally {
    timeout.clear();
  }
}

async function geminiEmbeddingSingle(text: string) {
  if (!env.GEMINI_API_KEY) {
    throw new Error("Gemini embedding provider is missing configuration.");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    env.GEMINI_EMBEDDING_MODEL,
  )}:embedContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;

  const timeout = withTimeout(env.EMBEDDING_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      signal: timeout.signal,
      body: JSON.stringify({
        model: `models/${env.GEMINI_EMBEDDING_MODEL}`,
        content: {
          parts: [{ text }],
        },
      }),
    });

    const raw = await response.text();
    if (!response.ok) {
      throw new Error(
        `Gemini embedding request failed: HTTP ${response.status} ${raw.slice(0, 200)}`,
      );
    }

    const payload = JSON.parse(raw) as {
      embedding?: {
        values?: number[];
      };
    };
    return normalizeVectorDimension(payload.embedding?.values ?? []);
  } finally {
    timeout.clear();
  }
}

async function geminiEmbeddings(texts: string[]): Promise<EmbeddingResult> {
  if (!env.GEMINI_API_KEY) {
    throw new Error("Gemini embedding provider is missing configuration.");
  }

  const vectors: number[][] = [];
  for (const text of texts) {
    vectors.push(await geminiEmbeddingSingle(text));
  }

  return {
    vectors,
    provider: "gemini",
    model: env.GEMINI_EMBEDDING_MODEL,
  };
}

function localEmbeddings(texts: string[]): EmbeddingResult {
  return {
    vectors: texts.map((text) => localHashedEmbedding(text)),
    provider: "local",
    model: `hashing-${env.EMBEDDING_VECTOR_DIM}`,
  };
}

export function vectorToSqlLiteral(vector: number[]) {
  return `[${vector.map((value) => (Number.isFinite(value) ? value : 0)).join(",")}]`;
}

export async function embedTextsWithFallback(texts: string[]): Promise<EmbeddingResult> {
  const cleanTexts = texts.map((text) => text.trim());
  const failures: string[] = [];

  for (const provider of parseProviderPriority()) {
    try {
      if (provider === "azure") {
        return await azureEmbeddings(cleanTexts);
      }
      if (provider === "gemini") {
        return await geminiEmbeddings(cleanTexts);
      }
      return localEmbeddings(cleanTexts);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      failures.push(`${provider}: ${message}`);
    }
  }

  // Fallback of fallback: local must always work.
  if (failures.length > 0) {
    return localEmbeddings(cleanTexts);
  }

  return localEmbeddings(cleanTexts);
}

