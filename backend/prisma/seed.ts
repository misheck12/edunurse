import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const superadminId = "00000000-0000-4000-8000-000000000000";
  const defaultEducatorId = "00000000-0000-4000-8000-000000000001";

  const freePlan = await prisma.plan.upsert({
    where: { code: "free" },
    update: {
      name: "Free",
      monthlyPriceCents: 0,
      limitsJson: {
        monthlyGenerations: 2,
        monthlyExports: 6,
        features: [
          "lesson_generator",
          "drug_calculator",
          "flashcards",
          "resources",
          "export_pdf"
        ]
      },
    },
    create: {
      code: "free",
      name: "Free",
      monthlyPriceCents: 0,
      limitsJson: {
        monthlyGenerations: 2,
        monthlyExports: 6,
        features: [
          "lesson_generator",
          "drug_calculator",
          "flashcards",
          "resources",
          "export_pdf"
        ]
      },
    },
  });

  const proPlan = await prisma.plan.upsert({
    where: { code: "pro" },
    update: {
      name: "Pro",
      monthlyPriceCents: 9900,
      limitsJson: {
        monthlyGenerations: 100,
        monthlyExports: 300,
        features: [
          "lesson_generator",
          "drug_calculator",
          "flashcards",
          "resources",
          "export_pdf",
          "curriculum_ai",
          "assignments",
          "templates",
          "clinical_cases",
          "procedures",
          "medical_terms",
          "clinical_logbook",
          "nmc_exam_prep",
          "osce_practice",
          "career",
          "export_docx",
          "export_pptx"
        ]
      },
    },
    create: {
      code: "pro",
      name: "Pro",
      monthlyPriceCents: 2500,
      limitsJson: {
        monthlyGenerations: 100,
        monthlyExports: 300,
        features: [
          "lesson_generator",
          "drug_calculator",
          "flashcards",
          "resources",
          "export_pdf",
          "curriculum_ai",
          "assignments",
          "templates",
          "clinical_cases",
          "procedures",
          "medical_terms",
          "clinical_logbook",
          "nmc_exam_prep",
          "osce_practice",
          "career",
          "export_docx",
          "export_pptx"
        ]
      },
    },
  });

  const upsertUserByEmail = async (input: {
    email: string;
    fullName: string;
    role: "educator" | "admin";
    isActive: boolean;
    preferredId?: string;
  }) => {
    const email = input.email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existing) {
      return prisma.user.update({
        where: { id: existing.id },
        data: {
          fullName: input.fullName,
          role: input.role,
          isActive: input.isActive,
        },
      });
    }

    return prisma.user.create({
      data: {
        id: input.preferredId,
        email,
        passwordHash: "dev_only_replace_me",
        fullName: input.fullName,
        role: input.role,
        isActive: input.isActive,
      },
    });
  };

  const defaultDevEducator = await prisma.user.upsert({
    where: { id: defaultEducatorId },
    update: {
      email: "dev.educator@edunurse.local",
      fullName: "Default Dev Educator",
      role: "educator",
      isActive: true,
    },
    create: {
      id: defaultEducatorId,
      email: "dev.educator@edunurse.local",
      passwordHash: "dev_only_replace_me",
      fullName: "Default Dev Educator",
      role: "educator",
      isActive: true,
    },
  });

  const demoEducator = await upsertUserByEmail({
    email: "educator@edunurse.local",
    fullName: "Demo Educator",
    role: "educator",
    isActive: true,
  });

  const educator2 = await upsertUserByEmail({
    email: "midwife.tutor@edunurse.local",
    fullName: "Midwife Tutor",
    role: "educator",
    isActive: true,
    preferredId: "00000000-0000-4000-8000-000000000002",
  });

  const educator3 = await upsertUserByEmail({
    email: "clinical.instructor@edunurse.local",
    fullName: "Clinical Instructor",
    role: "educator",
    isActive: false,
    preferredId: "00000000-0000-4000-8000-000000000003",
  });

  const opsAdmin = await upsertUserByEmail({
    email: "ops.admin@edunurse.local",
    fullName: "Ops Admin",
    role: "admin",
    isActive: true,
    preferredId: "00000000-0000-4000-8000-000000000010",
  });

  const seededUsers = [defaultDevEducator, demoEducator, educator2, educator3, opsAdmin];
  const educator = defaultDevEducator;

  const superadmin = await prisma.user.upsert({
    where: { id: superadminId },
    update: {
      role: "admin",
      email: "superadmin@edunurse.local",
    },
    create: {
      id: superadminId,
      email: "superadmin@edunurse.local",
      passwordHash: "dev_only_replace_me",
      fullName: "EduNurse Superadmin",
      role: "admin",
    },
  });

  const activeSubscription = await prisma.subscription.upsert({
    where: { providerSubscriptionId: `dev-sub-${educator.id}` },
    update: {
      status: "active",
    },
    create: {
      userId: educator.id,
      planId: freePlan.id,
      provider: "development",
      providerSubscriptionId: `dev-sub-${educator.id}`,
      status: "active",
    },
  });

  await prisma.subscription.upsert({
    where: { providerSubscriptionId: `dev-sub-${demoEducator.id}` },
    update: {
      status: "active",
      planId: freePlan.id,
    },
    create: {
      userId: demoEducator.id,
      planId: freePlan.id,
      provider: "development",
      providerSubscriptionId: `dev-sub-${demoEducator.id}`,
      status: "active",
    },
  });

  const proSubscription = await prisma.subscription.upsert({
    where: { providerSubscriptionId: `dev-sub-${educator2.id}` },
    update: {
      status: "active",
      planId: proPlan.id,
    },
    create: {
      userId: educator2.id,
      planId: proPlan.id,
      provider: "development",
      providerSubscriptionId: `dev-sub-${educator2.id}`,
      status: "active",
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    },
  });

  await prisma.subscription.upsert({
    where: { providerSubscriptionId: `dev-sub-${educator3.id}` },
    update: {
      status: "past_due",
      planId: freePlan.id,
      cancelAtPeriodEnd: true,
    },
    create: {
      userId: educator3.id,
      planId: freePlan.id,
      provider: "development",
      providerSubscriptionId: `dev-sub-${educator3.id}`,
      status: "past_due",
      cancelAtPeriodEnd: true,
    },
  });

  await prisma.transaction.upsert({
    where: { externalTransactionId: `dev-tx-${educator.id}-001` },
    update: {
      status: "succeeded",
      amountCents: 0,
      transactionType: "adjustment",
      processedAt: new Date(),
      metadataJson: {
        note: "Seeded free-plan onboarding adjustment",
      },
    },
    create: {
      userId: educator.id,
      subscriptionId: activeSubscription.id,
      provider: "development",
      externalTransactionId: `dev-tx-${educator.id}-001`,
      transactionType: "adjustment",
      status: "succeeded",
      amountCents: 0,
      currency: "USD",
      metadataJson: {
        note: "Seeded free-plan onboarding adjustment",
      },
      processedAt: new Date(),
    },
  });

  await prisma.transaction.upsert({
    where: { externalTransactionId: `dev-tx-${demoEducator.id}-001` },
    update: {
      status: "succeeded",
      amountCents: 0,
      transactionType: "adjustment",
      processedAt: new Date(),
      metadataJson: {
        note: "Seeded free-plan onboarding adjustment for demo educator",
      },
    },
    create: {
      userId: demoEducator.id,
      provider: "development",
      externalTransactionId: `dev-tx-${demoEducator.id}-001`,
      transactionType: "adjustment",
      status: "succeeded",
      amountCents: 0,
      currency: "USD",
      metadataJson: {
        note: "Seeded free-plan onboarding adjustment for demo educator",
      },
      processedAt: new Date(),
    },
  });

  await prisma.transaction.upsert({
    where: { externalTransactionId: `dev-tx-${educator2.id}-001` },
    update: {
      status: "succeeded",
      amountCents: 2500,
      transactionType: "charge",
      currency: "USD",
      processedAt: new Date(),
      metadataJson: {
        note: "Seeded pro monthly charge",
      },
    },
    create: {
      userId: educator2.id,
      subscriptionId: proSubscription.id,
      provider: "development",
      externalTransactionId: `dev-tx-${educator2.id}-001`,
      transactionType: "charge",
      status: "succeeded",
      amountCents: 2500,
      currency: "USD",
      metadataJson: {
        note: "Seeded pro monthly charge",
      },
      processedAt: new Date(),
    },
  });

  await prisma.transaction.upsert({
    where: { externalTransactionId: `dev-tx-${educator3.id}-001` },
    update: {
      status: "failed",
      amountCents: 0,
      transactionType: "charge",
      currency: "USD",
      errorMessage: "Card authorization failed",
      metadataJson: {
        note: "Seeded failed renewal",
      },
    },
    create: {
      userId: educator3.id,
      provider: "development",
      externalTransactionId: `dev-tx-${educator3.id}-001`,
      transactionType: "charge",
      status: "failed",
      amountCents: 0,
      currency: "USD",
      errorMessage: "Card authorization failed",
      metadataJson: {
        note: "Seeded failed renewal",
      },
    },
  });

  await prisma.userPreference.upsert({
    where: { userId: educator.id },
    update: {
      defaultProgramme: "Nursing",
      defaultYear: "Year 2",
      defaultDocumentType: "Lesson Plan",
      exportDefaults: { includeDisclaimers: true },
      uiPreferences: { compactMode: false },
    },
    create: {
      userId: educator.id,
      defaultProgramme: "Nursing",
      defaultYear: "Year 2",
      defaultDocumentType: "Lesson Plan",
      exportDefaults: { includeDisclaimers: true },
      uiPreferences: { compactMode: false },
    },
  });

  await prisma.userPreference.upsert({
    where: { userId: demoEducator.id },
    update: {
      defaultProgramme: "Nursing",
      defaultYear: "Year 2",
      defaultDocumentType: "Lesson Plan",
      exportDefaults: { includeDisclaimers: true },
      uiPreferences: {
        institutionName: "Teaching Hospital Demo Campus",
        lessonPlanFormat: "Standard (NMC Aligned)",
        defaultDurationMinutes: 60,
      },
    },
    create: {
      userId: demoEducator.id,
      defaultProgramme: "Nursing",
      defaultYear: "Year 2",
      defaultDocumentType: "Lesson Plan",
      exportDefaults: { includeDisclaimers: true },
      uiPreferences: {
        institutionName: "Teaching Hospital Demo Campus",
        lessonPlanFormat: "Standard (NMC Aligned)",
        defaultDurationMinutes: 60,
      },
    },
  });

  await prisma.userPreference.upsert({
    where: { userId: educator2.id },
    update: {
      defaultProgramme: "Midwifery",
      defaultYear: "Year 3",
      defaultDocumentType: "OSCE Station",
      exportDefaults: { includeDisclaimers: true },
      uiPreferences: {
        institutionName: "Lusaka Midwifery College",
        lessonPlanFormat: "5E Model",
        defaultDurationMinutes: 90,
      },
    },
    create: {
      userId: educator2.id,
      defaultProgramme: "Midwifery",
      defaultYear: "Year 3",
      defaultDocumentType: "OSCE Station",
      exportDefaults: { includeDisclaimers: true },
      uiPreferences: {
        institutionName: "Lusaka Midwifery College",
        lessonPlanFormat: "5E Model",
        defaultDurationMinutes: 90,
      },
    },
  });

  await prisma.userPreference.upsert({
    where: { userId: educator3.id },
    update: {
      defaultProgramme: "Nursing",
      defaultYear: "Year 1",
      defaultDocumentType: "Clinical Plan",
      exportDefaults: { includeDisclaimers: false },
      uiPreferences: {
        institutionName: "Kitwe School of Nursing",
        lessonPlanFormat: "Standard (NMC Aligned)",
        defaultDurationMinutes: 45,
      },
    },
    create: {
      userId: educator3.id,
      defaultProgramme: "Nursing",
      defaultYear: "Year 1",
      defaultDocumentType: "Clinical Plan",
      exportDefaults: { includeDisclaimers: false },
      uiPreferences: {
        institutionName: "Kitwe School of Nursing",
        lessonPlanFormat: "Standard (NMC Aligned)",
        defaultDurationMinutes: 45,
      },
    },
  });

  const builtinTemplates = [
    {
      id: "a4de0993-c98e-4cf9-99f0-b4888562f8cb",
      name: "Built-in Lesson Plan",
      documentType: "lesson_plan" as const,
      templateJson: {
        description:
          "Curriculum-aligned lesson plan with objectives, presentation flow, and evaluation.",
        sections: [
          { key: "overview", title: "Overview", type: "text" },
          { key: "outcomes", title: "Learning Outcomes", type: "list" },
          { key: "lesson_presentation", title: "Lesson Presentation", type: "table" },
          { key: "evaluation", title: "Evaluation", type: "list" },
          { key: "references", title: "References", type: "list" },
        ],
      },
    },
    {
      id: "9f9a1c84-1337-4e6a-8dfd-ff5d2f778001",
      name: "Built-in Clinical Teaching Plan",
      documentType: "clinical_plan" as const,
      templateJson: {
        description:
          "Ward-focused teaching template with competency targets and reflection prompts.",
        sections: [
          { key: "ward_objective", title: "Ward Objective", type: "text" },
          { key: "competency_targets", title: "Competency Targets", type: "list" },
          { key: "teaching_flow", title: "Teaching Flow", type: "table" },
          { key: "reflection", title: "Reflection Prompts", type: "list" },
        ],
      },
    },
    {
      id: "9f9a1c84-1337-4e6a-8dfd-ff5d2f778002",
      name: "Built-in OSCE Station",
      documentType: "osce_station" as const,
      templateJson: {
        description:
          "Standard OSCE station template with scenario, checklist, and scoring.",
        sections: [
          { key: "objective", title: "Objective", type: "text" },
          { key: "scenario", title: "Scenario", type: "text" },
          { key: "candidate_instructions", title: "Candidate Instructions", type: "list" },
          { key: "examiner_checklist", title: "Examiner Checklist", type: "table" },
        ],
      },
    },
    {
      id: "9f9a1c84-1337-4e6a-8dfd-ff5d2f778003",
      name: "Built-in Assessment Tool",
      documentType: "assessment_tool" as const,
      templateJson: {
        description:
          "Assessment template for MCQs, SAQs, case questions, and marking guidance.",
        sections: [
          { key: "assessment_scope", title: "Assessment Scope", type: "text" },
          { key: "questions", title: "Questions", type: "table" },
          { key: "marking_guide", title: "Marking Guide", type: "table" },
        ],
      },
    },
    {
      id: "9f9a1c84-1337-4e6a-8dfd-ff5d2f778004",
      name: "Built-in Scheme of Work",
      documentType: "scheme_of_work" as const,
      templateJson: {
        description:
          "Semester planning template with weekly schedule and assessment mapping.",
        sections: [
          { key: "overview", title: "Semester Overview", type: "text" },
          { key: "weekly_plan", title: "Weekly Plan", type: "table" },
          { key: "assessment_schedule", title: "Assessment Schedule", type: "table" },
        ],
      },
    },
  ];

  for (const template of builtinTemplates) {
    await prisma.template.upsert({
      where: { id: template.id },
      update: {
        name: template.name,
        documentType: template.documentType,
        templateSchemaVersion: 1,
        templateJson: template.templateJson,
        isBuiltin: true,
        isActive: true,
      },
      create: {
        id: template.id,
        name: template.name,
        documentType: template.documentType,
        templateSchemaVersion: 1,
        templateJson: template.templateJson,
        isBuiltin: true,
        isActive: true,
      },
    });
  }

  await prisma.promptVersion.upsert({
    where: {
      name_documentType: {
        name: "lesson_plan_v1",
        documentType: "lesson_plan",
      },
    },
    update: {
      isActive: true,
    },
    create: {
      name: "lesson_plan_v1",
      documentType: "lesson_plan",
      systemPrompt:
        "Generate curriculum-grounded nursing and midwifery educator documents with explicit citation traces.",
      developerPrompt:
        "If curriculum support is missing, return insufficiency signal rather than inventing unsupported clinical guidance.",
      schemaJson: {
        type: "object",
        required: ["metadata", "sections"],
      },
      isActive: true,
    },
  });

  const defaultCurriculumVersion = await prisma.curriculumVersion.upsert({
    where: { label: "dev-default-2026" },
    update: {
      description: "Default development curriculum version",
      isActive: true,
      activatedAt: new Date(),
    },
    create: {
      label: "dev-default-2026",
      description: "Default development curriculum version",
      isActive: true,
      activatedAt: new Date(),
    },
  });

  await prisma.curriculumVersion.updateMany({
    where: {
      id: {
        not: defaultCurriculumVersion.id,
      },
    },
    data: {
      isActive: false,
    },
  });

  console.log("Seed complete");
  console.log(`Use x-user-id header: ${educator.id}`);
  console.log(`Default frontend dev user ID: ${defaultDevEducator.id}`);
  console.log(`Use superadmin x-user-id header: ${superadmin.id}`);
  console.log("Seeded users:");
  for (const user of seededUsers) {
    console.log(`- ${user.role}: ${user.email} (${user.id})`);
  }
  console.log(`Active curriculum version: ${defaultCurriculumVersion.label} (${defaultCurriculumVersion.id})`);
}

void main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
