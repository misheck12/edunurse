import { FastifyPluginAsync } from "fastify";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireUserId } from "../services/auth-helpers.js";
import { DOCUMENT_TYPES, fromDocumentTypeDb, toDocumentTypeDb } from "../services/constants.js";
import { requireCompleteProfile } from "../services/profile-completion.js";

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  documentType: z.enum(DOCUMENT_TYPES).optional(),
});

const createDocumentSchema = z.object({
  title: z.string().min(1),
  documentType: z.enum(DOCUMENT_TYPES),
  programme: z.string().min(1),
  year: z.string().optional(),
  course: z.string().optional(),
  topic: z.string().min(1),
  durationMinutes: z.number().int().positive().optional(),
  templateId: z.string().uuid().optional(),
  curriculumVersionId: z.string().uuid().optional(),
  contentJson: z.record(z.any()),
  changeSummary: z.string().optional(),
});

const updateDocumentSchema = z.object({
  title: z.string().min(1).optional(),
  programme: z.string().min(1).optional(),
  year: z.string().optional(),
  course: z.string().optional(),
  topic: z.string().min(1).optional(),
  durationMinutes: z.number().int().positive().optional(),
  status: z.enum(["draft", "final"]).optional(),
  createVersion: z.boolean().default(false),
  contentJson: z.record(z.any()).optional(),
  changeSummary: z.string().optional(),
});

const updateSectionSchema = z.object({
  content: z.any(),
  changeSummary: z.string().optional(),
});

