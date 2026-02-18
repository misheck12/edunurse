import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireUserId } from "../services/auth-helpers.js";
import { DOCUMENT_TYPES, fromDocumentTypeDb, toDocumentTypeDb } from "../services/constants.js";

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(30),
});

const listTemplatesSchema = paginationSchema.extend({
  scope: z.enum(["builtin", "mine", "all"]).default("all"),
  search: z.string().trim().min(1).optional(),
  documentType: z.enum(DOCUMENT_TYPES).optional(),
});

const createTemplateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  documentType: z.enum(DOCUMENT_TYPES),
  templateSchemaVersion: z.number().int().positive().max(100).default(1),
  templateJson: z.record(z.any()).default({}),
});

const updateTemplateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  templateSchemaVersion: z.number().int().positive().max(100).optional(),
  templateJson: z.record(z.any()).optional(),
  isActive: z.boolean().optional(),
});

const templateIdParamsSchema = z.object({
  templateId: z.string().uuid(),
});

const templateRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async (request) => {
    const userId = requireUserId(request);
    const query = listTemplatesSchema.parse(request.query);
    const skip = (query.page - 1) * query.pageSize;

    const scopeWhere =
      query.scope === "builtin"
        ? { isBuiltin: true as const }
        : query.scope === "mine"
          ? { ownerUserId: userId, isBuiltin: false as const }
          : {
              OR: [{ isBuiltin: true as const }, { ownerUserId: userId }],
            };

    const where = {
      ...scopeWhere,
      isActive: true,
      ...(query.search
        ? {
            name: {
              contains: query.search,
              mode: "insensitive" as const,
            },
          }
        : {}),
      ...(query.documentType
        ? { documentType: toDocumentTypeDb(query.documentType) }
        : {}),
    };

    const [total, items] = await app.prisma.$transaction([
      app.prisma.template.count({ where }),
      app.prisma.template.findMany({
        where,
        orderBy: [{ isBuiltin: "desc" }, { updatedAt: "desc" }],
        skip,
        take: query.pageSize,
        include: {
          owner: {
            select: {
              id: true,
              email: true,
              fullName: true,
            },
          },
          _count: {
            select: {
              documents: true,
            },
          },
        },
      }),
    ]);

    return {
      page: query.page,
      pageSize: query.pageSize,
      total,
      items: items.map((item) => ({
        ...item,
        documentType: fromDocumentTypeDb(item.documentType),
        usageCount: item._count.documents,
      })),
    };
  });

  app.post("/", async (request, reply) => {
    const userId = requireUserId(request);
    const body = createTemplateSchema.parse(request.body);

    const created = await app.prisma.template.create({
      data: {
        ownerUserId: userId,
        name: body.name,
        documentType: toDocumentTypeDb(body.documentType),
        templateSchemaVersion: body.templateSchemaVersion,
        templateJson: body.templateJson,
        isBuiltin: false,
        isActive: true,
      },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
        _count: {
          select: {
            documents: true,
          },
        },
      },
    });

    return reply.code(201).send({
      ...created,
      documentType: fromDocumentTypeDb(created.documentType),
      usageCount: created._count.documents,
    });
  });

  app.patch("/:templateId", async (request) => {
    const userId = requireUserId(request);
    const params = templateIdParamsSchema.parse(request.params);
    const body = updateTemplateSchema.parse(request.body);

    const existing = await app.prisma.template.findUnique({
      where: { id: params.templateId },
      select: {
        id: true,
        isBuiltin: true,
        ownerUserId: true,
      },
    });

    if (!existing || existing.ownerUserId !== userId) {
      throw app.httpErrors.notFound("Template not found");
    }

    if (existing.isBuiltin) {
      throw app.httpErrors.forbidden("Built-in templates cannot be edited.");
    }

    const updated = await app.prisma.template.update({
      where: { id: params.templateId },
      data: {
        name: body.name,
        templateSchemaVersion: body.templateSchemaVersion,
        templateJson: body.templateJson,
        isActive: body.isActive,
      },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
        _count: {
          select: {
            documents: true,
          },
        },
      },
    });

    return {
      ...updated,
      documentType: fromDocumentTypeDb(updated.documentType),
      usageCount: updated._count.documents,
    };
  });

  app.delete("/:templateId", async (request, reply) => {
    const userId = requireUserId(request);
    const params = templateIdParamsSchema.parse(request.params);

    const existing = await app.prisma.template.findUnique({
      where: { id: params.templateId },
      select: {
        id: true,
        isBuiltin: true,
        ownerUserId: true,
      },
    });

    if (!existing || existing.ownerUserId !== userId) {
      throw app.httpErrors.notFound("Template not found");
    }

    if (existing.isBuiltin) {
      throw app.httpErrors.forbidden("Built-in templates cannot be deleted.");
    }

    await app.prisma.template.update({
      where: { id: params.templateId },
      data: { isActive: false },
    });

    return reply.code(204).send();
  });
};

export default templateRoutes;
