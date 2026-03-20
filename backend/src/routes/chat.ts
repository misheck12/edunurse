/**
 * Chat Route
 * Provides a streaming conversational AI endpoint for nursing students.
 * Persists conversations and messages in the database.
 * Uses the same provider-fallback infrastructure as the rest of the platform.
 */

import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { env } from "../config.js";
import { requireUserId } from "../services/auth-helpers.js";
import { ensureServiceEnabled } from "../services/service-controls.js";
import type { OutgoingHttpHeaders } from "http";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(8000),
});

const chatRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1).max(50),
  /** Optional context hint so the system prompt can be tailored. */
  context: z
    .enum(["clinical", "pharmacology", "general"])
    .default("general"),
  /** If provided, appends to an existing conversation. */
  conversationId: z.string().uuid().optional(),
});

// ---------------------------------------------------------------------------
// Provider helpers (streaming)
// ---------------------------------------------------------------------------

type ProviderName = "azure" | "gemini" | "deepseek";

function getProviderOrder(): ProviderName[] {
  return (env.LLM_PROVIDER_PRIORITY ?? "azure,gemini,deepseek")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is ProviderName =>
      ["azure", "gemini", "deepseek"].includes(s),
    );
}

function isProviderConfigured(p: ProviderName): boolean {
  if (p === "azure")
    return !!(env.AZURE_OPENAI_ENDPOINT && env.AZURE_OPENAI_API_KEY && env.AZURE_OPENAI_DEPLOYMENT);
  if (p === "gemini") return !!env.GEMINI_API_KEY;
  if (p === "deepseek") return !!env.DEEPSEEK_API_KEY;
  return false;
}

const SYSTEM_PROMPTS: Record<string, string> = {
  clinical: `You are EduNurse AI, a knowledgeable and supportive clinical nursing assistant designed for Zambian nursing and midwifery students. 
You provide evidence-based answers grounded in the Zambian NMC syllabus and WHO clinical guidelines. 
When answering clinical questions, reference standard protocols and Zambian healthcare contexts.
Use clear, concise language appropriate for nursing students. Include relevant drug dosages, procedures, and clinical reasoning when applicable.
Format your responses with markdown: use headings, bullet points, and bold text for clarity.
If a question is outside your expertise or could be dangerous, advise the student to consult a qualified clinical instructor.`,

  pharmacology: `You are EduNurse AI, a pharmacology tutor for Zambian nursing students.
Help with drug calculations, mechanisms of action, side effects, nursing considerations, and Zambian Essential Medicines List (EML).
Always include safety warnings and double-check dosage calculations. Use markdown formatting.`,

  general: `You are EduNurse AI, a helpful study companion for nursing and midwifery students in Zambia.
You can help with studying, explaining concepts, preparing for NMC exams, understanding clinical procedures, drug calculations, and general academic support.
Be encouraging, clear, and evidence-based. Use markdown formatting with headings and bullet points for readable responses.
If asked about something outside nursing/healthcare, you can still help but gently remind the student of your specialty.`,
};

// ---------------------------------------------------------------------------
// Streaming fetch helpers
// ---------------------------------------------------------------------------

interface StreamConfig {
  url: string;
  headers: Record<string, string>;
  body: unknown;
  extractDelta: (chunk: unknown) => string | null;
}

function buildAzureStreamConfig(
  systemPrompt: string,
  messages: z.infer<typeof chatMessageSchema>[],
): StreamConfig {
  const endpoint = env.AZURE_OPENAI_ENDPOINT!.replace(/\/+$/, "");
  const url = `${endpoint}/openai/deployments/${encodeURIComponent(
    env.AZURE_OPENAI_DEPLOYMENT!,
  )}/chat/completions?api-version=${env.AZURE_OPENAI_API_VERSION}`;

  return {
    url,
    headers: {
      "Content-Type": "application/json",
      "api-key": env.AZURE_OPENAI_API_KEY!,
    },
    body: {
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
      temperature: 0.5,
      max_tokens: 2048,
      stream: true,
    },
    extractDelta: (chunk: unknown) => {
      const c = chunk as Record<string, unknown>;
      const choices = c.choices as Array<Record<string, unknown>> | undefined;
      const delta = choices?.[0]?.delta as Record<string, unknown> | undefined;
      return (delta?.content as string) ?? null;
    },
  };
}

