import { FastifyPluginAsync } from "fastify";

const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/health", async () => {
    await app.prisma.$queryRaw`SELECT 1`;

    return {
      status: "ok",
      service: "edunurse-backend",
      timestamp: new Date().toISOString(),
    };
  });
};

export default healthRoutes;
