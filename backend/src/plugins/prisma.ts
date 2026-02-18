import fp from "fastify-plugin";
import { FastifyPluginAsync } from "fastify";
import { prisma } from "../db.js";

const prismaPlugin: FastifyPluginAsync = async (app) => {
  app.decorate("prisma", prisma);

  app.addHook("onClose", async () => {
    await prisma.$disconnect();
  });
};

export default fp(prismaPlugin, {
  name: "prisma",
});
