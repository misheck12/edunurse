/**
 * Admin Marketing Routes
 * Email template management and campaign broadcasting for ops admins.
 */

import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireAdminUser } from "../services/auth-helpers.js";
import { sendCustomEmail } from "../services/email.js";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const templateCreateSchema = z.object({
  name: z.string().min(1).max(200),
  subject: z.string().min(1).max(300),
  htmlBody: z.string().min(1).max(100_000),
  category: z.enum(["marketing", "transactional", "onboarding"]).default("marketing"),
});

const templateUpdateSchema = templateCreateSchema.partial().extend({
  isActive: z.boolean().optional(),
});

const campaignCreateSchema = z.object({
  name: z.string().min(1).max(200),
  templateId: z.string().uuid().optional(),
  subject: z.string().min(1).max(300),
  htmlBody: z.string().min(1).max(100_000),
  audienceFilter: z
    .object({
      role: z.enum(["student", "educator", "admin"]).optional(),
      planTier: z.enum(["free", "pro", "premium"]).optional(),
      joinedAfter: z.string().datetime().optional(),
      joinedBefore: z.string().datetime().optional(),
      hasPhone: z.boolean().optional(),
    })
    .default({}),
  scheduledAt: z.string().datetime().optional(),
});

const campaignUpdateSchema = campaignCreateSchema.partial().extend({
  status: z.enum(["draft", "scheduled", "sending", "sent", "failed"]).optional(),
});

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

