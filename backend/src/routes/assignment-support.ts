import { FastifyPluginAsync } from "fastify";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import mammoth from "mammoth";
import { requireUserId } from "../services/auth-helpers.js";
import { generateAssignmentSupportWithProviderFallback } from "../services/ai-layer.js";
import { requireCompleteProfile } from "../services/profile-completion.js";
import { buildAssignmentDocx } from "../services/assignment-export.js";
import { ensureServiceEnabled } from "../services/service-controls.js";
import { checkGenerationLimit } from "../services/usage-limits.js";

const assignmentSupportMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(4000),
});

const citationStyleSchema = z.enum(["apa7", "harvard", "vancouver", "mla", "chicago"]);

const referenceSchema = z.object({
  type: z.enum(["book", "journal", "website", "other"]),
  title: z.string().trim().min(1).max(500),
  authors: z.string().trim().min(1).max(500),
  year: z.string().trim().min(1).max(10),
  source: z.string().trim().max(500).default(""),
  url: z.string().trim().max(1000).optional(),
  notes: z.string().trim().max(2000).optional(),
});

const assignmentSupportRequestSchema = z.object({
  mode: z.enum(["understand", "practice", "draft"]),
  assignmentTitle: z.string().trim().min(1).max(200).optional(),
  assignmentInstructions: z.string().trim().min(10).max(12000),
  course: z.string().trim().min(1).max(200).optional(),
  programme: z.string().trim().min(1).max(200).optional(),
  studentGoal: z.string().trim().min(1).max(1200).optional(),
  currentAttempt: z.string().trim().min(1).max(12000).optional(),
  messages: z.array(assignmentSupportMessageSchema).max(20).default([]),
  // Enhanced pedagogy fields
  wordCount: z.number().int().min(100).max(20000).optional(),
  citationStyle: citationStyleSchema.optional(),
  markingCriteria: z.string().trim().min(1).max(5000).optional(),
  lecturerFeedback: z.string().trim().min(1).max(3000).optional(),
  dueDate: z.string().trim().min(1).max(50).optional(),
  understandingScore: z.number().min(0).max(100).optional(),
  // Student-provided references
  references: z.array(referenceSchema).max(20).optional(),
  // Multi-question support: which sub-question the student is focusing on
  focusQuestionId: z.string().trim().min(1).max(50).optional(),
});

