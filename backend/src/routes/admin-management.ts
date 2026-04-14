import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireAdminUser } from "../services/auth-helpers.js";

const userRoleSchema = z.enum(["student", "educator", "admin"]);
const subscriptionStatusSchema = z.enum([
  "trialing",
  "active",
  "past_due",
  "canceled",
]);
const transactionStatusSchema = z.enum([
  "pending",
  "succeeded",
  "failed",
  "canceled",
]);
const transactionTypeSchema = z.enum(["charge", "refund", "adjustment"]);

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

const listUsersSchema = paginationSchema.extend({
  search: z.string().optional(),
  role: userRoleSchema.optional(),
  isActive: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});

const updateUserSchema = z.object({
  fullName: z.string().min(1).nullable().optional(),
  email: z.string().email().optional(),
  phoneNumber: z.string().nullable().optional(),
  nrc: z.string().nullable().optional(),
  school: z.string().nullable().optional(),
  studentNumber: z.string().nullable().optional(),
  information: z.string().nullable().optional(),
  role: userRoleSchema.optional(),
  isActive: z.boolean().optional(),
});

const createUserSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1).optional(),
  role: userRoleSchema.default("student"),
  isActive: z.boolean().default(true),
  preferences: z
    .object({
      defaultProgramme: z.string().min(1).optional(),
      defaultYear: z.string().min(1).optional(),
      defaultDocumentType: z.string().min(1).optional(),
      exportDefaults: z.record(z.any()).optional(),
      uiPreferences: z.record(z.any()).optional(),
    })
    .optional(),
});

const createPlanSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  monthlyPriceCents: z.number().int().nonnegative(),
  limitsJson: z.record(z.any()).default({}),
});

const updatePlanSchema = z.object({
  code: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  monthlyPriceCents: z.number().int().nonnegative().optional(),
  limitsJson: z.record(z.any()).optional(),
});

const listSubscriptionsSchema = paginationSchema.extend({
  userId: z.string().uuid().optional(),
  status: subscriptionStatusSchema.optional(),
});

const createSubscriptionSchema = z.object({
  userId: z.string().uuid(),
  planId: z.string().uuid(),
  provider: z.string().min(1).default("manual"),
  providerSubscriptionId: z.string().min(1).optional(),
  status: subscriptionStatusSchema.default("active"),
  currentPeriodStart: z.string().datetime().optional(),
  currentPeriodEnd: z.string().datetime().optional(),
  cancelAtPeriodEnd: z.boolean().default(false),
});

const updateSubscriptionSchema = z.object({
  planId: z.string().uuid().optional(),
  status: subscriptionStatusSchema.optional(),
  currentPeriodStart: z.string().datetime().nullable().optional(),
  currentPeriodEnd: z.string().datetime().nullable().optional(),
  cancelAtPeriodEnd: z.boolean().optional(),
});

const listTransactionsSchema = paginationSchema.extend({
  userId: z.string().uuid().optional(),
  subscriptionId: z.string().uuid().optional(),
  status: transactionStatusSchema.optional(),
  transactionType: transactionTypeSchema.optional(),
});

const createTransactionSchema = z.object({
  userId: z.string().uuid(),
  subscriptionId: z.string().uuid().optional(),
  provider: z.string().min(1),
  externalTransactionId: z.string().min(1).optional(),
  transactionType: transactionTypeSchema,
  status: transactionStatusSchema.default("pending"),
  amountCents: z.number().int(),
  currency: z.string().min(3).max(3).default("USD"),
  metadataJson: z.record(z.any()).default({}),
  errorMessage: z.string().optional(),
  processedAt: z.string().datetime().optional(),
});

const updateTransactionSchema = z.object({
  status: transactionStatusSchema.optional(),
  metadataJson: z.record(z.any()).optional(),
  errorMessage: z.string().nullable().optional(),
  processedAt: z.string().datetime().nullable().optional(),
});

