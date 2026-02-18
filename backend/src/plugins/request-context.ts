import fp from "fastify-plugin";
import { FastifyPluginAsync } from "fastify";
import { verifyAuthToken } from "../services/auth-token.js";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const requestContextPlugin: FastifyPluginAsync = async (app) => {
  app.decorateRequest("currentUserId", null);
  app.decorateRequest("user", null);

  app.addHook("onRequest", async (request) => {
    const authorization = request.headers.authorization;
    if (typeof authorization === "string" && authorization.length > 0) {
      const [scheme, token] = authorization.split(" ");
      if (scheme?.toLowerCase() !== "bearer" || !token) {
        throw app.httpErrors.unauthorized(
          "Invalid authorization header format.",
        );
      }

      const payload = verifyAuthToken(token);
      if (!payload) {
        throw app.httpErrors.unauthorized("Invalid or expired auth token.");
      }

      request.currentUserId = payload.sub;
      request.user = {
        sub: payload.sub,
        role: payload.role,
      };
      return;
    }

    const headerValue = request.headers["x-user-id"];
    if (typeof headerValue === "string" && UUID_REGEX.test(headerValue)) {
      request.currentUserId = headerValue;
      request.user = {
        sub: headerValue,
        role: "educator",
      };

      // Development fallback for non-authenticated local workflows.
      await app.prisma.user.upsert({
        where: { id: headerValue },
        update: {},
        create: {
          id: headerValue,
          email: `${headerValue}@dev.edunurse.local`,
          passwordHash: "dev_only_replace_me",
          fullName: "Development User",
          role: "educator",
        },
      });
    }
  });
};

export default fp(requestContextPlugin, {
  name: "request-context",
});