function toJson(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function toPublicAssignmentSupportErrorMessage(rawMessage: string) {
  const message = rawMessage.toLowerCase();
  if (message.includes("timeout") || message.includes("aborted")) {
    return "Assignment support timed out. Please try again.";
  }
  if (
    message.includes("all llm providers failed") ||
    message.includes("missing configuration")
  ) {
    return "Assignment support is temporarily unavailable. Please try again shortly.";
  }
  return "Unable to process this assignment right now.";
}

const assignmentSupportRoutes: FastifyPluginAsync = async (app) => {
  // Register content-type parsers for binary document uploads (PDF, DOCX).
  // Without these Fastify returns 415 Unsupported Media Type for raw binary bodies.
  const binaryMimeTypes = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
  ];
  for (const mime of binaryMimeTypes) {
    app.addContentTypeParser(mime, { parseAs: "buffer" }, (_req, body, done) => {
      done(null, body);
    });
  }

  app.addHook("preHandler", async (request, reply) => {
    await requireCompleteProfile(request, reply, app.prisma);
  });

  app.post("/chat", async (request, reply) => {
    await ensureServiceEnabled(app, "assignment_support");
    const userId = requireUserId(request);
    const limitCheck = await checkGenerationLimit(app.prisma, userId);

    if (!limitCheck.allowed) {
      throw app.httpErrors.paymentRequired(limitCheck.message);
    }

    const body = assignmentSupportRequestSchema.parse(request.body);
    const startedAt = Date.now();

    const run = await app.prisma.generationRun.create({
      data: {
        userId,
        runType: "simplify",
        status: "running",
        inputJson: toJson({
          feature: "assignment_support",
          ...body,
          messages: body.messages.slice(-12),
        }),
        strictCurriculumAlignment: false,
        modelProvider: "llm_router",
        modelName: "pending",
      },
    });

    try {
      const result = await generateAssignmentSupportWithProviderFallback({
        ...body,
        messages: body.messages.slice(-12),
      });

      await app.prisma.generationRun.update({
        where: { id: run.id },
        data: {
          status: "succeeded",
          outputJson: toJson(result),
          modelProvider: result.provider,
          modelName: result.model,
          latencyMs: Date.now() - startedAt,
          completedAt: new Date(),
        },
      });

      return reply.send(result);
    } catch (error) {
      const internalMessage =
        error instanceof Error ? error.message : "Assignment support failed.";
      const publicMessage =
        toPublicAssignmentSupportErrorMessage(internalMessage);

      request.log.error(
        {
          assignmentSupportRunId: run.id,
          userId,
          internalMessage,
        },
        "Assignment support failure",
      );

      await app.prisma.generationRun.update({
        where: { id: run.id },
        data: {
          status: "failed",
          errorMessage: publicMessage,
          latencyMs: Date.now() - startedAt,
          completedAt: new Date(),
        },
      });

      return reply.code(503).send({ message: publicMessage });
    }
  });

  /**
   * Extract text from uploaded document (PDF/DOCX)
   * Returns plain text that can be used as assignment instructions
   */
  app.post("/extract-document", async (request, reply) => {
    const userId = requireUserId(request);
    await ensureServiceEnabled(app, "assignment_support");

    const contentType = request.headers["content-type"] || "";
    const body = request.body as Buffer;

    if (!body || body.length === 0) {
      throw app.httpErrors.badRequest("No file content provided");
    }

    if (body.length > 5 * 1024 * 1024) {
      throw app.httpErrors.badRequest("File too large. Maximum size is 5MB.");
    }

    let extractedText = "";

    try {
      if (contentType.includes("application/pdf")) {
        // pdf-parse v2 is class-based (PDFParse)
        const { PDFParse } = await import("pdf-parse");
        const parser = new PDFParse({ data: body });
        const pdfData = await parser.getText();
        extractedText = pdfData.pages.map((p: { text: string }) => p.text).join("\n");
        await parser.destroy();
      } else if (
        contentType.includes("application/vnd.openxmlformats-officedocument.wordprocessingml.document") ||
        contentType.includes("application/msword")
      ) {
        const result = await mammoth.extractRawText({ buffer: body });
        extractedText = result.value;
      } else {
        throw app.httpErrors.badRequest(
          "Unsupported file type. Please upload a PDF or DOCX file."
        );
      }

      // Clean up extracted text
      extractedText = extractedText
        .replace(/\r\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
        .slice(0, 12000); // Limit to schema max

      if (extractedText.length < 10) {
        throw app.httpErrors.badRequest(
          "Could not extract meaningful text from the document. Please paste the content manually."
        );
      }

      request.log.info(
        { userId, contentType, extractedLength: extractedText.length },
        "Document text extracted for assignment support"
      );

      return reply.send({
        success: true,
        text: extractedText,
        characterCount: extractedText.length,
      });
    } catch (error) {
      if (error instanceof Error && "statusCode" in error) {
        throw error; // Re-throw Fastify HTTP errors
      }
      request.log.error(
        { userId, contentType, error: error instanceof Error ? error.message : "Unknown error" },
        "Document extraction failed"
      );
      throw app.httpErrors.badRequest(
        "Failed to extract text from document. Please try pasting the content manually."
      );
    }
  });

  /**
   * Export draft as a properly formatted academic DOCX
   */
  app.post("/export-draft", async (request, reply) => {
    const userId = requireUserId(request);
    await ensureServiceEnabled(app, "assignment_support");

    const exportSchema = z.object({
      title: z.string().trim().min(1).max(200),
      content: z.string().trim().min(10).max(30000),
      citationStyle: citationStyleSchema.optional(),
      studentName: z.string().trim().max(120).optional(),
      studentNumber: z.string().trim().max(60).optional(),
      school: z.string().trim().max(240).optional(),
      course: z.string().trim().max(200).optional(),
      programme: z.string().trim().max(200).optional(),
      dueDate: z.string().trim().max(50).optional(),
      wordCount: z.number().int().min(0).max(30000).optional(),
      references: z.array(z.object({
        type: z.enum(["book", "journal", "website", "other"]),
        title: z.string().trim().min(1).max(500),
        authors: z.string().trim().min(1).max(500),
        year: z.string().trim().min(1).max(10),
        source: z.string().trim().max(500).default(""),
        url: z.string().trim().max(1000).optional(),
      })).max(40).optional(),
    });

    const body = exportSchema.parse(request.body);
    const buffer = await buildAssignmentDocx(body);

    request.log.info(
      { userId, titleLength: body.title.length, contentLength: body.content.length, referencesCount: body.references?.length ?? 0 },
      "Assignment draft exported to DOCX"
    );

    return reply
      .header("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
      .header(
        "Content-Disposition",
        `attachment; filename="${encodeURIComponent(body.title.slice(0, 50))}_assignment.docx"`
      )
      .send(buffer);
  });
};

export default assignmentSupportRoutes;