const adminMarketingRoutes: FastifyPluginAsync = async (app) => {
  const prisma = app.prisma as any;

  // ===================== EMAIL TEMPLATES =====================

  /**
   * GET /admin/marketing/templates — list all email templates
   */
  app.get("/marketing/templates", async (request) => {
    await requireAdminUser(app, request);
    const query = paginationSchema.parse(request.query);
    const skip = (query.page - 1) * query.pageSize;

    const [total, items] = await prisma.$transaction([
      prisma.emailTemplate.count(),
      prisma.emailTemplate.findMany({
        orderBy: { updatedAt: "desc" },
        skip,
        take: query.pageSize,
      }),
    ]);

    return { page: query.page, pageSize: query.pageSize, total, items };
  });

  /**
   * GET /admin/marketing/templates/:id — single template detail
   */
  app.get("/marketing/templates/:id", async (request) => {
    await requireAdminUser(app, request);
    const { id } = request.params as { id: string };

    const template = await prisma.emailTemplate.findUnique({ where: { id } });
    if (!template) throw app.httpErrors.notFound("Template not found");
    return template;
  });

  /**
   * POST /admin/marketing/templates — create template
   */
  app.post("/marketing/templates", async (request) => {
    const admin = await requireAdminUser(app, request);
    const body = templateCreateSchema.parse(request.body);

    return prisma.emailTemplate.create({
      data: { ...body, createdBy: admin.id },
    });
  });

  /**
   * PATCH /admin/marketing/templates/:id — update template
   */
  app.patch("/marketing/templates/:id", async (request) => {
    await requireAdminUser(app, request);
    const { id } = request.params as { id: string };
    const body = templateUpdateSchema.parse(request.body);

    return prisma.emailTemplate.update({ where: { id }, data: body });
  });

  /**
   * DELETE /admin/marketing/templates/:id — soft-delete template
   */
  app.delete("/marketing/templates/:id", async (request) => {
    await requireAdminUser(app, request);
    const { id } = request.params as { id: string };

    await prisma.emailTemplate.update({
      where: { id },
      data: { isActive: false },
    });

    return { success: true };
  });

  // ===================== EMAIL CAMPAIGNS =====================

  /**
   * GET /admin/marketing/campaigns — list campaigns
   */
  app.get("/marketing/campaigns", async (request) => {
    await requireAdminUser(app, request);
    const query = paginationSchema.parse(request.query);
    const skip = (query.page - 1) * query.pageSize;

    const [total, items] = await prisma.$transaction([
      prisma.emailCampaign.count(),
      prisma.emailCampaign.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take: query.pageSize,
        include: { template: { select: { id: true, name: true } } },
      }),
    ]);

    return { page: query.page, pageSize: query.pageSize, total, items };
  });

  /**
   * GET /admin/marketing/campaigns/:id — single campaign detail
   */
  app.get("/marketing/campaigns/:id", async (request) => {
    await requireAdminUser(app, request);
    const { id } = request.params as { id: string };

    const campaign = await prisma.emailCampaign.findUnique({
      where: { id },
      include: { template: true },
    });
    if (!campaign) throw app.httpErrors.notFound("Campaign not found");
    return campaign;
  });

  /**
   * POST /admin/marketing/campaigns — create campaign (draft)
   */
  app.post("/marketing/campaigns", async (request) => {
    const admin = await requireAdminUser(app, request);
    const body = campaignCreateSchema.parse(request.body);

    return prisma.emailCampaign.create({
      data: {
        ...body,
        status: body.scheduledAt ? "scheduled" : "draft",
        createdBy: admin.id,
      },
    });
  });

  /**
   * PATCH /admin/marketing/campaigns/:id — update draft/scheduled campaign
   */
  app.patch("/marketing/campaigns/:id", async (request) => {
    await requireAdminUser(app, request);
    const { id } = request.params as { id: string };
    const body = campaignUpdateSchema.parse(request.body);

    const existing = await prisma.emailCampaign.findUnique({ where: { id } });
    if (!existing) throw app.httpErrors.notFound("Campaign not found");
    if (existing.status === "sending" || existing.status === "sent") {
      throw app.httpErrors.badRequest("Cannot edit a campaign that is already sent or sending.");
    }

    return prisma.emailCampaign.update({ where: { id }, data: body });
  });

  /**
   * POST /admin/marketing/campaigns/:id/send — send or schedule a campaign
   */
  app.post("/marketing/campaigns/:id/send", async (request, reply) => {
    const admin = await requireAdminUser(app, request);
    const { id } = request.params as { id: string };

    const campaign = await prisma.emailCampaign.findUnique({ where: { id } });
    if (!campaign) throw app.httpErrors.notFound("Campaign not found");
    if (campaign.status === "sent" || campaign.status === "sending") {
      throw app.httpErrors.badRequest("Campaign already sent.");
    }

    // Build audience query from filters
    const filter = (campaign.audienceFilter ?? {}) as Record<string, unknown>;
    const where: Record<string, unknown> = { isActive: true };

    if (filter.role) where.role = filter.role;
    if (filter.joinedAfter || filter.joinedBefore) {
      where.createdAt = {
        ...(filter.joinedAfter ? { gte: new Date(filter.joinedAfter as string) } : {}),
        ...(filter.joinedBefore ? { lte: new Date(filter.joinedBefore as string) } : {}),
      };
    }

    // Plan-tier filter: look at active subscriptions' plan codes
    if (filter.planTier === "free") {
      where.subscriptions = { none: { status: "active" } };
    } else if (filter.planTier === "pro") {
      where.subscriptions = { some: { status: "active", plan: { code: "monthly_sub" } } };
    }

    const users = await prisma.user.findMany({
      where,
      select: { id: true, email: true, fullName: true },
    });

    if (users.length === 0) {
      return reply.code(400).send({ success: false, message: "No matching recipients found." });
    }

    // Mark campaign as sending
    await prisma.emailCampaign.update({
      where: { id },
      data: { status: "sending", totalRecipients: users.length },
    });

    // Send emails in batches (non-blocking, best-effort)
    let sent = 0;
    let failed = 0;

    for (const user of users) {
      try {
        // Replace simple placeholders
        const personalizedHtml = campaign.htmlBody
          .replace(/\{\{name\}\}/gi, user.fullName || "there")
          .replace(/\{\{email\}\}/gi, user.email);

        await sendCustomEmail(user.email, campaign.subject, personalizedHtml);
        sent++;
      } catch (err) {
        failed++;
        app.log.error({ error: err, userId: user.id, campaignId: id }, "Campaign email failed");
      }
    }

    // Update campaign stats
    await prisma.emailCampaign.update({
      where: { id },
      data: {
        status: "sent",
        sentAt: new Date(),
        totalSent: sent,
        totalFailed: failed,
      },
    });

    return {
      success: true,
      total: users.length,
      sent,
      failed,
    };
  });

  /**
   * POST /admin/marketing/campaigns/:id/preview — estimate audience and preview
   */
  app.post("/marketing/campaigns/:id/preview", async (request) => {
    await requireAdminUser(app, request);
    const { id } = request.params as { id: string };

    const campaign = await prisma.emailCampaign.findUnique({ where: { id } });
    if (!campaign) throw app.httpErrors.notFound("Campaign not found");

    const filter = (campaign.audienceFilter ?? {}) as Record<string, unknown>;
    const where: Record<string, unknown> = { isActive: true };
    if (filter.role) where.role = filter.role;
    if (filter.joinedAfter || filter.joinedBefore) {
      where.createdAt = {
        ...(filter.joinedAfter ? { gte: new Date(filter.joinedAfter as string) } : {}),
        ...(filter.joinedBefore ? { lte: new Date(filter.joinedBefore as string) } : {}),
      };
    }
    if (filter.planTier === "free") {
      where.subscriptions = { none: { status: "active" } };
    } else if (filter.planTier === "pro") {
      where.subscriptions = { some: { status: "active", plan: { code: "monthly_sub" } } };
    }

    const audienceCount = await prisma.user.count({ where });

    return {
      audienceCount,
      subject: campaign.subject,
      previewHtml: campaign.htmlBody.slice(0, 500),
    };
  });

  /**
   * DELETE /admin/marketing/campaigns/:id — delete draft campaign
   */
  app.delete("/marketing/campaigns/:id", async (request) => {
    await requireAdminUser(app, request);
    const { id } = request.params as { id: string };

    const existing = await prisma.emailCampaign.findUnique({ where: { id } });
    if (!existing) throw app.httpErrors.notFound("Campaign not found");
    if (existing.status === "sent" || existing.status === "sending") {
      throw app.httpErrors.badRequest("Cannot delete a sent campaign.");
    }

    await prisma.emailCampaign.delete({ where: { id } });
    return { success: true };
  });

  /**
   * GET /admin/marketing/stats — marketing dashboard stats
   */
  app.get("/marketing/stats", async (request) => {
    await requireAdminUser(app, request);

    const [totalCampaigns, sentCampaigns, totalTemplates, totalSent, totalFailed] =
      await Promise.all([
        prisma.emailCampaign.count(),
        prisma.emailCampaign.count({ where: { status: "sent" } }),
        prisma.emailTemplate.count({ where: { isActive: true } }),
        prisma.emailCampaign.aggregate({ _sum: { totalSent: true } }),
        prisma.emailCampaign.aggregate({ _sum: { totalFailed: true } }),
      ]);

    return {
      totalCampaigns,
      sentCampaigns,
      totalTemplates,
      totalEmailsSent: totalSent._sum.totalSent ?? 0,
      totalEmailsFailed: totalFailed._sum.totalFailed ?? 0,
    };
  });
};

export default adminMarketingRoutes;
