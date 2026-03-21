/**
 * NMC Exam Generation Route
 *
 * Generates NMCZ-aligned exam questions from ingested curriculum content
 * using RAG retrieval + LLM generation. Replaces the static frontend questions
 * with dynamically generated, curriculum-grounded assessments.
 */

import { FastifyPluginAsync } from "fastify";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { env } from "../config.js";
import { requireUserId } from "../services/auth-helpers.js";
import { ensureServiceEnabled } from "../services/service-controls.js";
import {
  embedTextsWithFallback,
  vectorToSqlLiteral,
} from "../services/embeddings.js";
import type { RetrievalChunkForPrompt } from "../services/ai-layer.js";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const generateExamSchema = z.object({
  /** Course or topic area to generate questions for */
  course: z.string().min(1).max(200),
  /** Optional specific topic within the course */
  topic: z.string().min(1).max(200).optional(),
  /** Number of questions to generate */
  questionCount: z.coerce.number().int().min(5).max(30).default(10),
  /** Difficulty distribution */
  difficulty: z.enum(["easy", "medium", "hard", "mixed"]).default("mixed"),
  /** Programme level for scope-appropriate questions */
  programmeLevel: z.enum(["Diploma", "BSc"]).default("Diploma"),
  /** Year of study for appropriate difficulty calibration */
  yearLevel: z.coerce.number().int().min(1).max(4).default(2),
  /** Time limit in minutes */
  timeLimit: z.coerce.number().int().min(10).max(180).default(60),
  /** Pass score percentage */
  passScore: z.coerce.number().int().min(30).max(100).default(50),
  /** Curriculum version to use */
  curriculumVersionId: z.string().uuid().optional(),
});

// ---------------------------------------------------------------------------
// Provider helpers
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

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

function buildExamGenerationPrompt(
  input: z.infer<typeof generateExamSchema>,
  chunks: RetrievalChunkForPrompt[],
) {
  const chunkBlock = chunks
    .map(
      (c, i) =>
        `[Chunk ${i + 1}: ${c.sourceName}${c.page ? `, p.${c.page}` : ""}]\n${c.text.slice(0, 1500)}`,
    )
    .join("\n\n");

  const difficultyGuidance =
    input.difficulty === "mixed"
      ? "Mix difficulties: ~30% easy, ~40% medium, ~30% hard."
      : `All questions should be ${input.difficulty} difficulty.`;

  const systemPrompt = [
    "You are EduNurse's NMCZ exam question generator for Zambian nursing education.",
    "",
    "REGULATORY ALIGNMENT:",
    "- All questions must align with the NMCZ (Nursing and Midwifery Council of Zambia) competency framework.",
    "- Questions must be appropriate for the specified programme level (Diploma/BSc) and year of study.",
    "- Clinical scenarios must respect HPCZ (Health Professions Council of Zambia) scope-of-practice boundaries.",
    "- Drug-related questions must reference the Zambian Essential Medicines List (EML) and Standard Treatment Guidelines.",
    "- Use Zambian healthcare context (PHC approach, district hospitals, community health settings).",
    "",
    "QUESTION QUALITY STANDARDS:",
    "- Each question must test a specific NMCZ competency or learning objective.",
    "- Questions must be clinically accurate and evidence-based.",
    "- Distractors (wrong answers) must be plausible but clearly incorrect.",
    "- Explanations must cite curriculum evidence and state the correct nursing rationale.",
    "- Include the NMCZ competency domain tested: Clinical, Professional, Ethical, Communication, Leadership, or Research.",
    "- Avoid ambiguous wording or 'trick' questions.",
    "- Use standard medical/nursing terminology used in Zambian nursing education.",
    "",
    "DIFFICULTY CALIBRATION:",
    "- Easy: Recall-level (definitions, basic facts, standard vital sign ranges).",
    "- Medium: Application-level (clinical scenarios requiring reasoning, drug calculations, priority-setting).",
    "- Hard: Analysis/evaluation (complex multi-step clinical reasoning, ethical dilemmas, unusual presentations).",
    "",
    `${difficultyGuidance}`,
    "",
    "Return strict JSON only with this shape:",
    JSON.stringify(
      {
        examTitle: "string",
        course: "string",
        topic: "string | null",
        programmeLevel: "string",
        yearLevel: "number",
        questions: [
          {
            id: "q1",
            question: "Full question text with clinical scenario if applicable",
            options: ["Option A", "Option B", "Option C", "Option D"],
            correctAnswer: 0,
            explanation: "Detailed explanation citing curriculum evidence and nursing rationale",
            topic: "Specific topic tag",
            difficulty: "easy | medium | hard",
            competencyDomain: "Clinical | Professional | Ethical | Communication | Leadership | Research",
            competencyCode: "NMCZ-C-001 or similar (if applicable)",
            nmczObjective: "The specific NMCZ learning objective this question assesses",
          },
        ],
      },
      null,
      2,
    ),
  ].join("\n");

  const userPrompt = [
    `Course: ${input.course}`,
    input.topic ? `Topic: ${input.topic}` : "",
    `Programme level: ${input.programmeLevel}`,
    `Year of study: ${input.yearLevel}`,
    `Number of questions: ${input.questionCount}`,
    `Difficulty: ${input.difficulty}`,
    "",
    "Generate questions based ONLY on the following curriculum content:",
    chunkBlock || "No curriculum chunks retrieved. Generate general nursing knowledge questions appropriate for the level.",
    "",
    `Generate exactly ${input.questionCount} MCQ questions with 4 options each.`,
    "Each question must have a unique ID (q1, q2, etc.).",
    "Ensure correctAnswer is the 0-based index of the correct option.",
  ]
    .filter(Boolean)
    .join("\n");

  return { systemPrompt, userPrompt };
}

