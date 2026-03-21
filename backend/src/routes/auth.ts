import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import crypto from "crypto";
import { env } from "../config.js";
import { hashPassword, verifyPassword } from "../services/auth-password.js";
import { signAuthToken } from "../services/auth-token.js";
import { sendWelcomeEmail } from "../services/email.js";
import {
  IDENTITY_DOCUMENT_ERROR_MESSAGE,
  isValidIdentityDocument,
  normalizeIdentityDocument,
} from "../services/identity-document.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const clientSignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(2),
  phoneNumber: z.string().min(8),
  nrc: z
    .string()
    .trim()
    .refine(isValidIdentityDocument, IDENTITY_DOCUMENT_ERROR_MESSAGE),
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
  app.post("/login", {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: "1 minute",
        errorResponseBuilder: () => ({
          statusCode: 429,
          error: "Too Many Requests",
          message: "Too many login attempts. Please try again in a minute.",
        }),
      },
    },
  }, async (request) => {
    const body = loginSchema.parse(request.body);

    const emailMatch =
      body.email.toLowerCase() === env.SUPERADMIN_EMAIL.toLowerCase();
    const passwordBuffer = Buffer.from(body.password);
    const expectedBuffer = Buffer.from(env.SUPERADMIN_PASSWORD);
    const passwordMatch =
      passwordBuffer.length === expectedBuffer.length &&
      crypto.timingSafeEqual(passwordBuffer, expectedBuffer);
    if (!emailMatch || !passwordMatch) {
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

  app.post("/client/signup", {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: "1 minute",
        errorResponseBuilder: () => ({
          statusCode: 429,
          error: "Too Many Requests",
          message: "Too many signup attempts. Please try again later.",
        }),
      },
    },
  }, async (request, reply) => {
    const body = clientSignupSchema.parse(request.body);
    const email = body.email.trim().toLowerCase();
    const nrc = normalizeIdentityDocument(body.nrc);

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
        "An account with this NRC or passport number already exists. If this is your account, please sign in instead."
      );
    }

    // Generate email verification token
    const verificationToken = crypto.randomUUID();
    const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

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
        role: "student",
        isActive: true,
        emailVerified: false,
        emailVerificationToken: verificationToken,
        emailVerificationExpiry: verificationExpiry,
      },
      select: authUserSelect,
    });

    // Send welcome email
    await sendWelcomeEmail(createdUser.email, {
      userName: createdUser.fullName || "Student",
      freeGenerations: 2,
    }).catch((err) => {
      app.log.error({ error: err }, "Failed to send welcome email");
    });

    // Send verification email
    const { sendEmailVerificationEmail } = await import("../services/email.js");
    await sendEmailVerificationEmail(
      createdUser.email,
      createdUser.fullName || "User",
      verificationToken
    ).catch((err) => {
      app.log.error({ error: err }, "Failed to send verification email");
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

  app.post("/client/signin", {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: "1 minute",
        errorResponseBuilder: () => ({
          statusCode: 429,
          error: "Too Many Requests",
          message: "Too many login attempts. Please try again in a minute.",
        }),
      },
    },
  }, async (request) => {
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

  // Request email verification
  app.post("/request-verification", async (request, reply) => {
    const { email } = z.object({ email: z.string().email() }).parse(request.body);

    const user = await app.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, email: true, fullName: true, emailVerified: true },
    });

    if (!user) {
      // Don't reveal if email exists
      return reply.code(200).send({ message: "If the email exists, a verification link has been sent." });
    }

    if (user.emailVerified) {
      return reply.code(400).send({ message: "Email is already verified." });
    }

    // Generate verification token
    const verificationToken = crypto.randomUUID();
    const expiryDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await app.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken: verificationToken,
        emailVerificationExpiry: expiryDate,
      },
    });

    // Send verification email
    const { sendEmailVerificationEmail } = await import("../services/email.js");
    await sendEmailVerificationEmail(
      user.email,
      user.fullName || "User",
      verificationToken
    );

    return reply.code(200).send({ message: "Verification email sent." });
  });

  // Verify email
  app.post("/verify-email", async (request, reply) => {
    const { token } = z.object({ token: z.string() }).parse(request.body);

    const user = await app.prisma.user.findUnique({
      where: { emailVerificationToken: token },
      select: {
        id: true,
        email: true,
        emailVerificationExpiry: true,
        emailVerified: true,
      },
    });

    if (!user) {
      throw app.httpErrors.badRequest("Invalid or expired verification token.");
    }

    if (user.emailVerified) {
      return reply.code(200).send({ message: "Email already verified." });
    }

    if (!user.emailVerificationExpiry || user.emailVerificationExpiry < new Date()) {
      throw app.httpErrors.badRequest("Verification token has expired. Request a new one.");
    }

    // Mark email as verified
    await app.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpiry: null,
      },
    });

    return reply.code(200).send({ message: "Email verified successfully!" });
  });

  // Request password reset
  app.post("/request-password-reset", async (request, reply) => {
    const { email } = z.object({ email: z.string().email() }).parse(request.body);

    const user = await app.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, email: true, fullName: true },
    });

    if (!user) {
      // Don't reveal if email exists
      return reply.code(200).send({ message: "If the email exists, a password reset link has been sent." });
    }

    // Generate reset token
    const resetToken = crypto.randomUUID();
    const expiryDate = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await app.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpiry: expiryDate,
      },
    });

    // Send password reset email
    const { sendPasswordResetEmail } = await import("../services/email.js");
    await sendPasswordResetEmail(
      user.email,
      user.fullName || "User",
      resetToken
    );

    return reply.code(200).send({ message: "Password reset email sent." });
  });

  // Reset password
  app.post("/reset-password", async (request, reply) => {
    const { token, newPassword } = z.object({
      token: z.string(),
      newPassword: z.string().min(8),
    }).parse(request.body);

    const user = await app.prisma.user.findUnique({
      where: { passwordResetToken: token },
      select: {
        id: true,
        email: true,
        passwordResetExpiry: true,
      },
    });

    if (!user) {
      throw app.httpErrors.badRequest("Invalid or expired reset token.");
    }

    if (!user.passwordResetExpiry || user.passwordResetExpiry < new Date()) {
      throw app.httpErrors.badRequest("Reset token has expired. Request a new one.");
    }

    // Hash new password
    const passwordHash = await hashPassword(newPassword);

    // Update password and clear reset token
    await app.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpiry: null,
      },
    });

    return reply.code(200).send({ message: "Password reset successfully!" });
  });
};

export default authRoutes;
