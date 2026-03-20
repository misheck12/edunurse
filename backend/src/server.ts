import { buildApp } from "./app.js";
import { env } from "./config.js";
import { initializeSettings } from "./services/system-settings.js";
import { setEmailPrismaClient } from "./services/email.js";
import { setNotificationPrismaClient } from "./services/notifications.js";

async function start() {
  const app = buildApp();

  try {
    // Wait for app to be ready (plugins registered)
    await app.ready();

    // Initialize system settings
    await initializeSettings(app.prisma);
    app.log.info("System settings initialized");

    // Set Prisma client for email service
    setEmailPrismaClient(app.prisma);
    app.log.info("Email service configured");

    // Set Prisma client for notification service
    setNotificationPrismaClient(app.prisma);
    app.log.info("Notification service configured");

    await app.listen({ host: env.HOST, port: env.PORT });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

void start();