function buildGeminiStreamConfig(
  systemPrompt: string,
  messages: z.infer<typeof chatMessageSchema>[],
): StreamConfig {
  const model = env.GEMINI_MODEL ?? "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${env.GEMINI_API_KEY}`;

  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  return {
    url,
    headers: { "Content-Type": "application/json" },
    body: {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: { temperature: 0.5, maxOutputTokens: 2048 },
    },
    extractDelta: (chunk: unknown) => {
      const c = chunk as Record<string, unknown>;
      const candidates = c.candidates as Array<Record<string, unknown>> | undefined;
      const content = candidates?.[0]?.content as Record<string, unknown> | undefined;
      const parts = content?.parts as Array<Record<string, unknown>> | undefined;
      return (parts?.[0]?.text as string) ?? null;
    },
  };
}

function buildDeepSeekStreamConfig(
  systemPrompt: string,
  messages: z.infer<typeof chatMessageSchema>[],
): StreamConfig {
  return {
    url: env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com/v1/chat/completions",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
    },
    body: {
      model: env.DEEPSEEK_MODEL ?? "deepseek-chat",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
      temperature: 0.5,
      max_tokens: 2048,
      stream: true,
    },
    extractDelta: (chunk: unknown) => {
      const c = chunk as Record<string, unknown>;
      const choices = c.choices as Array<Record<string, unknown>> | undefined;
      const delta = choices?.[0]?.delta as Record<string, unknown> | undefined;
      return (delta?.content as string) ?? null;
    },
  };
}

function getStreamConfig(
  provider: ProviderName,
  systemPrompt: string,
  messages: z.infer<typeof chatMessageSchema>[],
): StreamConfig {
  if (provider === "azure") return buildAzureStreamConfig(systemPrompt, messages);
  if (provider === "gemini") return buildGeminiStreamConfig(systemPrompt, messages);
  return buildDeepSeekStreamConfig(systemPrompt, messages);
}

/**
 * Read an SSE (text/event-stream) response and yield parsed JSON chunks.
 */
