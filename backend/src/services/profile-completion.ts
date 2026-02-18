import { FastifyRequest, FastifyReply } from "fastify";
import { PrismaClient } from "@prisma/client";

/**
 * Check if user profile is complete
 */
export function isProfileComplete(user: {
  fullName: string | null;
  phoneNumber: string | null;
  nrc: string | null;
  school: string | null;
  studentNumber: string | null;
  profileCompleted: boolean;
}): boolean {
  return (
    user.profileCompleted &&
    !!user.fullName &&
    !!user.phoneNumber &&
    !!user.nrc &&
    !!user.school &&
    !!user.studentNumber
  );
}

/**
 * Middleware to enforce profile completion
 * Blocks access to protected routes if profile is incomplete
 */
export async function requireCompleteProfile(
  request: FastifyRequest,
  reply: FastifyReply,
  prisma: PrismaClient
) {
  const userId = (request as any).user?.sub;
  
  if (!userId) {
    throw reply.unauthorized("Authentication required");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      fullName: true,
      phoneNumber: true,
      nrc: true,
      school: true,
      studentNumber: true,
      profileCompleted: true,
      role: true,
    },
  });

  if (!user) {
    throw reply.unauthorized("User not found");
  }

  // Admins bypass profile completion check
  if (user.role === "admin") {
    return;
  }

  // Check if profile is complete
  if (!isProfileComplete(user)) {
    return reply.code(403).send({
      error: "ProfileIncomplete",
      message: "Please complete your profile before accessing this feature.",
      requiredFields: {
        fullName: !user.fullName,
        phoneNumber: !user.phoneNumber,
        nrc: !user.nrc,
        school: !user.school,
        studentNumber: !user.studentNumber,
      },
    });
  }
}

/**
 * Update profile completion status
 */
export async function updateProfileCompletionStatus(
  prisma: PrismaClient,
  userId: string
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      fullName: true,
      phoneNumber: true,
      nrc: true,
      school: true,
      studentNumber: true,
    },
  });

  if (!user) {
    return false;
  }

  const isComplete = isProfileComplete({ ...user, profileCompleted: true });

  await prisma.user.update({
    where: { id: userId },
    data: { profileCompleted: isComplete },
  });

  return isComplete;
}
