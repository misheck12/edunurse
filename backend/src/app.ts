import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import Fastify, { type FastifyError } from "fastify";
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

  // Global rate limiting - prevents brute-force and DoS
  void app.register(rateLimit, {
    global: true,
    max: 120,            // 120 requests per minute per IP (general)
    timeWindow: "1 minute",
    keyGenerator: (request) => request.ip,
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

  if (env.NODE_ENV === "production" && corsOriginConfig === true) {
    app.log.warn(
      "CORS is configured to allow all origins ('*'). Set CORS_ORIGIN to a specific domain in production."
    );
  }

  void app.register(cors, {
    origin: corsOriginConfig,
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });
  void app.register(sensible);
  void app.register(prismaPlugin);
  void app.register(requestContextPlugin);

  // Global error handler — shapes Zod validation errors and prevents stack-trace leaks in production
  app.setErrorHandler((error: FastifyError, _request, reply) => {
    // Zod validation errors → 400 with structured messages
    if (error.name === "ZodError" && "issues" in error) {
      const issues = (error as unknown as { issues: Array<{ path: (string | number)[]; message: string }> }).issues;
      const messages = issues.map(
        (i) => `${i.path.join(".") || "input"}: ${i.message}`,
      );
      return reply.status(400).send({
        statusCode: 400,
        error: "Validation Error",
        message: messages.join("; "),
      });
    }

    // Fastify httpErrors (thrown via app.httpErrors.*) already have statusCode
    const statusCode = error.statusCode ?? 500;
    if (statusCode >= 500) {
      app.log.error(error);
    }

    return reply.status(statusCode).send({
      statusCode,
      error: error.name ?? "InternalServerError",
      message:
        statusCode >= 500 && env.NODE_ENV === "production"
          ? "Internal Server Error"
          : error.message,
    });
  });

  void app.register(registerRoutes, { prefix: "/api/v1" });

  return app;
}
