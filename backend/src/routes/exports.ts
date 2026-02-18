import { FastifyPluginAsync } from "fastify";
import { access, readFile, stat } from "node:fs/promises";
import { z } from "zod";
import { requireUserId } from "../services/auth-helpers.js";
import { resolveExportFilePath } from "../services/export-storage.js";
import { ensureServiceEnabled } from "../services/service-controls.js";
import { checkExportLimit } from "../services/usage-limits.js";

const createExportSchema = z.object({
  documentId: z.string().uuid(),
  documentVersionId: z.string().uuid().optional(),
  format: z.enum(["pdf", "docx", "pptx"]),
});

const listExportsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["queued", "running", "succeeded", "failed"]).optional(),
  format: z.enum(["pdf", "docx", "pptx"]).optional(),
});

const exportRoutes: FastifyPluginAsync = async (app) => {
  app.post("/", async (request, reply) => {
    const userId = requireUserId(request);
    const body = createExportSchema.parse(request.body);
    await ensureServiceEnabled(app, "exports");

    const document = await app.prisma.document.findFirst({
      where: {
        id: body.documentId,
        userId,
        deletedAt: null,
      },
    });

    if (!document) {
      throw app.httpErrors.notFound("Document not found or you don't have access to it");
    }

    const resolvedVersionId =
      body.documentVersionId ??
      (
        await app.prisma.documentVersion.findFirst({
          where: { documentId: document.id },
          orderBy: { versionNum: "desc" },
          select: { id: true },
        })
      )?.id;

    if (!resolvedVersionId) {
      throw app.httpErrors.badRequest("No document version available for export. Please save the document first.");
    }

    // Return existing successful export for same doc version + format.
    // This prevents duplicate usage consumption and lets users re-download.
    const existingSucceededExport = await app.prisma.exportJob.findFirst({
      where: {
        userId,
        documentId: document.id,
        documentVersionId: resolvedVersionId,
        format: body.format,
        status: "succeeded",
      },
      orderBy: { createdAt: "desc" },
    });

    if (existingSucceededExport) {
      return reply.code(200).send(existingSucceededExport);
    }

    // Check if there's already a recent pending/running export for this document
    const recentExport = await app.prisma.exportJob.findFirst({
      where: {
        userId,
        documentId: document.id,
        documentVersionId: resolvedVersionId,
        format: body.format,
        status: { in: ["queued", "running"] },
        createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) }, // Last 5 minutes
      },
      orderBy: { createdAt: "desc" },
    });

    if (recentExport) {
      // Return the existing job instead of creating a duplicate
      return reply.code(200).send(recentExport);
    }

    // Check usage limits after doc/version/format are known.
    const limitCheck = await checkExportLimit(app.prisma, userId, {
      documentId: document.id,
      documentVersionId: resolvedVersionId,
      format: body.format,
    });
    if (!limitCheck.allowed) {
      throw app.httpErrors.paymentRequired(limitCheck.message);
    }

    const exportJob = await app.prisma.exportJob.create({
      data: {
        userId,
        documentId: document.id,
        documentVersionId: resolvedVersionId,
        format: body.format,
        status: "queued",
      },
    });

    await app.prisma.job.create({
      data: {
        jobType: "export",
        status: "queued",
        payloadJson: {
          exportJobId: exportJob.id,
          format: body.format,
        },
      },
    });

    return reply.code(202).send(exportJob);
  });

  app.get("/", async (request) => {
    const userId = requireUserId(request);
    const query = listExportsQuerySchema.parse(request.query);

    const where = {
      userId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.format ? { format: query.format } : {}),
    };

    const [total, items] = await Promise.all([
      app.prisma.exportJob.count({ where }),
      app.prisma.exportJob.findMany({
        where,
        include: {
          document: {
            select: {
              id: true,
              title: true,
              topic: true,
              documentType: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    return {
      page: query.page,
      pageSize: query.pageSize,
      total,
      items: items.map((item) => ({
        ...item,
        downloadPath:
          item.status === "succeeded"
            ? `/api/v1/exports/${item.id}/download`
            : null,
      })),
    };
  });

  app.get("/:exportJobId/download", async (request, reply) => {
    const userId = requireUserId(request);
    const params = z.object({ exportJobId: z.string().uuid() }).parse(request.params);

    const exportJob = await app.prisma.exportJob.findFirst({
      where: {
        id: params.exportJobId,
        userId,
      },
    });

    if (!exportJob) {
      throw app.httpErrors.notFound("Export job not found or you don't have access to it");
    }

    if (exportJob.status === "queued") {
      throw app.httpErrors.conflict("Export is still queued. Please wait a moment and try again.");
    }

    if (exportJob.status === "running") {
      throw app.httpErrors.conflict("Export is currently being generated. Please wait a moment and try again.");
    }

    if (exportJob.status === "failed") {
      throw app.httpErrors.conflict(
        `Export failed: ${exportJob.errorMessage || "Unknown error occurred during export generation"}`
      );
    }

    if (exportJob.status !== "succeeded" || !exportJob.storageKey) {
      throw app.httpErrors.conflict("Export job is not ready for download");
    }

    const fullPath = resolveExportFilePath(exportJob.storageKey);

    try {
      await access(fullPath);
      const fileStats = await stat(fullPath);

      const extension =
        exportJob.format === "pdf"
          ? "pdf"
          : exportJob.format === "docx"
            ? "docx"
            : "pptx";
      const contentType =
        exportJob.format === "pdf"
          ? "application/pdf"
          : exportJob.format === "docx"
            ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            : "application/vnd.openxmlformats-officedocument.presentationml.presentation";
      const fileName = `edunurse-export-${exportJob.id}.${extension}`;

      const fileBuffer = await readFile(fullPath);

      reply.header("Content-Type", contentType);
      reply.header("Content-Length", fileStats.size);
      reply.header("Content-Disposition", `attachment; filename="${fileName}"`);
      return reply.send(fileBuffer);
    } catch (error) {
      app.log.error({ error, exportJobId: params.exportJobId }, "Export file not found on disk");
      throw app.httpErrors.notFound("Export file not found on server. It may have been cleaned up.");
    }
  });

  app.get("/:exportJobId", async (request) => {
    const userId = requireUserId(request);
    const params = z.object({ exportJobId: z.string().uuid() }).parse(request.params);

    const exportJob = await app.prisma.exportJob.findFirst({
      where: {
        id: params.exportJobId,
        userId,
      },
    });

    if (!exportJob) {
      throw app.httpErrors.notFound("Export job not found");
    }

    return {
      ...exportJob,
      downloadPath:
        exportJob.status === "succeeded"
          ? `/api/v1/exports/${exportJob.id}/download`
          : null,
    };
  });
};

export default exportRoutes;