const adminManagementRoutes: FastifyPluginAsync = async (app) => {
  const prisma = app.prisma as any;
  app.get("/users", async (request) => {
    await requireAdminUser(app, request);
    const query = listUsersSchema.parse(request.query);
    const skip = (query.page - 1) * query.pageSize;

    const where = {
      ...(query.role ? { role: query.role } : {}),
      ...(typeof query.isActive === "boolean" ? { isActive: query.isActive } : {}),
      ...(query.search
        ? {
            OR: [
              {
                email: {
                  contains: query.search,
                  mode: "insensitive" as const,
                },
              },
              {
                fullName: {
                  contains: query.search,
                  mode: "insensitive" as const,
                },
              },
            ],
          }
        : {}),
    };

    const [total, items] = await prisma.$transaction([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: query.pageSize,
        include: {
          preferences: true,
          subscriptions: {
            orderBy: { createdAt: "desc" },
            take: 1,
            include: {
              plan: true,
            },
          },
          _count: {
            select: {
              documents: true,
              generationRuns: true,
              exportJobs: true,
              transactions: true,
            },
          },
        },
      }),
    ]);

    return {
      page: query.page,
      pageSize: query.pageSize,
      total,
      items,
    };
  });

  app.get("/users/:userId", async (request) => {
    await requireAdminUser(app, request);
    const params = z.object({ userId: z.string().uuid() }).parse(request.params);

    const user = await prisma.user.findUnique({
      where: { id: params.userId },
      include: {
        preferences: true,
        subscriptions: {
          orderBy: { createdAt: "desc" },
          include: {
            plan: true,
          },
        },
        transactions: {
          orderBy: { createdAt: "desc" },
          take: 25,
        },
        _count: {
          select: {
            documents: true,
            generationRuns: true,
            exportJobs: true,
            transactions: true,
          },
        },
      },
    });

    if (!user) {
      throw app.httpErrors.notFound("User not found");
    }

    return user;
  });

  app.post("/users", async (request, reply) => {
    await requireAdminUser(app, request);
    const body = createUserSchema.parse(request.body);

    const normalizedEmail = body.email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (existing) {
      throw app.httpErrors.conflict("User with this email already exists.");
    }

    const created = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash: "seeded_admin_created_user",
        fullName: body.fullName,
        role: body.role,
        isActive: body.isActive,
        preferences: body.preferences
          ? {
              create: {
                defaultProgramme: body.preferences.defaultProgramme,
                defaultYear: body.preferences.defaultYear,
                defaultDocumentType: body.preferences.defaultDocumentType,
                exportDefaults: body.preferences.exportDefaults ?? {},
                uiPreferences: body.preferences.uiPreferences ?? {},
              },
            }
          : undefined,
      },
      include: {
        preferences: true,
        subscriptions: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            plan: true,
          },
        },
        _count: {
          select: {
            documents: true,
            generationRuns: true,
            exportJobs: true,
            transactions: true,
          },
        },
      },
    });

    return reply.code(201).send(created);
  });

  app.patch("/users/:userId", async (request) => {
    await requireAdminUser(app, request);
    const params = z.object({ userId: z.string().uuid() }).parse(request.params);
    const body = updateUserSchema.parse(request.body);

    const user = await prisma.user.findUnique({
      where: { id: params.userId },
      select: { id: true },
    });

    if (!user) {
      throw app.httpErrors.notFound("User not found");
    }

    return prisma.user.update({
      where: { id: params.userId },
      data: {
        fullName: body.fullName,
        email: body.email,
        phoneNumber: body.phoneNumber,
        nrc: body.nrc,
        school: body.school,
        studentNumber: body.studentNumber,
        information: body.information,
        role: body.role,
        isActive: body.isActive,
      },
      include: {
        subscriptions: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { plan: true },
        },
      },
    });
  });

  app.get("/plans", async (request) => {
    await requireAdminUser(app, request);
    return prisma.plan.findMany({
      orderBy: { createdAt: "desc" },
    });
  });

  app.post("/plans", async (request, reply) => {
    await requireAdminUser(app, request);
    const body = createPlanSchema.parse(request.body);

    const plan = await prisma.plan.create({
      data: {
        code: body.code,
        name: body.name,
        monthlyPriceCents: body.monthlyPriceCents,
        limitsJson: body.limitsJson,
      },
    });

    return reply.code(201).send(plan);
  });

  app.patch("/plans/:planId", async (request) => {
    await requireAdminUser(app, request);
    const params = z.object({ planId: z.string().uuid() }).parse(request.params);
    const body = updatePlanSchema.parse(request.body);

    const plan = await prisma.plan.findUnique({
      where: { id: params.planId },
      select: { id: true },
    });

    if (!plan) {
      throw app.httpErrors.notFound("Plan not found");
    }

    return prisma.plan.update({
      where: { id: params.planId },
      data: {
        code: body.code,
        name: body.name,
        monthlyPriceCents: body.monthlyPriceCents,
        limitsJson: body.limitsJson,
      },
    });
  });

  app.get("/subscriptions", async (request) => {
    await requireAdminUser(app, request);
    const query = listSubscriptionsSchema.parse(request.query);
    const skip = (query.page - 1) * query.pageSize;

    const where = {
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const [total, items] = await prisma.$transaction([
      prisma.subscription.count({ where }),
      prisma.subscription.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: query.pageSize,
        include: {
          plan: true,
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
              role: true,
              isActive: true,
            },
          },
          transactions: {
            orderBy: { createdAt: "desc" },
            take: 5,
          },
        },
      }),
    ]);

    return {
      page: query.page,
      pageSize: query.pageSize,
      total,
      items,
    };
  });

  app.post("/subscriptions", async (request, reply) => {
    await requireAdminUser(app, request);
    const body = createSubscriptionSchema.parse(request.body);

    const [user, plan] = await Promise.all([
      prisma.user.findUnique({
        where: { id: body.userId },
        select: { id: true },
      }),
      prisma.plan.findUnique({
        where: { id: body.planId },
        select: { id: true },
      }),
    ]);

    if (!user) {
      throw app.httpErrors.notFound("User not found");
    }

    if (!plan) {
      throw app.httpErrors.notFound("Plan not found");
    }

    const subscription = await prisma.subscription.create({
      data: {
        userId: body.userId,
        planId: body.planId,
        provider: body.provider,
        providerSubscriptionId: body.providerSubscriptionId,
        status: body.status,
        currentPeriodStart: body.currentPeriodStart
          ? new Date(body.currentPeriodStart)
          : new Date(),
        currentPeriodEnd: body.currentPeriodEnd
          ? new Date(body.currentPeriodEnd)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        cancelAtPeriodEnd: body.cancelAtPeriodEnd,
      },
      include: {
        plan: true,
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
    });

    return reply.code(201).send(subscription);
  });

  app.patch("/subscriptions/:subscriptionId", async (request) => {
    await requireAdminUser(app, request);
    const params = z
      .object({ subscriptionId: z.string().uuid() })
      .parse(request.params);
    const body = updateSubscriptionSchema.parse(request.body);

    const subscription = await prisma.subscription.findUnique({
      where: { id: params.subscriptionId },
      select: { id: true },
    });

    if (!subscription) {
      throw app.httpErrors.notFound("Subscription not found");
    }

    if (body.planId) {
      const plan = await prisma.plan.findUnique({
        where: { id: body.planId },
        select: { id: true },
      });
      if (!plan) {
        throw app.httpErrors.notFound("Plan not found");
      }
    }

    return prisma.subscription.update({
      where: { id: params.subscriptionId },
      data: {
        planId: body.planId,
        status: body.status,
        currentPeriodStart:
          body.currentPeriodStart === undefined
            ? undefined
            : body.currentPeriodStart === null
              ? null
              : new Date(body.currentPeriodStart),
        currentPeriodEnd:
          body.currentPeriodEnd === undefined
            ? undefined
            : body.currentPeriodEnd === null
              ? null
              : new Date(body.currentPeriodEnd),
        cancelAtPeriodEnd: body.cancelAtPeriodEnd,
      },
      include: {
        plan: true,
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
    });
  });

  app.get("/transactions", async (request) => {
    await requireAdminUser(app, request);
    const query = listTransactionsSchema.parse(request.query);
    const skip = (query.page - 1) * query.pageSize;

    const where = {
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.subscriptionId ? { subscriptionId: query.subscriptionId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.transactionType ? { transactionType: query.transactionType } : {}),
    };

    const [total, items] = await prisma.$transaction([
      prisma.transaction.count({ where }),
      prisma.transaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: query.pageSize,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
            },
          },
          subscription: {
            include: {
              plan: true,
            },
          },
        },
      }),
    ]);

    return {
      page: query.page,
      pageSize: query.pageSize,
      total,
      items,
    };
  });

  app.post("/transactions", async (request, reply) => {
    await requireAdminUser(app, request);
    const body = createTransactionSchema.parse(request.body);

    const user = await prisma.user.findUnique({
      where: { id: body.userId },
      select: { id: true },
    });

    if (!user) {
      throw app.httpErrors.notFound("User not found");
    }

    if (body.subscriptionId) {
      const subscription = await prisma.subscription.findUnique({
        where: { id: body.subscriptionId },
        select: { id: true, userId: true },
      });

      if (!subscription) {
        throw app.httpErrors.notFound("Subscription not found");
      }

      if (subscription.userId !== body.userId) {
        throw app.httpErrors.badRequest(
          "subscriptionId does not belong to provided userId",
        );
      }
    }

    const transaction = await prisma.transaction.create({
      data: {
        userId: body.userId,
        subscriptionId: body.subscriptionId,
        provider: body.provider,
        externalTransactionId: body.externalTransactionId,
        transactionType: body.transactionType,
        status: body.status,
        amountCents: body.amountCents,
        currency: body.currency.toUpperCase(),
        metadataJson: body.metadataJson,
        errorMessage: body.errorMessage,
        processedAt: body.processedAt ? new Date(body.processedAt) : null,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
        subscription: {
          include: {
            plan: true,
          },
        },
      },
    });

    return reply.code(201).send(transaction);
  });

  app.patch("/transactions/:transactionId", async (request) => {
    await requireAdminUser(app, request);
    const params = z
      .object({ transactionId: z.string().uuid() })
      .parse(request.params);
    const body = updateTransactionSchema.parse(request.body);

    const transaction = await prisma.transaction.findUnique({
      where: { id: params.transactionId },
      select: { id: true },
    });

    if (!transaction) {
      throw app.httpErrors.notFound("Transaction not found");
    }

    return prisma.transaction.update({
      where: { id: params.transactionId },
      data: {
        status: body.status,
        metadataJson: body.metadataJson,
        errorMessage: body.errorMessage,
        processedAt:
          body.processedAt === undefined
            ? undefined
            : body.processedAt === null
              ? null
              : new Date(body.processedAt),
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
        subscription: {
          include: {
            plan: true,
          },
        },
      },
    });
  });
};

export default adminManagementRoutes;
