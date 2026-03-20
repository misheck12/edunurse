/**
 * User Profile Routes
 * Handles user profile management and settings
 */

import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  IDENTITY_DOCUMENT_ERROR_MESSAGE,
  isValidIdentityDocument,
  normalizeIdentityDocument,
} from "../services/identity-document.js";

const updateProfileSchema = z.object({
  fullName: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  phoneNumber: z.string().min(10).max(20).optional(),
  nrc: z
    .string()
    .trim()
    .refine(isValidIdentityDocument, IDENTITY_DOCUMENT_ERROR_MESSAGE)
    .optional(),
  school: z.string().max(200).optional(),
  studentNumber: z.string().max(50).optional(),
  information: z.string().max(1000).optional(),
  // Extended profile fields stored in preferences
  department: z.string().max(100).optional(),
  position: z.string().max(100).optional(),
  bio: z.string().max(500).optional(),
  avatar: z.string().url().optional().nullable(),
  location: z.object({
    country: z.string().max(100).optional(),
    city: z.string().max(100).optional(),
    timezone: z.string().max(50).optional(),
  }).optional(),
  socialLinks: z.object({
    linkedin: z.string().url().optional().nullable(),
    twitter: z.string().url().optional().nullable(),
    website: z.string().url().optional().nullable(),
    github: z.string().url().optional().nullable(),
  }).optional(),
  professionalInfo: z.object({
    yearsOfExperience: z.number().int().min(0).max(50).optional(),
    specializations: z.array(z.string()).optional(),
    qualifications: z.array(z.string()).optional(),
    teachingAreas: z.array(z.string()).optional(),
  }).optional(),
});

