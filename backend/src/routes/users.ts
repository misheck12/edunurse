import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireUserId } from "../services/auth-helpers.js";
import {
  STUDIO_DOCUMENT_SERVICE_KEYS,
  listServiceControls,
  resolveStudioServiceKey,
} from "../services/service-controls.js";

const updatePreferencesSchema = z.object({
  defaultProgramme: z.string().min(1).nullable().optional(),
  defaultYear: z.string().min(1).nullable().optional(),
  defaultDocumentType: z.string().min(1).nullable().optional(),
  exportDefaults: z.record(z.any()).optional(),
  uiPreferences: z.record(z.any()).optional(),
});

const updateCurrentUserSchema = z.object({
  fullName: z.string().min(2).max(120).optional(),
  phoneNumber: z.string().min(7).max(30).optional(),
  school: z.string().min(2).max(240).optional(),
  studentNumber: z.string().min(2).max(120).optional(),
  information: z.string().min(2).max(4000).optional(),
});

const userRoutes: FastifyPluginAsync = async (app) => {
  app.get("/me", async (request) => {
    const userId = requireUserId(request);

    const user = await app.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        phoneNumber: true,
        school: true,
        studentNumber: true,
        information: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw app.httpErrors.notFound("User not found");
    }

    return user;
  });

  app.patch("/me", async (request) => {
    const userId = requireUserId(request);
    const body = updateCurrentUserSchema.parse(request.body);

    const existing = await app.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!existing) {
      throw app.httpErrors.notFound("User not found");
    }

    return app.prisma.user.update({
      where: { id: userId },
      data: {
        fullName: body.fullName,
        phoneNumber: body.phoneNumber,
        school: body.school,
        studentNumber: body.studentNumber,
        information: body.information,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        phoneNumber: true,
        school: true,
        studentNumber: true,
        information: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  });

  app.get("/preferences", async (request) => {
    const userId = requireUserId(request);

    const preferences = await app.prisma.userPreference.findUnique({
      where: { userId },
    });

    if (!preferences) {
      return {
        userId,
        defaultProgramme: null,
        defaultYear: null,
        defaultDocumentType: null,
        exportDefaults: {},
        uiPreferences: {},
      };
    }

    return preferences;
  });

  app.patch("/preferences", async (request) => {
    const userId = requireUserId(request);
    const body = updatePreferencesSchema.parse(request.body);

    return app.prisma.userPreference.upsert({
      where: { userId },
      update: {
        defaultProgramme: body.defaultProgramme,
        defaultYear: body.defaultYear,
        defaultDocumentType: body.defaultDocumentType,
        exportDefaults: body.exportDefaults,
        uiPreferences: body.uiPreferences,
      },
      create: {
        userId,
        defaultProgramme: body.defaultProgramme ?? null,
        defaultYear: body.defaultYear ?? null,
        defaultDocumentType: body.defaultDocumentType ?? null,
        exportDefaults: body.exportDefaults ?? {},
        uiPreferences: body.uiPreferences ?? {},
      },
    });
  });

  app.get("/studio-services", async (request) => {
    requireUserId(request);
    const items = await listServiceControls(app);
    const byKey = new Map(items.map((item) => [item.key, item]));

    const toPayload = (
      id: string,
      name: string,
      serviceKey: (typeof STUDIO_DOCUMENT_SERVICE_KEYS)[number],
    ) => {
      const state = byKey.get(serviceKey);
      return {
        id,
        name,
        serviceKey,
        enabled: state?.enabled ?? true,
        reason: state?.enabled ? null : state?.reason ?? null,
      };
    };

    return {
      items: [
        toPayload(
          "theory_lesson_plan",
          "Theory Lesson Plan",
          "studio_theory_lesson_plan",
        ),
        toPayload("skills_lab_plan", "Skills Lab Plan", "studio_skills_lab_plan"),
        toPayload(
          "clinical_teaching_plan",
          "Clinical Teaching Plan",
          "studio_clinical_teaching_plan",
        ),
        toPayload("osce_station", "OSCE Station", "studio_osce_station"),
        toPayload(
          "assessment_tool",
          "Assessment Tool",
          "studio_assessment_tool",
        ),
        toPayload("scheme_of_work", "Scheme of Work", "studio_scheme_of_work"),
      ],
      aliases: [
        {
          documentType: "Lesson Plan",
          serviceKey: resolveStudioServiceKey({ documentType: "Lesson Plan" }),
        },
        {
          documentType: "OSCE Station",
          serviceKey: resolveStudioServiceKey({ documentType: "OSCE Station" }),
        },
        {
          documentType: "Assessment Tool",
          serviceKey: resolveStudioServiceKey({ documentType: "Assessment Tool" }),
        },
        {
          documentType: "Scheme of Work",
          serviceKey: resolveStudioServiceKey({ documentType: "Scheme of Work" }),
        },
      ],
    };
  });
};

export default userRoutes;