// ---------------------------------------------------------------------------
// LLM caller (non-streaming)
// ---------------------------------------------------------------------------

async function callLLM(
  provider: ProviderName,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  let url: string;
  let headers: Record<string, string>;
  let body: unknown;

  if (provider === "azure") {
    const endpoint = env.AZURE_OPENAI_ENDPOINT!.replace(/\/+$/, "");
    url = `${endpoint}/openai/deployments/${encodeURIComponent(
      env.AZURE_OPENAI_DEPLOYMENT!,
    )}/chat/completions?api-version=${env.AZURE_OPENAI_API_VERSION}`;
    headers = {
      "Content-Type": "application/json",
      "api-key": env.AZURE_OPENAI_API_KEY!,
    };
    body = {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 4096,
    };
  } else if (provider === "gemini") {
    const model = env.GEMINI_MODEL ?? "gemini-2.5-flash";
    url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;
    headers = { "Content-Type": "application/json" };
    body = {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
    };
  } else {
    url = env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com/v1/chat/completions";
    headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
    };
    body = {
      model: env.DEEPSEEK_MODEL ?? "deepseek-chat",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 4096,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    env.GENERATION_TIMEOUT_MS ?? 60_000,
  );

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(`${provider} returned ${response.status}: ${errText.slice(0, 200)}`);
    }

    const result = await response.json();

    // Extract text based on provider format
    if (provider === "gemini") {
      const r = result as Record<string, unknown>;
      const candidates = r.candidates as Array<Record<string, unknown>> | undefined;
      const content = candidates?.[0]?.content as Record<string, unknown> | undefined;
      const parts = content?.parts as Array<Record<string, unknown>> | undefined;
      return (parts?.[0]?.text as string) ?? "";
    } else {
      const r = result as Record<string, unknown>;
      const choices = r.choices as Array<Record<string, unknown>> | undefined;
      const message = choices?.[0]?.message as Record<string, unknown> | undefined;
      return (message?.content as string) ?? "";
    }
  } finally {
    clearTimeout(timeout);
  }
}