const documentRoutes: FastifyPluginAsync = async (app) => {
  // Add profile completion check for all document routes
  app.addHook("preHandler", async (request, reply) => {
    await requireCompleteProfile(request, reply, app.prisma);
  });

  app.get("/", async (request) => {
    const userId = requireUserId(request);
    const query = paginationSchema.parse(request.query);
    const skip = (query.page - 1) * query.pageSize;

    const where = {
      userId,
      deletedAt: null,
      ...(query.documentType ? { documentType: toDocumentTypeDb(query.documentType) } : {}),
    };

    const [total, items] = await app.prisma.$transaction([
      app.prisma.document.count({ where }),
      app.prisma.document.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip,
        take: query.pageSize,
      }),
    ]);

    return {
      page: query.page,
      pageSize: query.pageSize,
      total,
      items: items.map((item) => ({
        ...item,
        documentType: fromDocumentTypeDb(item.documentType),
      })),
    };
  });

  app.post("/", async (request, reply) => {
    const userId = requireUserId(request);
    const body = createDocumentSchema.parse(request.body);

    const created = await app.prisma.$transaction(async (tx) => {
      const doc = await tx.document.create({
        data: {
          userId,
          title: body.title,
          documentType: toDocumentTypeDb(body.documentType),
          programme: body.programme,
          year: body.year,
          course: body.course,
          topic: body.topic,
          durationMinutes: body.durationMinutes,
          templateId: body.templateId,
          curriculumVersionId: body.curriculumVersionId,
          latestVersionNum: 1,
          status: "draft",
        },
      });

      const version = await tx.documentVersion.create({
        data: {
          documentId: doc.id,
          versionNum: 1,
          contentJson: body.contentJson as Prisma.InputJsonValue,
          changeSummary: body.changeSummary,
          createdByUserId: userId,
        },
      });

      return { doc, version };
    });

    return reply.code(201).send(created);
  });

  app.get("/:documentId", async (request) => {
    const userId = requireUserId(request);
    const params = z.object({ documentId: z.string().uuid() }).parse(request.params);

    const document = await app.prisma.document.findFirst({
      where: { id: params.documentId, userId, deletedAt: null },
    });

    if (!document) {
      throw app.httpErrors.notFound("Document not found");
    }

    const latestVersion = await app.prisma.documentVersion.findFirst({
      where: { documentId: document.id },
      orderBy: { versionNum: "desc" },
    });

    return {
      document: {
        ...document,
        documentType: fromDocumentTypeDb(document.documentType),
      },
      latestVersion,
    };
  });

  app.patch("/:documentId", async (request) => {
    const userId = requireUserId(request);
    const params = z.object({ documentId: z.string().uuid() }).parse(request.params);
    const body = updateDocumentSchema.parse(request.body);

    const document = await app.prisma.document.findFirst({
      where: { id: params.documentId, userId, deletedAt: null },
    });

    if (!document) {
      throw app.httpErrors.notFound("Document not found");
    }

    const updated = await app.prisma.$transaction(async (tx) => {
      let latestVersion = await tx.documentVersion.findFirst({
        where: { documentId: document.id },
        orderBy: { versionNum: "desc" },
      });

      if (!latestVersion) {
        throw app.httpErrors.internalServerError("Document version missing");
      }

      const shouldCreateVersion = body.createVersion || Boolean(body.contentJson);

      if (shouldCreateVersion) {
        latestVersion = await tx.documentVersion.create({
          data: {
            documentId: document.id,
            versionNum: document.latestVersionNum + 1,
            contentJson: (body.contentJson ?? latestVersion.contentJson ?? {}) as Prisma.InputJsonValue,
            changeSummary: body.changeSummary,
            createdByUserId: userId,
          },
        });
      }

      const nextDocument = await tx.document.update({
        where: { id: document.id },
        data: {
          title: body.title,
          programme: body.programme,
          year: body.year,
          course: body.course,
          topic: body.topic,
          durationMinutes: body.durationMinutes,
          status: body.status,
          latestVersionNum: shouldCreateVersion ? latestVersion.versionNum : document.latestVersionNum,
        },
      });

      return {
        document: {
          ...nextDocument,
          documentType: fromDocumentTypeDb(nextDocument.documentType),
        },
        latestVersion,
      };
    });

    return updated;
  });

  app.patch("/:documentId/sections/:sectionId", async (request) => {
    const userId = requireUserId(request);
    const params = z
      .object({
        documentId: z.string().uuid(),
        sectionId: z.string().min(1),
      })
      .parse(request.params);
    const body = updateSectionSchema.parse(request.body);

    const document = await app.prisma.document.findFirst({
      where: { id: params.documentId, userId, deletedAt: null },
    });

    if (!document) {
      throw app.httpErrors.notFound("Document not found");
    }

    const result = await app.prisma.$transaction(async (tx) => {
      const currentVersion = await tx.documentVersion.findFirst({
        where: { documentId: document.id },
        orderBy: { versionNum: "desc" },
      });

      if (!currentVersion) {
        throw app.httpErrors.internalServerError("Document version missing");
      }

      if (
        !currentVersion.contentJson ||
        typeof currentVersion.contentJson !== "object" ||
        Array.isArray(currentVersion.contentJson)
      ) {
        throw app.httpErrors.badRequest("content_json must be an object");
      }

      const payload = currentVersion.contentJson as Record<string, unknown>;
      const sections = payload.sections;

      if (!Array.isArray(sections)) {
        throw app.httpErrors.badRequest("content_json.sections must be an array");
      }

      const nextSections = sections.map((section) => {
        if (
          section &&
          typeof section === "object" &&
          "id" in section &&
          section.id === params.sectionId
        ) {
          return {
            ...section,
            content: body.content,
          };
        }

        return section;
      });

      const newVersion = await tx.documentVersion.create({
        data: {
          documentId: document.id,
          versionNum: document.latestVersionNum + 1,
          contentJson: {
            ...payload,
            sections: nextSections,
          } as Prisma.InputJsonValue,
          changeSummary: body.changeSummary ?? `Updated section ${params.sectionId}`,
          createdByUserId: userId,
        },
      });

      const nextDocument = await tx.document.update({
        where: { id: document.id },
        data: {
          latestVersionNum: newVersion.versionNum,
        },
      });

      return {
        document: {
          ...nextDocument,
          documentType: fromDocumentTypeDb(nextDocument.documentType),
        },
        latestVersion: newVersion,
      };
    });

    return result;
  });

  app.delete("/:documentId", async (request, reply) => {
    const userId = requireUserId(request);
    const params = z.object({ documentId: z.string().uuid() }).parse(request.params);

    const exists = await app.prisma.document.findFirst({
      where: { id: params.documentId, userId, deletedAt: null },
      select: { id: true },
    });

    if (!exists) {
      throw app.httpErrors.notFound("Document not found");
    }

    await app.prisma.document.update({
      where: { id: params.documentId },
      data: { deletedAt: new Date() },
    });

    return reply.code(204).send();
  });
};

export default documentRoutes;
