/**
 * Admin Notification / Communication Routes
 * Provides endpoints for ops admins to:
 *   - Send email / SMS / WhatsApp to individual users or custom recipients
 *   - Broadcast messages to all users (or filtered groups)
 *   - View notification logs
 */

import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireAdminUser } from "../services/auth-helpers.js";
import {
  sendNotification,
  sendMultiChannelNotification,
  type NotificationChannel,
  type SendNotificationInput,
} from "../services/notifications.js";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const channelSchema = z.enum(["email", "sms", "whatsapp"]);

const sendSingleSchema = z.object({
  channel: channelSchema,
  recipient: z.string().min(1),
  subject: z.string().max(200).optional(),
  body: z.string().min(1).max(10000),
  userId: z.string().uuid().optional(),
});

const sendBulkSchema = z.object({
  channel: channelSchema,
  subject: z.string().max(200).optional(),
  body: z.string().min(1).max(10000),
  /** If provided, only send to these user IDs. Otherwise send to all active users. */
  userIds: z.array(z.string().uuid()).optional(),
  /** Filter: only users with a specific role */
  filterRole: z.enum(["student", "educator", "admin"]).optional(),
});

const logQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
  channel: channelSchema.optional(),
  status: z.enum(["pending", "sent", "failed"]).optional(),
  userId: z.string().uuid().optional(),
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

const adminNotificationRoutes: FastifyPluginAsync = async (app) => {
  const prisma = app.prisma as any;

  // -----------------------------------------------------------------------
  // POST /admin/notifications/send — send to one recipient
  // -----------------------------------------------------------------------
  app.post("/notifications/send", async (request, reply) => {
    const admin = await requireAdminUser(app, request);
    const body = sendSingleSchema.parse(request.body);

    const result = await sendNotification({
      channel: body.channel as NotificationChannel,
      recipient: body.recipient,
      subject: body.subject,
      body: body.body,
      userId: body.userId,
      sentBy: admin.id,
    });

    return reply.code(result.success ? 200 : 502).send(result);
  });

  // -----------------------------------------------------------------------
  // POST /admin/notifications/broadcast — send to many users
  // -----------------------------------------------------------------------
  app.post("/notifications/broadcast", async (request, reply) => {
    const admin = await requireAdminUser(app, request);
    const body = sendBulkSchema.parse(request.body);

    // Resolve target users
    let users: Array<{ id: string; email: string; phoneNumber: string | null; fullName: string | null }>;

    if (body.userIds?.length) {
      users = await prisma.user.findMany({
        where: { id: { in: body.userIds }, isActive: true },
        select: { id: true, email: true, phoneNumber: true, fullName: true },
      });
    } else {
      users = await prisma.user.findMany({
        where: {
          isActive: true,
          ...(body.filterRole ? { role: body.filterRole } : {}),
        },
        select: { id: true, email: true, phoneNumber: true, fullName: true },
      });
    }

    if (users.length === 0) {
      return reply.code(400).send({ success: false, message: "No matching users found." });
    }

    // Build notification inputs
    const inputs: SendNotificationInput[] = users
      .map((u) => {
        let recipient: string | null = null;
        if (body.channel === "email") recipient = u.email;
        if (body.channel === "sms" || body.channel === "whatsapp") recipient = u.phoneNumber;
        if (!recipient) return null;

        return {
          channel: body.channel as NotificationChannel,
          recipient,
          subject: body.subject,
          body: body.body,
          userId: u.id,
          sentBy: admin.id,
        };
      })
      .filter(Boolean) as SendNotificationInput[];

    if (inputs.length === 0) {
      return reply.code(400).send({
        success: false,
        message: `No users have a valid ${body.channel === "email" ? "email" : "phone number"} configured.`,
      });
    }

    const results = await sendMultiChannelNotification(inputs);
    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return {
      success: true,
      total: inputs.length,
      succeeded,
      failed,
      results,
    };
  });

  // -----------------------------------------------------------------------
  // GET /admin/notifications/logs — view notification history
  // -----------------------------------------------------------------------
  app.get("/notifications/logs", async (request) => {
    await requireAdminUser(app, request);
    const query = logQuerySchema.parse(request.query);
    const skip = (query.page - 1) * query.pageSize;

    const where = {
      ...(query.channel ? { channel: query.channel } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
    };

    const [total, items] = await prisma.$transaction([
      prisma.notificationLog.count({ where }),
      prisma.notificationLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: query.pageSize,
        include: {
          user: {
            select: { id: true, email: true, fullName: true },
          },
        },
      }),
    ]);

    return { page: query.page, pageSize: query.pageSize, total, items };
  });

  // -----------------------------------------------------------------------
  // GET /admin/notifications/stats — quick channel stats
  // -----------------------------------------------------------------------
  app.get("/notifications/stats", async (request) => {
    await requireAdminUser(app, request);

    const [emailSent, smsSent, whatsappSent, totalFailed] = await Promise.all([
      prisma.notificationLog.count({ where: { channel: "email", status: "sent" } }),
      prisma.notificationLog.count({ where: { channel: "sms", status: "sent" } }),
      prisma.notificationLog.count({ where: { channel: "whatsapp", status: "sent" } }),
      prisma.notificationLog.count({ where: { status: "failed" } }),
    ]);

    return { emailSent, smsSent, whatsappSent, totalFailed };
  });
};

export default adminNotificationRoutes;
