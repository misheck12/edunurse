import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireAdminUser } from "../services/auth-helpers.js";
import {
  getAllSettings,
  setSetting,
  SETTING_DEFINITIONS,
} from "../services/system-settings.js";
import { hashPassword } from "../services/auth-password.js";
import { sendAdminPasswordResetNotification } from "../services/email.js";

const updateSettingsSchema = z.object({
  settings: z.record(z.string()),
});

const resetUserPasswordSchema = z.object({
  userId: z.string().uuid(),
  newPassword: z.string().min(8),
  sendNotification: z.boolean().default(true),
});

const testEmailSchema = z.object({
  toEmail: z.string().email(),
});

const adminSettingsRoutes: FastifyPluginAsync = async (app) => {
  // Get all system settings
  app.get("/settings", async (request) => {
    await requireAdminUser(app, request);
    
    const settings = await getAllSettings(app.prisma);
    
    // Group settings by category with definitions
    const categorized: Record<string, Array<{
      key: string;
      value: string;
      description: string;
      isSecret: boolean;
    }>> = {};

    for (const category in settings) {
      categorized[category] = settings[category];
    }

    return {
      categories: categorized,
      definitions: SETTING_DEFINITIONS,
    };
  });

  // Update system settings
  app.put("/settings", async (request, reply) => {
    await requireAdminUser(app, request);
    
    const body = updateSettingsSchema.parse(request.body);
    const userId = request.user?.sub;

    try {
      // Validate all keys exist in definitions
      for (const key in body.settings) {
        const definition = SETTING_DEFINITIONS.find((def) => def.key === key);
        if (!definition) {
          throw new Error(`Unknown setting key: ${key}`);
        }
      }

      // Update each setting
      for (const [key, value] of Object.entries(body.settings)) {
        await setSetting(app.prisma, key, value, userId);
      }

      return reply.code(200).send({ message: "Settings updated successfully" });
    } catch (error) {
      throw app.httpErrors.badRequest(
        error instanceof Error ? error.message : "Failed to update settings"
      );
    }
  });

  // Reset user password (admin only)
  app.post("/users/reset-password", async (request, reply) => {
    await requireAdminUser(app, request);
    
    const body = resetUserPasswordSchema.parse(request.body);

    const user = await app.prisma.user.findUnique({
      where: { id: body.userId },
      select: { id: true, email: true, fullName: true },
    });

    if (!user) {
      throw app.httpErrors.notFound("User not found");
    }

    const passwordHash = await hashPassword(body.newPassword);

    await app.prisma.user.update({
      where: { id: body.userId },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpiry: null,
      },
    });

    // Send notification email with the temporary password
    if (body.sendNotification) {
      try {
        await sendAdminPasswordResetNotification(
          user.email,
          user.fullName || "User",
          body.newPassword,
        );
        app.log.info({ userId: body.userId }, "Password reset notification email sent");
      } catch (emailErr) {
        app.log.warn({ userId: body.userId, error: emailErr }, "Password reset email failed — password was still changed");
      }
    }

    app.log.info({ userId: body.userId, adminId: request.user?.sub }, "Admin reset user password");

    return reply.code(200).send({ 
      message: `Password reset successfully for ${user.email}${body.sendNotification ? " (notification sent)" : ""}` 
    });
  });

  // Test email configuration (admin only)
  app.post("/test-email", async (request, reply) => {
    await requireAdminUser(app, request);
    
    const body = testEmailSchema.parse(request.body);
    const { sendWelcomeEmail } = await import("../services/email.js");

    try {
      await sendWelcomeEmail(body.toEmail, {
        userName: "Test User",
        freeGenerations: 2,
      });

      app.log.info({ toEmail: body.toEmail, adminId: request.user?.sub }, "Test email sent");

      return reply.code(200).send({ 
        message: `Test email sent successfully to ${body.toEmail}` 
      });
    } catch (error) {
      app.log.error({ error, toEmail: body.toEmail }, "Failed to send test email");
      throw app.httpErrors.internalServerError(
        `Failed to send test email: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  });
};

export default adminSettingsRoutes;
