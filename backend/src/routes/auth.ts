import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { env } from "../config.js";
import { hashPassword, verifyPassword } from "../services/auth-password.js";
import { signAuthToken } from "../services/auth-token.js";
import { sendWelcomeEmail } from "../services/email.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const clientSignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(2),
  phoneNumber: z.string().min(8),
  nrc: z.string().regex(/^\d{6}\/\d{2}\/\d{1}$/, "NRC must be in format: 123456/12/1"),
  school: z.string().min(2),
  studentNumber: z.string().min(2),
  information: z.string().optional(),
});

const clientSigninSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const authUserSelect = {
  id: true,
  email: true,
  fullName: true,
  phoneNumber: true,
  nrc: true,
  school: true,
  studentNumber: true,
  information: true,
  profileCompleted: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

const authRoutes: FastifyPluginAsync = async (app) => {
  app.post("/login", async (request) => {
    const body = loginSchema.parse(request.body);

    if (
      body.email.toLowerCase() !== env.SUPERADMIN_EMAIL.toLowerCase() ||
      body.password !== env.SUPERADMIN_PASSWORD
    ) {
      throw app.httpErrors.unauthorized("Invalid email or password.");
    }

    const superadmin = await app.prisma.user.upsert({
      where: { email: env.SUPERADMIN_EMAIL.toLowerCase() },
      update: {
        role: "admin",
        isActive: true,
        fullName: "EduNurse Superadmin",
      },
      create: {
        email: env.SUPERADMIN_EMAIL.toLowerCase(),
        passwordHash: "env_superadmin_managed",
        fullName: "EduNurse Superadmin",
        role: "admin",
        isActive: true,
      },
      select: authUserSelect,
    });

    const isNewUser =
      new Date().getTime() - new Date(superadmin.createdAt).getTime() < 5000;
    if (isNewUser) {
      await sendWelcomeEmail(superadmin.email, {
        userName: superadmin.fullName || "Educator",
        freeGenerations: 2,
      }).catch((err) => {
        app.log.error({ error: err }, "Failed to send welcome email");
      });
    }

    const accessToken = signAuthToken({
      sub: superadmin.id,
      role: superadmin.role,
    });

    return {
      accessToken,
      tokenType: "Bearer",
      expiresInSeconds: env.AUTH_TOKEN_TTL_SECONDS,
      user: superadmin,
    };
  });

  app.post("/client/signup", async (request, reply) => {
    const body = clientSignupSchema.parse(request.body);
    const email = body.email.trim().toLowerCase();
    const nrc = body.nrc.trim().toUpperCase();

    // Check for existing email
    const existingEmail = await app.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingEmail) {
      throw app.httpErrors.conflict("An account with this email already exists.");
    }

    // Check for existing NRC
    const existingNrc = await app.prisma.user.findUnique({
      where: { nrc },
      select: { id: true, email: true },
    });

    if (existingNrc) {
      throw app.httpErrors.conflict(
        "An account with this NRC already exists. If this is your account, please sign in instead."
      );
    }

    const createdUser = await app.prisma.user.create({
      data: {
        email,
        passwordHash: await hashPassword(body.password),
        fullName: body.fullName.trim(),
        phoneNumber: body.phoneNumber.trim(),
        nrc,
        school: body.school.trim(),
        studentNumber: body.studentNumber.trim(),
        information: body.information?.trim() || "",
        profileCompleted: true, // All required fields provided during signup
        role: "educator",
        isActive: true,
      },
      select: authUserSelect,
    });

    await sendWelcomeEmail(createdUser.email, {
      userName: createdUser.fullName || "Educator",
      freeGenerations: 2,
    }).catch((err) => {
      app.log.error({ error: err }, "Failed to send welcome email");
    });

    const accessToken = signAuthToken({
      sub: createdUser.id,
      role: createdUser.role,
    });

    return reply.code(201).send({
      accessToken,
      tokenType: "Bearer",
      expiresInSeconds: env.AUTH_TOKEN_TTL_SECONDS,
      user: createdUser,
    });
  });

  app.post("/client/signin", async (request) => {
    const body = clientSigninSchema.parse(request.body);
    const email = body.email.trim().toLowerCase();

    const user = await app.prisma.user.findUnique({
      where: { email },
      select: {
        ...authUserSelect,
        passwordHash: true,
      },
    });

    if (!user) {
      throw app.httpErrors.unauthorized("Invalid email or password.");
    }

    const valid = await verifyPassword(body.password, user.passwordHash);
    if (!valid) {
      throw app.httpErrors.unauthorized("Invalid email or password.");
    }

    if (!user.isActive) {
      throw app.httpErrors.forbidden("Your account is inactive. Contact support.");
    }

    const accessToken = signAuthToken({
      sub: user.id,
      role: user.role,
    });

    const { passwordHash, ...safeUser } = user;

    return {
      accessToken,
      tokenType: "Bearer",
      expiresInSeconds: env.AUTH_TOKEN_TTL_SECONDS,
      user: safeUser,
    };
  });
};

export default authRoutes;
