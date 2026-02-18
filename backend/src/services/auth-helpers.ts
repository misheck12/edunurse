import { FastifyInstance, FastifyRequest } from "fastify";

export function requireUserId(request: FastifyRequest): string {
  if (!request.currentUserId) {
    const error = new Error("Authentication required. Please sign in.") as Error & {
      statusCode: number;
    };
    error.statusCode = 401;
    throw error;
  }

  return request.currentUserId;
}

export async function requireAdminUser(
  app: FastifyInstance,
  request: FastifyRequest,
) {
  const userId = requireUserId(request);
  const user = await app.prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });

  if (!user || user.role !== "admin") {
    throw app.httpErrors.forbidden(
      "Superadmin permission required for this operation.",
    );
  }

  return user;
}
