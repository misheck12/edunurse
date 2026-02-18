import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import sensible from "@fastify/sensible";
import Fastify from "fastify";
import { env } from "./config.js";
import prismaPlugin from "./plugins/prisma.js";
import requestContextPlugin from "./plugins/request-context.js";
import { registerRoutes } from "./routes/index.js";

export function buildApp() {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
    },
  });

  void app.register(helmet, {
    contentSecurityPolicy: false,
  });

  const corsOrigins = env.CORS_ORIGIN
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const corsOriginConfig =
    corsOrigins.length === 0 || corsOrigins.includes("*")
      ? true
      : corsOrigins.length === 1
        ? corsOrigins[0]
        : corsOrigins;

  void app.register(cors, {
    origin: corsOriginConfig,
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });
  void app.register(sensible);
  void app.register(prismaPlugin);
  void app.register(requestContextPlugin);
  void app.register(registerRoutes, { prefix: "/api/v1" });

  return app;
}