const updatePreferencesSchema = z.object({
  defaultProgramme: z.string().optional(),
  defaultYear: z.string().optional(),
  defaultDocumentType: z.string().optional(),
  language: z.string().max(10).default("en"),
  theme: z.enum(["light", "dark", "auto"]).default("light"),
  emailNotifications: z.object({
    marketing: z.boolean().default(true),
    productUpdates: z.boolean().default(true),
    weeklyDigest: z.boolean().default(false),
    paymentReminders: z.boolean().default(true),
    exportReady: z.boolean().default(true),
    lowCredits: z.boolean().default(true),
  }).optional(),
  exportDefaults: z.object({
    format: z.enum(["pdf", "docx", "pptx"]).optional(),
    includeReferences: z.boolean().default(true),
    includeCitations: z.boolean().default(true),
    pageSize: z.enum(["A4", "Letter"]).default("A4"),
    orientation: z.enum(["portrait", "landscape"]).default("portrait"),
  }).optional(),
  uiPreferences: z.object({
    compactMode: z.boolean().default(false),
    showTutorials: z.boolean().default(true),
    autoSave: z.boolean().default(true),
    autoSaveInterval: z.number().int().min(30).max(600).default(60),
  }).optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(8),
  newPassword: z.string().min(8).max(100),
  confirmPassword: z.string().min(8).max(100),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

const profileRoutes: FastifyPluginAsync = async (app) => {
  /**
   * GET /profile
   * Get current user's profile
   */
  app.get("/", async (request, reply) => {
    const userId = (request as any).user?.sub;
    if (!userId) {
      throw app.httpErrors.unauthorized("Authentication required");
    }

    const user = await app.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        phoneNumber: true,
        nrc: true,
        school: true,
        studentNumber: true,
        information: true,
        profileCompleted: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        preferences: true,
      },
    });

    if (!user) {
      throw app.httpErrors.notFound("User not found");
    }

    // Get additional profile data from preferences metadata
    const preferences = user.preferences;
    const metadata = (preferences?.uiPreferences as any) || {};
    const profileData = metadata.profile || {};

    return reply.code(200).send({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phoneNumber: user.phoneNumber,
        nrc: user.nrc,
        school: user.school,
        studentNumber: user.studentNumber,
        information: user.information,
        profileCompleted: user.profileCompleted,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        profile: {
          department: profileData.department || null,
          position: profileData.position || null,
          bio: profileData.bio || null,
          avatar: profileData.avatar || null,
          location: profileData.location || {
            country: null,
            city: null,
            timezone: null,
          },
          socialLinks: profileData.socialLinks || {
            linkedin: null,
            twitter: null,
            website: null,
            github: null,
          },
          professionalInfo: profileData.professionalInfo || {
            yearsOfExperience: null,
            specializations: [],
            qualifications: [],
            teachingAreas: [],
          },
        },
        preferences: {
          defaultProgramme: preferences?.defaultProgramme,
          defaultYear: preferences?.defaultYear,
          defaultDocumentType: preferences?.defaultDocumentType,
          language: metadata.language || "en",
          theme: metadata.theme || "light",
          emailNotifications: metadata.emailNotifications || {
            marketing: true,
            productUpdates: true,
            weeklyDigest: false,
            paymentReminders: true,
            exportReady: true,
            lowCredits: true,
          },
          exportDefaults: preferences?.exportDefaults || {},
          uiPreferences: metadata.uiPreferences || {},
        },
      },
    });
  });

  /**
   * PATCH /profile
   * Update user profile information
   */
  app.patch("/", async (request, reply) => {
    const userId = (request as any).user?.sub;
    if (!userId) {
      throw app.httpErrors.unauthorized("Authentication required");
    }

    const body = updateProfileSchema.parse(request.body);

    // Check if email is being changed and if it's already taken
    if (body.email) {
      const existingUser = await app.prisma.user.findFirst({
        where: {
          email: body.email,
          id: { not: userId },
        },
      });

      if (existingUser) {
        throw app.httpErrors.conflict("Email already in use");
      }
    }

    // Check if NRC is being changed and if it's already taken
    if (body.nrc) {
      const nrcUpper = normalizeIdentityDocument(body.nrc);
      const existingNrc = await app.prisma.user.findFirst({
        where: {
          nrc: nrcUpper,
          id: { not: userId },
        },
      });

      if (existingNrc) {
        throw app.httpErrors.conflict(
          "This NRC or passport number is already registered to another account",
        );
      }
    }

    // Get current preferences
    const currentUser = await app.prisma.user.findUnique({
      where: { id: userId },
      include: { preferences: true },
    });

    if (!currentUser) {
      throw app.httpErrors.notFound("User not found");
    }

    const currentMetadata = (currentUser.preferences?.uiPreferences as any) || {};
    const currentProfile = currentMetadata.profile || {};

    // Update user basic info (fields in User table)
    const updateData: any = {};
    if (body.fullName !== undefined) updateData.fullName = body.fullName;
    if (body.email !== undefined) updateData.email = body.email;
    if (body.phoneNumber !== undefined) updateData.phoneNumber = body.phoneNumber;
    if (body.nrc !== undefined) {
      updateData.nrc = normalizeIdentityDocument(body.nrc);
    }
    if (body.school !== undefined) updateData.school = body.school;
    if (body.studentNumber !== undefined) updateData.studentNumber = body.studentNumber;
    if (body.information !== undefined) updateData.information = body.information;

    // Check if profile is now complete
    const updatedUser = { ...currentUser, ...updateData };
    const isComplete = !!(
      updatedUser.fullName &&
      updatedUser.phoneNumber &&
      updatedUser.nrc &&
      updatedUser.school &&
      updatedUser.studentNumber
    );
    updateData.profileCompleted = isComplete;

    if (Object.keys(updateData).length > 0) {
      await app.prisma.user.update({
        where: { id: userId },
        data: updateData,
      });
    }

    // Update extended profile in preferences (nested under profile key)
    const updatedProfile = {
      ...currentProfile,
      department: body.department !== undefined ? body.department : currentProfile.department,
      position: body.position !== undefined ? body.position : currentProfile.position,
      bio: body.bio !== undefined ? body.bio : currentProfile.bio,
      avatar: body.avatar !== undefined ? body.avatar : currentProfile.avatar,
      location: body.location !== undefined 
        ? { ...currentProfile.location, ...body.location }
        : currentProfile.location,
      socialLinks: body.socialLinks !== undefined 
        ? { ...currentProfile.socialLinks, ...body.socialLinks }
        : currentProfile.socialLinks,
      professionalInfo: body.professionalInfo !== undefined
        ? { ...currentProfile.professionalInfo, ...body.professionalInfo }
        : currentProfile.professionalInfo,
    };

    const newMetadata = {
      ...currentMetadata,
      profile: updatedProfile,
    };

    await app.prisma.userPreference.upsert({
      where: { userId },
      create: {
        userId,
        uiPreferences: newMetadata,
      },
      update: {
        uiPreferences: newMetadata,
      },
    });

    return reply.code(200).send({
      success: true,
      message: "Profile updated successfully",
    });
  });

  /**
   * PATCH /profile/preferences
   * Update user preferences
   */
  app.patch("/preferences", async (request, reply) => {
    const userId = (request as any).user?.sub;
    if (!userId) {
      throw app.httpErrors.unauthorized("Authentication required");
    }

    const body = updatePreferencesSchema.parse(request.body);

    // Get current preferences
    const currentPrefs = await app.prisma.userPreference.findUnique({
      where: { userId },
    });

    const currentMetadata = (currentPrefs?.uiPreferences as any) || {};

    // Merge preferences
    const newMetadata = {
      ...currentMetadata,
      language: body.language !== undefined ? body.language : currentMetadata.language,
      theme: body.theme !== undefined ? body.theme : currentMetadata.theme,
      emailNotifications: body.emailNotifications !== undefined 
        ? { ...currentMetadata.emailNotifications, ...body.emailNotifications }
        : currentMetadata.emailNotifications,
      uiPreferences: body.uiPreferences !== undefined
        ? { ...currentMetadata.uiPreferences, ...body.uiPreferences }
        : currentMetadata.uiPreferences,
    };

    await app.prisma.userPreference.upsert({
      where: { userId },
      create: {
        userId,
        defaultProgramme: body.defaultProgramme,
        defaultYear: body.defaultYear,
        defaultDocumentType: body.defaultDocumentType,
        exportDefaults: body.exportDefaults || {},
        uiPreferences: newMetadata,
      },
      update: {
        defaultProgramme: body.defaultProgramme,
        defaultYear: body.defaultYear,
        defaultDocumentType: body.defaultDocumentType,
        exportDefaults: body.exportDefaults !== undefined 
          ? body.exportDefaults 
          : ((currentPrefs?.exportDefaults as any) ?? {}),
        uiPreferences: newMetadata,
      },
    });

    return reply.code(200).send({
      success: true,
      message: "Preferences updated successfully",
    });
  });

  /**
   * POST /profile/change-password
   * Change user password
   */
  app.post("/change-password", async (request, reply) => {
    const userId = (request as any).user?.sub;
    if (!userId) {
      throw app.httpErrors.unauthorized("Authentication required");
    }

    const body = changePasswordSchema.parse(request.body);

    // For now, we're using env-managed superadmin
    // In a real implementation, you'd verify currentPassword and hash newPassword
    
    // This is a placeholder - implement proper password hashing with bcrypt
    throw app.httpErrors.notImplemented(
      "Password change not yet implemented. Contact administrator."
    );
  });

  /**
   * POST /profile/avatar
   * Upload user avatar
   */
  app.post("/avatar", async (request, reply) => {
    const userId = (request as any).user?.sub;
    if (!userId) {
      throw app.httpErrors.unauthorized("Authentication required");
    }

    // This would handle file upload
    // For now, return not implemented
    throw app.httpErrors.notImplemented(
      "Avatar upload not yet implemented. Use Gravatar or external URL."
    );
  });

  /**
   * DELETE /profile/avatar
   * Remove user avatar
   */
  app.delete("/avatar", async (request, reply) => {
    const userId = (request as any).user?.sub;
    if (!userId) {
      throw app.httpErrors.unauthorized("Authentication required");
    }

    const currentPrefs = await app.prisma.userPreference.findUnique({
      where: { userId },
    });

    const currentMetadata = (currentPrefs?.uiPreferences as any) || {};
    delete currentMetadata.avatar;

    await app.prisma.userPreference.update({
      where: { userId },
      data: {
        uiPreferences: currentMetadata,
      },
    });

    return reply.code(200).send({
      success: true,
      message: "Avatar removed successfully",
    });
  });

  /**
   * GET /profile/activity
   * Get user activity summary
   */
  app.get("/activity", async (request, reply) => {
    const userId = (request as any).user?.sub;
    if (!userId) {
      throw app.httpErrors.unauthorized("Authentication required");
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalGenerations,
      totalExports,
      totalDocuments,
      recentGenerations,
      recentExports,
    ] = await Promise.all([
      app.prisma.generationRun.count({
        where: { userId, status: "succeeded" },
      }),
      app.prisma.exportJob.count({
        where: { userId, status: "succeeded" },
      }),
      app.prisma.document.count({
        where: { userId, deletedAt: null },
      }),
      app.prisma.generationRun.count({
        where: {
          userId,
          status: "succeeded",
          createdAt: { gte: thirtyDaysAgo },
        },
      }),
      app.prisma.exportJob.count({
        where: {
          userId,
          status: "succeeded",
          createdAt: { gte: thirtyDaysAgo },
        },
      }),
    ]);

    return reply.code(200).send({
      success: true,
      data: {
        allTime: {
          generations: totalGenerations,
          exports: totalExports,
          documents: totalDocuments,
        },
        last30Days: {
          generations: recentGenerations,
          exports: recentExports,
        },
      },
    });
  });

  /**
   * DELETE /profile
   * Delete user account (soft delete)
   */
  app.delete("/", async (request, reply) => {
    const userId = (request as any).user?.sub;
    if (!userId) {
      throw app.httpErrors.unauthorized("Authentication required");
    }

    const body = z
      .object({
        confirmation: z.literal("DELETE MY ACCOUNT"),
        reason: z.string().optional(),
      })
      .parse(request.body);

    // Soft delete by deactivating account
    await app.prisma.user.update({
      where: { id: userId },
      data: {
        isActive: false,
        updatedAt: new Date(),
      },
    });

    // Cancel any active subscriptions
    await app.prisma.subscription.updateMany({
      where: {
        userId,
        status: "active",
      },
      data: {
        cancelAtPeriodEnd: true,
      },
    });

    app.log.info(
      { userId, reason: body.reason },
      "User account deleted"
    );

    return reply.code(200).send({
      success: true,
      message: "Account deleted successfully",
    });
  });
};

export default profileRoutes;