async function* parseSSE(
  response: Response,
  extractDelta: (chunk: unknown) => string | null,
): AsyncGenerator<string> {
  const reader = response.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === "data: [DONE]") continue;
        if (!trimmed.startsWith("data:")) continue;

        const json = trimmed.slice(5).trim();
        if (!json || json === "[DONE]") continue;

        try {
          const parsed = JSON.parse(json);
          const delta = extractDelta(parsed);
          if (delta) yield delta;
        } catch {
          // skip unparseable chunks
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a short title from the first user message. */
function deriveTitle(content: string): string {
  const clean = content.replace(/\n/g, " ").trim();
  if (clean.length <= 50) return clean;
  return clean.slice(0, 47) + "…";
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

const chatRoutes: FastifyPluginAsync = async (app) => {
  // -----------------------------------------------------------------------
  // GET /chat/conversations — list all conversations for the user
  // -----------------------------------------------------------------------
  app.get("/conversations", async (request) => {
    const userId = requireUserId(request);

    const conversations = await app.prisma.chatConversation.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        context: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { messages: true } },
      },
      take: 50,
    });

    return {
      success: true,
      conversations: conversations.map((c) => ({
        id: c.id,
        title: c.title,
        context: c.context,
        messageCount: c._count.messages,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
    };
  });

  // -----------------------------------------------------------------------
  // GET /chat/conversations/:id — get a conversation with messages
  // -----------------------------------------------------------------------
  app.get<{ Params: { id: string } }>("/conversations/:id", async (request, reply) => {
    const userId = requireUserId(request);
    const { id } = request.params;

    const conversation = await app.prisma.chatConversation.findFirst({
      where: { id, userId },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });

    if (!conversation) {
      return reply.status(404).send({ success: false, message: "Conversation not found." });
    }

    return {
      success: true,
      conversation: {
        id: conversation.id,
        title: conversation.title,
        context: conversation.context,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        messages: conversation.messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: m.createdAt,
        })),
      },
    };
  });

  // -----------------------------------------------------------------------
  // PATCH /chat/conversations/:id — rename a conversation
  // -----------------------------------------------------------------------
  app.patch<{ Params: { id: string } }>("/conversations/:id", async (request, reply) => {
    const userId = requireUserId(request);
    const { id } = request.params;
    const { title } = z.object({ title: z.string().trim().min(1).max(100) }).parse(request.body);

    const convo = await app.prisma.chatConversation.findFirst({ where: { id, userId } });
    if (!convo) return reply.status(404).send({ success: false, message: "Not found." });

    const updated = await app.prisma.chatConversation.update({
      where: { id },
      data: { title },
    });

    return { success: true, conversation: { id: updated.id, title: updated.title } };
  });

  // -----------------------------------------------------------------------
  // DELETE /chat/conversations/:id — delete a conversation
  // -----------------------------------------------------------------------
  app.delete<{ Params: { id: string } }>("/conversations/:id", async (request, reply) => {
    const userId = requireUserId(request);
    const { id } = request.params;

    const convo = await app.prisma.chatConversation.findFirst({ where: { id, userId } });
    if (!convo) return reply.status(404).send({ success: false, message: "Not found." });

    await app.prisma.chatConversation.delete({ where: { id } });
    return { success: true };
  });

  // -----------------------------------------------------------------------
  // POST /chat — stream a response + persist both messages
  // -----------------------------------------------------------------------
  app.post("/", async (request, reply) => {
    const userId = requireUserId(request);
    await ensureServiceEnabled(app, "chat");

    const body = chatRequestSchema.parse(request.body);
    const systemPrompt = SYSTEM_PROMPTS[body.context] ?? SYSTEM_PROMPTS.general;
    const userContent = body.messages[body.messages.length - 1]?.content ?? "";

    // Resolve or create conversation
    let conversationId = body.conversationId;
    if (conversationId) {
      const existing = await app.prisma.chatConversation.findFirst({
        where: { id: conversationId, userId },
      });
      if (!existing) {
        return reply.status(404).send({ success: false, message: "Conversation not found." });
      }
    } else {
      const convo = await app.prisma.chatConversation.create({
        data: { userId, title: deriveTitle(userContent), context: body.context },
      });
      conversationId = convo.id;
    }

    // Persist the user message
    await app.prisma.chatMessage.create({
      data: { conversationId, role: "user", content: userContent },
    });

    const providers = getProviderOrder().filter(isProviderConfigured);
    if (providers.length === 0) {
      return reply.status(503).send({
        success: false,
        message: "No AI provider is currently configured.",
      });
    }

    // Set SSE headers via Fastify so CORS plugin headers are included
    void reply
      .header("Content-Type", "text/event-stream")
      .header("Cache-Control", "no-cache")
      .header("Connection", "keep-alive")
      .header("X-Accel-Buffering", "no");
    reply.raw.writeHead(200, reply.getHeaders() as OutgoingHttpHeaders);

    // Send the conversationId so the client can reference it for follow-ups
    reply.raw.write(`data: ${JSON.stringify({ conversationId })}\n\n`);

    let succeeded = false;
    let assistantContent = "";

    for (const provider of providers) {
      try {
        const config = getStreamConfig(provider, systemPrompt, body.messages);
        const controller = new AbortController();
        const timeout = setTimeout(
          () => controller.abort(),
          env.GENERATION_TIMEOUT_MS ?? 60_000,
        );

        const response = await fetch(config.url, {
          method: "POST",
          headers: config.headers,
          body: JSON.stringify(config.body),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
          const errText = await response.text().catch(() => "");
          app.log.warn(
            `Chat provider ${provider} returned ${response.status}: ${errText.slice(0, 200)}`,
          );
          continue;
        }

        for await (const delta of parseSSE(response, config.extractDelta)) {
          assistantContent += delta;
          reply.raw.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
        }

        reply.raw.write("data: [DONE]\n\n");
        succeeded = true;
        break;
      } catch (err) {
        app.log.warn(`Chat provider ${provider} failed: ${(err as Error).message}`);
        continue;
      }
    }

    if (!succeeded) {
      reply.raw.write(
        `data: ${JSON.stringify({ error: "All AI providers are currently unavailable. Please try again later." })}\n\n`,
      );
      reply.raw.write("data: [DONE]\n\n");
    }

    // Persist the assistant response
    if (assistantContent) {
      await app.prisma.chatMessage.create({
        data: { conversationId, role: "assistant", content: assistantContent },
      }).catch((err) => {
        app.log.error(`Failed to persist assistant message: ${(err as Error).message}`);
      });

      await app.prisma.chatConversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      }).catch(() => { /* best-effort */ });
    }

    reply.raw.end();
  });
};

export default chatRoutes;