function extractJson(text: string): unknown {
  // Try to find JSON in the response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in response");
  return JSON.parse(jsonMatch[0]);
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

const nmcExamRoutes: FastifyPluginAsync = async (app) => {
  /**
   * POST /nmc-exam/generate — generate an exam set from curriculum
   */
  app.post("/generate", async (request, reply) => {
    const userId = requireUserId(request);
    await ensureServiceEnabled(app, "generation");

    const body = generateExamSchema.parse(request.body);

    // Resolve curriculum version
    const curriculumVersionId =
      body.curriculumVersionId ??
      (
        await app.prisma.curriculumVersion.findFirst({
          where: { isActive: true },
          select: { id: true },
        })
      )?.id;

    if (!curriculumVersionId) {
      return reply.status(503).send({
        success: false,
        message: "No active curriculum version available.",
      });
    }

    // Retrieve relevant chunks for the course/topic
    const searchText = [body.course, body.topic ?? ""].filter(Boolean).join(" ");
    const terms = searchText
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 3);

    const keywordFilters: Prisma.CurriculumChunkWhereInput[] = terms.flatMap(
      (term) => [
        { text: { contains: term, mode: "insensitive" as const } },
        { heading: { contains: term, mode: "insensitive" as const } },
      ],
    );

    const candidates = await app.prisma.curriculumChunk.findMany({
      where: {
        curriculumVersionId,
        source: { status: "indexed" },
        ...(keywordFilters.length > 0 ? { OR: keywordFilters } : {}),
      },
      take: 80,
      include: {
        source: { select: { id: true, name: true } },
      },
    });

    // Score and rank candidates
    const scored = candidates.map((chunk) => {
      const haystack = `${chunk.heading ?? ""} ${chunk.text} ${chunk.source.name}`.toLowerCase();
      let score = 0;
      for (const term of terms) {
        if (haystack.includes(term)) score += 1;
      }
      return { chunk, score };
    });
    scored.sort((a, b) => b.score - a.score);

    // Optional vector enrichment
    try {
      const embResult = await embedTextsWithFallback([searchText]);
      if (embResult.provider !== "local" && embResult.vectors[0]) {
        const vectorLiteral = vectorToSqlLiteral(embResult.vectors[0]);
        const safeIds = scored.slice(0, 30).map((e) => e.chunk.id);
        if (safeIds.length > 0) {
          const idSql = Prisma.join(
            safeIds.map((id) => Prisma.sql`${id}::uuid`),
            ", ",
          );
          const rows = await app.prisma.$queryRaw<
            Array<{ id: string; score: number }>
          >(Prisma.sql`
            SELECT id::text AS id,
                   (1 - (embedding <=> ${Prisma.raw(vectorLiteral)}::vector))::float8 AS score
            FROM curriculum_chunks
            WHERE id IN (${idSql}) AND embedding IS NOT NULL
            ORDER BY embedding <=> ${Prisma.raw(vectorLiteral)}::vector
            LIMIT 30
          `);
          const vectorMap = new Map(rows.map((r) => [r.id, r.score]));
          for (const entry of scored) {
            entry.score += (vectorMap.get(entry.chunk.id) ?? 0) * 15;
          }
          scored.sort((a, b) => b.score - a.score);
        }
      }
    } catch {
      // Best-effort vector enrichment
    }

    const topChunks: RetrievalChunkForPrompt[] = scored
      .slice(0, 12)
      .map((entry) => ({
        chunkId: entry.chunk.id,
        sourceId: entry.chunk.sourceId,
        sourceName: entry.chunk.source.name,
        page: entry.chunk.page ?? null,
        heading: entry.chunk.heading ?? null,
        text: entry.chunk.text,
      }));

    // Generate questions with provider fallback
    const providers = getProviderOrder().filter(isProviderConfigured);
    if (providers.length === 0) {
      return reply.status(503).send({
        success: false,
        message: "No AI provider is currently configured.",
      });
    }

    const { systemPrompt, userPrompt } = buildExamGenerationPrompt(body, topChunks);
    const failures: string[] = [];

    for (const provider of providers) {
      try {
        const rawText = await callLLM(provider, systemPrompt, userPrompt);
        const parsed = extractJson(rawText) as Record<string, unknown>;

        // Validate structure
        const questions = parsed.questions as Array<Record<string, unknown>> | undefined;
        if (!Array.isArray(questions) || questions.length === 0) {
          throw new Error("No questions in response");
        }

        return {
          success: true,
          exam: {
            id: `gen-${Date.now()}`,
            title: (parsed.examTitle as string) || `${body.course} Exam`,
            description: `AI-generated NMCZ-aligned exam for ${body.programmeLevel} Year ${body.yearLevel}`,
            course: body.course,
            topic: body.topic ?? null,
            programmeLevel: body.programmeLevel,
            yearLevel: body.yearLevel,
            timeLimit: body.timeLimit,
            passScore: body.passScore,
            questionCount: questions.length,
            questions: questions.map((q, i) => ({
              id: (q.id as string) || `q${i + 1}`,
              question: q.question as string,
              options: q.options as string[],
              correctAnswer: q.correctAnswer as number,
              explanation: q.explanation as string,
              topic: (q.topic as string) || body.course,
              difficulty: (q.difficulty as string) || "medium",
              competencyDomain: (q.competencyDomain as string) || "Clinical",
              competencyCode: (q.competencyCode as string) || null,
              nmczObjective: (q.nmczObjective as string) || null,
            })),
            chunksUsed: topChunks.length,
            provider,
          },
        };
      } catch (err) {
        failures.push(`${provider}: ${(err as Error).message}`);
        app.log.warn(`Exam generation provider ${provider} failed: ${(err as Error).message}`);
      }
    }

    return reply.status(503).send({
      success: false,
      message: "Failed to generate exam questions. " + failures.join(" | "),
    });
  });

  /**
   * GET /nmc-exam/topics — list available course/topics for exam generation
   */
  app.get("/topics", async (request) => {
    requireUserId(request);

    const activeVersion = await app.prisma.curriculumVersion.findFirst({
      where: { isActive: true },
      select: { id: true },
    });

    if (!activeVersion) {
      return { success: true, courses: [] };
    }

    const sources = await app.prisma.curriculumSource.findMany({
      where: {
        status: "indexed",
        versions: { some: { curriculumVersionId: activeVersion.id } },
      },
      select: { name: true, programme: true, sourceType: true },
      orderBy: { name: "asc" },
    });

    const courses = sources.map((s) => ({
      name: s.name
        .replace(/\.[a-z0-9]+$/i, "")
        .replace(/^[\d\s.\-_]+/, "")
        .trim(),
      programme: s.programme,
      sourceType: s.sourceType,
    }));

    return { success: true, courses };
  });
};

export default nmcExamRoutes;
