import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { env } from "../config.js";
import { requireAdminUser } from "../services/auth-helpers.js";

type ProviderName = "azure" | "gemini" | "deepseek";

const querySchema = z.object({
  probe: z.coerce.boolean().default(false),
  timeoutMs: z.coerce.number().int().positive().max(30000).default(10000),
});

const allowedProviders: ProviderName[] = ["azure", "gemini", "deepseek"];

function providerPriority() {
  const parsed = env.LLM_PROVIDER_PRIORITY.split(",")
    .map((item) => item.trim().toLowerCase())
    .filter((item): item is ProviderName =>
      allowedProviders.includes(item as ProviderName),
    );

  return parsed.length > 0 ? parsed : allowedProviders;
}

function maskSecret(value?: string) {
  if (!value) return null;
  if (value.length < 8) return "***";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function getAzureConfigStatus() {
  const missing: string[] = [];
  if (!env.AZURE_OPENAI_ENDPOINT) missing.push("AZURE_OPENAI_ENDPOINT");
  if (!env.AZURE_OPENAI_API_KEY) missing.push("AZURE_OPENAI_API_KEY");
  if (!env.AZURE_OPENAI_DEPLOYMENT) missing.push("AZURE_OPENAI_DEPLOYMENT");

  return {
    configured: missing.length === 0,
    missing,
    model: env.AZURE_OPENAI_DEPLOYMENT ?? null,
    endpoint: env.AZURE_OPENAI_ENDPOINT ?? null,
    apiVersion: env.AZURE_OPENAI_API_VERSION,
    keyPreview: maskSecret(env.AZURE_OPENAI_API_KEY),
  };
}

function getGeminiConfigStatus() {
  const missing: string[] = [];
  if (!env.GEMINI_API_KEY) missing.push("GEMINI_API_KEY");

  return {
    configured: missing.length === 0,
    missing,
    model: env.GEMINI_MODEL,
    keyPreview: maskSecret(env.GEMINI_API_KEY),
  };
}

function getDeepSeekConfigStatus() {
  const missing: string[] = [];
  if (!env.DEEPSEEK_API_KEY) missing.push("DEEPSEEK_API_KEY");

  return {
    configured: missing.length === 0,
    missing,
    model: env.DEEPSEEK_MODEL,
    baseUrl: env.DEEPSEEK_BASE_URL,
    keyPreview: maskSecret(env.DEEPSEEK_API_KEY),
  };
}

async function timedFetch(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<{ ok: boolean; statusCode?: number; latencyMs: number; message: string }> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
    const body = await response.text();
    const latencyMs = Date.now() - startedAt;

    if (!response.ok) {
      return {
        ok: false,
        statusCode: response.status,
        latencyMs,
        message: body.slice(0, 240) || response.statusText,
      };
    }

    return {
      ok: true,
      statusCode: response.status,
      latencyMs,
      message: "ok",
    };
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    return {
      ok: false,
      latencyMs,
      message: error instanceof Error ? error.message : "Unknown probe error",
    };
  } finally {
    clearTimeout(timer);
  }
}

async function probeAzure(timeoutMs: number) {
  const config = getAzureConfigStatus();
  if (!config.configured) {
    return {
      attempted: false,
      ok: false,
      message: `Not configured: ${config.missing.join(", ")}`,
    };
  }

  const endpoint = env.AZURE_OPENAI_ENDPOINT!.replace(/\/$/, "");
  const url = `${endpoint}/openai/deployments/${env.AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=${env.AZURE_OPENAI_API_VERSION}`;

  return {
    attempted: true,
    ...(await timedFetch(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": env.AZURE_OPENAI_API_KEY!,
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: "Reply with OK." }],
          max_tokens: 8,
          temperature: 0,
        }),
      },
      timeoutMs,
    )),
  };
}

async function probeGemini(timeoutMs: number) {
  const config = getGeminiConfigStatus();
  if (!config.configured) {
    return {
      attempted: false,
      ok: false,
      message: `Not configured: ${config.missing.join(", ")}`,
    };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    env.GEMINI_MODEL,
  )}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY!)}`;

  return {
    attempted: true,
    ...(await timedFetch(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "Reply with OK." }] }],
          generationConfig: {
            maxOutputTokens: 8,
            temperature: 0,
          },
        }),
      },
      timeoutMs,
    )),
  };
}

async function probeDeepSeek(timeoutMs: number) {
  const config = getDeepSeekConfigStatus();
  if (!config.configured) {
    return {
      attempted: false,
      ok: false,
      message: `Not configured: ${config.missing.join(", ")}`,
    };
  }

  return {
    attempted: true,
    ...(await timedFetch(
      env.DEEPSEEK_BASE_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: env.DEEPSEEK_MODEL,
          messages: [{ role: "user", content: "Reply with OK." }],
          max_tokens: 8,
          temperature: 0,
        }),
      },
      timeoutMs,
    )),
  };
}

const adminRoutes: FastifyPluginAsync = async (app) => {
  app.get("/ai/health", async (request) => {
    await requireAdminUser(app, request);
    const query = querySchema.parse(request.query);
    const priority = providerPriority();

    const base = {
      timestamp: new Date().toISOString(),
      probeAttempted: query.probe,
      providerPriority: priority,
      providers: {
        azure: {
          ...getAzureConfigStatus(),
          probe: null as unknown,
        },
        gemini: {
          ...getGeminiConfigStatus(),
          probe: null as unknown,
        },
        deepseek: {
          ...getDeepSeekConfigStatus(),
          probe: null as unknown,
        },
      },
    };

    if (!query.probe) {
      return base;
    }

    const [azureProbe, geminiProbe, deepseekProbe] = await Promise.all([
      probeAzure(query.timeoutMs),
      probeGemini(query.timeoutMs),
      probeDeepSeek(query.timeoutMs),
    ]);

    return {
      ...base,
      providers: {
        ...base.providers,
        azure: {
          ...base.providers.azure,
          probe: azureProbe,
        },
        gemini: {
          ...base.providers.gemini,
          probe: geminiProbe,
        },
        deepseek: {
          ...base.providers.deepseek,
          probe: deepseekProbe,
        },
      },
    };
  });
};

export default adminRoutes;
