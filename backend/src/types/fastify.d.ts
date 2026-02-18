import { PrismaClient } from "@prisma/client";

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
  }

  interface FastifyRequest {
    currentUserId: string | null;
    user: {
      sub: string;
      role: "admin" | "educator";
    } | null;
  }
}

export {};
