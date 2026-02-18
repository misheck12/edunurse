import { Prisma } from "@prisma/client";
import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireAdminUser } from "../services/auth-helpers.js";
import {
  SERVICE_CONTROL_KEYS,
  listServiceControls,
  setServiceControl,
} from "../services/service-controls.js";

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

const overviewQuerySchema = z.object({
  days: z.coerce.number().int().positive().max(90).default(7),
});

const generationRunsQuerySchema = paginationSchema.extend({
  status: z.enum(["queued", "running", "succeeded", "failed", "blocked"]).optional(),
  runType: z
    .enum(["create", "regenerate_section", "expand", "simplify"])
    .optional(),
});

const exportJobsQuerySchema = paginationSchema.extend({
  status: z.enum(["queued", "running", "succeeded", "failed"]).optional(),
});

const activateVersionParamsSchema = z.object({
  versionId: z.string().uuid(),
});

const curriculumTopicsQuerySchema = paginationSchema.extend({
  curriculumVersionId: z.string().uuid().optional(),
  programme: z.string().trim().min(1).optional(),
  semester: z.string().trim().min(1).optional(),
  course: z.string().trim().min(1).optional(),
  search: z.string().trim().min(1).optional(),
});

const syllabusProgrammesQuerySchema = z.object({
  curriculumVersionId: z.string().uuid().optional(),
  search: z.string().trim().min(1).optional(),
});

const serviceControlKeySchema = z.enum(SERVICE_CONTROL_KEYS);

const updateServiceControlSchema = z.object({
  enabled: z.boolean(),
  reason: z.string().trim().max(500).nullable().optional(),
});

const academicTokenToNumber: Record<string, number> = {
  "1": 1,
  one: 1,
  first: 1,
  "2": 2,
  two: 2,
  second: 2,
  "3": 3,
  three: 3,
  third: 3,
  "4": 4,
  four: 4,
  fourth: 4,
  "5": 5,
  five: 5,
  fifth: 5,
  "6": 6,
  six: 6,
  sixth: 6,
};

const yearNumberToLabel: Record<number, string> = {
  1: "First Year",
  2: "Second Year",
  3: "Third Year",
  4: "Fourth Year",
  5: "Fifth Year",
  6: "Sixth Year",
};

function normalizeYearLabel(rawValue: string) {
  const raw = rawValue.trim();
  if (!raw) {
    return { label: "Unspecified Year", order: 999 };
  }

  const normalized = raw.toLowerCase();
  const yearMatch =
    normalized.match(/\byear\s+([a-z0-9]+)\b/) ||
    normalized.match(/\b([a-z0-9]+)\s+year\b/);

  if (yearMatch?.[1]) {
    const yearNum = academicTokenToNumber[yearMatch[1]];
    if (yearNum) {
      return {
        label: yearNumberToLabel[yearNum] ?? `Year ${yearNum}`,
        order: yearNum,
      };
    }
  }

  return { label: raw, order: 998 };
}

const adminOpsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/service-controls", async (request) => {
    await requireAdminUser(app, request);
    const items = await listServiceControls(app);
    return {
      items,
    };
  });

  app.patch("/service-controls/:serviceKey", async (request) => {
    const admin = await requireAdminUser(app, request);
    const params = z
      .object({ serviceKey: serviceControlKeySchema })
      .parse(request.params);
    const body = updateServiceControlSchema.parse(request.body);
    try {
      const updated = await setServiceControl(app, {
        key: params.serviceKey,
        enabled: body.enabled,
        reason: body.reason,
        updatedByUserId: admin.id,
      });

      return updated;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update service control.";
      if (message.toLowerCase().includes("service_controls")) {
        throw app.httpErrors.serviceUnavailable(
          "Service controls storage is not ready. Run backend migrations first.",
        );
      }
      throw error;
    }
  });

  app.get("/overview", async (request) => {
    await requireAdminUser(app, request);
    const query = overviewQuerySchema.parse(request.query);
    const since = new Date(Date.now() - query.days * 24 * 60 * 60 * 1000);
    const staleLockThreshold = new Date(Date.now() - 15 * 60 * 1000);

    const [
      generationTotal,
      generationQueued,
      generationRunning,
      generationSucceeded,
      generationFailed,
      generationBlocked,
      guardrailInfo,
      guardrailWarning,
      guardrailBlocking,
      blockedCoverageCount,
      exportQueued,
      exportRunning,
      exportSucceeded,
      exportFailed,
      queuedIngestionJobs,
      queuedEmbeddingJobs,
      queuedExportJobs,
      queuedGenerationJobs,
      runningIngestionJobs,
      runningEmbeddingJobs,
      runningExportJobs,
      runningGenerationJobs,
      staleRunningJobs,
      connectorsActive,
      connectorsPaused,
      connectorsError,
      activeCurriculumVersion,
      curriculumSourceCount,
      chunkCount,
    ] = await app.prisma.$transaction([
      app.prisma.generationRun.count({
        where: { createdAt: { gte: since } },
      }),
      app.prisma.generationRun.count({
        where: { createdAt: { gte: since }, status: "queued" },
      }),
      app.prisma.generationRun.count({
        where: { createdAt: { gte: since }, status: "running" },
      }),
      app.prisma.generationRun.count({
        where: { createdAt: { gte: since }, status: "succeeded" },
      }),
      app.prisma.generationRun.count({
        where: { createdAt: { gte: since }, status: "failed" },
      }),
      app.prisma.generationRun.count({
        where: { createdAt: { gte: since }, status: "blocked" },
      }),
      app.prisma.generationFlag.count({
        where: { createdAt: { gte: since }, severity: "info" },
      }),
      app.prisma.generationFlag.count({
        where: { createdAt: { gte: since }, severity: "warning" },
      }),
      app.prisma.generationFlag.count({
        where: { createdAt: { gte: since }, severity: "blocking" },
      }),
      app.prisma.generationFlag.count({
        where: {
          createdAt: { gte: since },
          flagType: "low_retrieval_coverage",
        },
      }),
      app.prisma.exportJob.count({
        where: { createdAt: { gte: since }, status: "queued" },
      }),
      app.prisma.exportJob.count({
        where: { createdAt: { gte: since }, status: "running" },
      }),
      app.prisma.exportJob.count({
        where: { createdAt: { gte: since }, status: "succeeded" },
      }),
      app.prisma.exportJob.count({
        where: { createdAt: { gte: since }, status: "failed" },
      }),
      app.prisma.job.count({
        where: { status: "queued", jobType: "ingestion" },
      }),
      app.prisma.job.count({
        where: { status: "queued", jobType: "embedding" },
      }),
      app.prisma.job.count({
        where: { status: "queued", jobType: "export" },
      }),
      app.prisma.job.count({
        where: { status: "queued", jobType: "generation" },
      }),
      app.prisma.job.count({
        where: { status: "running", jobType: "ingestion" },
      }),
      app.prisma.job.count({
        where: { status: "running", jobType: "embedding" },
      }),
      app.prisma.job.count({
        where: { status: "running", jobType: "export" },
      }),
      app.prisma.job.count({
        where: { status: "running", jobType: "generation" },
      }),
      app.prisma.job.count({
        where: {
          status: "running",
          lockedAt: {
            lt: staleLockThreshold,
          },
        },
      }),
      app.prisma.connector.count({
        where: { status: "active" },
      }),
      app.prisma.connector.count({
        where: { status: "paused" },
      }),
      app.prisma.connector.count({
        where: { status: "error" },
      }),
      app.prisma.curriculumVersion.findFirst({
        where: { isActive: true },
        select: {
          id: true,
          label: true,
          activatedAt: true,
        },
      }),
      app.prisma.curriculumSource.count(),
      app.prisma.curriculumChunk.count(),
    ]);

    return {
      timeWindowDays: query.days,
      generatedAt: new Date().toISOString(),
      generation: {
        total: generationTotal,
        byStatus: {
          queued: generationQueued,
          running: generationRunning,
          succeeded: generationSucceeded,
          failed: generationFailed,
          blocked: generationBlocked,
        },
      },
      guardrails: {
        bySeverity: {
          info: guardrailInfo,
          warning: guardrailWarning,
          blocking: guardrailBlocking,
        },
        lowCoverageBlocks: blockedCoverageCount,
      },
      exports: {
        byStatus: {
          queued: exportQueued,
          running: exportRunning,
          succeeded: exportSucceeded,
          failed: exportFailed,
        },
      },
      queue: {
        queuedByType: {
          ingestion: queuedIngestionJobs,
          embedding: queuedEmbeddingJobs,
          export: queuedExportJobs,
          generation: queuedGenerationJobs,
        },
        runningByType: {
          ingestion: runningIngestionJobs,
          embedding: runningEmbeddingJobs,
          export: runningExportJobs,
          generation: runningGenerationJobs,
        },
        staleRunningJobs,
      },
      connectors: {
        byStatus: {
          active: connectorsActive,
          paused: connectorsPaused,
          error: connectorsError,
        },
      },
      curriculum: {
        activeVersion: activeCurriculumVersion,
        sourceCount: curriculumSourceCount,
        chunkCount,
      },
    };
  });

  app.get("/generation/runs", async (request) => {
    await requireAdminUser(app, request);
    const query = generationRunsQuerySchema.parse(request.query);
    const skip = (query.page - 1) * query.pageSize;

    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.runType ? { runType: query.runType } : {}),
    };

    const [total, items] = await app.prisma.$transaction([
      app.prisma.generationRun.count({ where }),
      app.prisma.generationRun.findMany({
        where,
        include: {
          _count: {
            select: {
              flags: true,
              retrievals: true,
            },
          },
          flags: {
            orderBy: { createdAt: "desc" },
            take: 5,
          },
          document: {
            select: {
              id: true,
              title: true,
              documentType: true,
              programme: true,
              topic: true,
            },
          },
          user: {
            select: {
              id: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: query.pageSize,
      }),
    ]);

    return {
      page: query.page,
      pageSize: query.pageSize,
      total,
      items,
    };
  });

  app.get("/exports/jobs", async (request) => {
    await requireAdminUser(app, request);
    const query = exportJobsQuerySchema.parse(request.query);
    const skip = (query.page - 1) * query.pageSize;

    const where = {
      ...(query.status ? { status: query.status } : {}),
    };

    const [total, items] = await app.prisma.$transaction([
      app.prisma.exportJob.count({ where }),
      app.prisma.exportJob.findMany({
        where,
        include: {
          document: {
            select: {
              id: true,
              title: true,
              documentType: true,
            },
          },
          user: {
            select: {
              id: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: query.pageSize,
      }),
    ]);

    return {
      page: query.page,
      pageSize: query.pageSize,
      total,
      items,
    };
  });

  app.get("/curriculum/versions", async (request) => {
    await requireAdminUser(app, request);

    const versions = await app.prisma.curriculumVersion.findMany({
      include: {
        _count: {
          select: {
            chunks: true,
            sources: true,
            documents: true,
          },
        },
      },
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    });

    return {
      items: versions,
    };
  });

  app.post("/curriculum/versions/:versionId/activate", async (request) => {
    await requireAdminUser(app, request);
    const params = activateVersionParamsSchema.parse(request.params);

    const version = await app.prisma.$transaction(async (tx) => {
      await tx.curriculumVersion.updateMany({
        data: { isActive: false },
      });

      return tx.curriculumVersion.update({
        where: { id: params.versionId },
        data: {
          isActive: true,
          activatedAt: new Date(),
        },
        include: {
          _count: {
            select: {
              chunks: true,
              sources: true,
              documents: true,
            },
          },
        },
      });
    });

    return version;
  });

  app.get("/curriculum/topics", async (request) => {
    await requireAdminUser(app, request);
    const query = curriculumTopicsQuerySchema.parse(request.query);
    const skip = (query.page - 1) * query.pageSize;

    const versionId =
      query.curriculumVersionId ??
      (
        await app.prisma.curriculumVersion.findFirst({
          where: { isActive: true },
          select: { id: true },
        })
      )?.id;

    if (!versionId) {
      return {
        page: query.page,
        pageSize: query.pageSize,
        total: 0,
        curriculumVersionId: null,
        items: [],
      };
    }

    const topicExpr = Prisma.sql`COALESCE(
      NULLIF(BTRIM(cc.metadata_json ->> 'topic'), ''),
      NULLIF(BTRIM(cc.heading), ''),
      NULLIF(BTRIM(cc.metadata_json ->> 'courseTitle'), '')
    )`;
    const semesterExpr = Prisma.sql`COALESCE(
      NULLIF(BTRIM(cc.metadata_json ->> 'semester'), ''),
      NULLIF(BTRIM(cc.year_tag), '')
    )`;
    const courseExpr = Prisma.sql`COALESCE(
      NULLIF(BTRIM(cc.metadata_json ->> 'courseTitle'), ''),
      NULLIF(BTRIM(cc.heading), '')
    )`;
    const programmeExpr = Prisma.sql`COALESCE(
      NULLIF(BTRIM(cc.programme_tag), ''),
      NULLIF(BTRIM(cc.metadata_json ->> 'programme'), ''),
      NULLIF(BTRIM(cs.programme), '')
    )`;
    const subtopicExpr = Prisma.sql`NULLIF(BTRIM(cc.metadata_json ->> 'subtopic'), '')`;

    const filters: Prisma.Sql[] = [
      Prisma.sql`cc.curriculum_version_id = ${versionId}::uuid`,
      Prisma.sql`${topicExpr} IS NOT NULL`,
    ];

    if (query.programme) {
      filters.push(Prisma.sql`${programmeExpr} = ${query.programme}`);
    }
    if (query.semester) {
      filters.push(Prisma.sql`${semesterExpr} = ${query.semester}`);
    }
    if (query.course) {
      filters.push(Prisma.sql`${courseExpr} = ${query.course}`);
    }
    if (query.search) {
      filters.push(Prisma.sql`${topicExpr} ILIKE ${`%${query.search}%`}`);
    }

    const whereSql = Prisma.sql`WHERE ${Prisma.join(filters, " AND ")}`;

    const totalRows = await app.prisma.$queryRaw<Array<{ total: bigint | number }>>(
      Prisma.sql`
        SELECT COUNT(*)::bigint AS total
        FROM (
          SELECT ${topicExpr} AS topic
          FROM curriculum_chunks cc
          INNER JOIN curriculum_sources cs ON cs.id = cc.source_id
          ${whereSql}
          GROUP BY topic
        ) grouped_topics
      `,
    );

    const rows = await app.prisma.$queryRaw<
      Array<{
        topic: string;
        chunkCount: bigint | number;
        subtopicCount: bigint | number;
        semesterCount: bigint | number;
      }>
    >(
      Prisma.sql`
        SELECT
          ${topicExpr} AS topic,
          COUNT(*)::bigint AS "chunkCount",
          COUNT(DISTINCT ${subtopicExpr})::bigint AS "subtopicCount",
          COUNT(DISTINCT ${semesterExpr})::bigint AS "semesterCount"
        FROM curriculum_chunks cc
        INNER JOIN curriculum_sources cs ON cs.id = cc.source_id
        ${whereSql}
        GROUP BY topic
        ORDER BY "chunkCount" DESC, topic ASC
        LIMIT ${query.pageSize}
        OFFSET ${skip}
      `,
    );

    return {
      page: query.page,
      pageSize: query.pageSize,
      total: Number(totalRows[0]?.total ?? 0),
      curriculumVersionId: versionId,
      items: rows.map((row) => ({
        topic: row.topic,
        chunkCount: Number(row.chunkCount ?? 0),
        subtopicCount: Number(row.subtopicCount ?? 0),
        semesterCount: Number(row.semesterCount ?? 0),
      })),
    };
  });

  app.get("/syllabus/programmes", async (request) => {
    await requireAdminUser(app, request);
    const query = syllabusProgrammesQuerySchema.parse(request.query);

    const versionId =
      query.curriculumVersionId ??
      (
        await app.prisma.curriculumVersion.findFirst({
          where: { isActive: true },
          select: { id: true },
        })
      )?.id;

    if (!versionId) {
      return {
        curriculumVersionId: null,
        totalPrograms: 0,
        totalProgrammes: 0,
        items: [],
      };
    }

    const whereParts: Prisma.Sql[] = [
      Prisma.sql`cc.curriculum_version_id = ${versionId}::uuid`,
    ];

    if (query.search) {
      whereParts.push(
        Prisma.sql`(
          COALESCE(NULLIF(BTRIM(cc.programme_tag), ''), NULLIF(BTRIM(cs.programme), ''), 'Unclassified') ILIKE ${`%${query.search}%`}
          OR COALESCE(NULLIF(BTRIM(cc.metadata_json ->> 'programmeLevel'), ''), 'General') ILIKE ${`%${query.search}%`}
        )`,
      );
    }

    const whereSql = Prisma.sql`WHERE ${Prisma.join(whereParts, " AND ")}`;

    const rows = await app.prisma.$queryRaw<
      Array<{
        program: string;
        programme: string;
        chunkCount: bigint | number;
        sourceCount: bigint | number;
      }>
    >(
      Prisma.sql`
        SELECT
          COALESCE(
            NULLIF(BTRIM(cc.programme_tag), ''),
            NULLIF(BTRIM(cc.metadata_json ->> 'programme'), ''),
            NULLIF(BTRIM(cs.programme), ''),
            'Unclassified'
          ) AS "program",
          COALESCE(
            NULLIF(BTRIM(cc.metadata_json ->> 'programmeLevel'), ''),
            'General'
          ) AS "programme",
          COUNT(*)::bigint AS "chunkCount",
          COUNT(DISTINCT cs.id)::bigint AS "sourceCount"
        FROM curriculum_chunks cc
        INNER JOIN curriculum_sources cs ON cs.id = cc.source_id
        ${whereSql}
        GROUP BY 1, 2
        ORDER BY 1 ASC, 2 ASC
      `,
    );

    const yearRows = await app.prisma.$queryRaw<
      Array<{
        program: string;
        programme: string;
        yearRaw: string;
        chunkCount: bigint | number;
      }>
    >(
      Prisma.sql`
        SELECT
          COALESCE(
            NULLIF(BTRIM(cc.programme_tag), ''),
            NULLIF(BTRIM(cc.metadata_json ->> 'programme'), ''),
            NULLIF(BTRIM(cs.programme), ''),
            'Unclassified'
          ) AS "program",
          COALESCE(
            NULLIF(BTRIM(cc.metadata_json ->> 'programmeLevel'), ''),
            'General'
          ) AS "programme",
          COALESCE(
            NULLIF(BTRIM(cc.metadata_json ->> 'semester'), ''),
            NULLIF(BTRIM(cc.year_tag), ''),
            'Unspecified'
          ) AS "yearRaw",
          COUNT(*)::bigint AS "chunkCount"
        FROM curriculum_chunks cc
        INNER JOIN curriculum_sources cs ON cs.id = cc.source_id
        ${whereSql}
        GROUP BY 1, 2, 3
        ORDER BY 1 ASC, 2 ASC, 3 ASC
      `,
    );

    const groups = new Map<
      string,
      {
        program: string;
        totalChunks: number;
        totalSources: number;
        programmes: Array<{
          name: string;
          chunkCount: number;
          sourceCount: number;
          years: Array<{
            name: string;
            chunkCount: number;
            sortOrder: number;
          }>;
        }>;
      }
    >();

    for (const row of rows) {
      const program = row.program;
      const programmeItem = {
        name: row.programme,
        chunkCount: Number(row.chunkCount ?? 0),
        sourceCount: Number(row.sourceCount ?? 0),
        years: [] as Array<{
          name: string;
          chunkCount: number;
          sortOrder: number;
        }>,
      };

      const existing = groups.get(program);
      if (!existing) {
        groups.set(program, {
          program,
          totalChunks: programmeItem.chunkCount,
          totalSources: programmeItem.sourceCount,
          programmes: [programmeItem],
        });
      } else {
        existing.totalChunks += programmeItem.chunkCount;
        existing.totalSources += programmeItem.sourceCount;
        existing.programmes.push(programmeItem);
      }
    }

    const yearsByProgramme = new Map<
      string,
      Map<string, { name: string; chunkCount: number; sortOrder: number }>
    >();

    for (const row of yearRows) {
      const key = `${row.program}::${row.programme}`;
      const normalizedYear = normalizeYearLabel(row.yearRaw);
      const yearsMap = yearsByProgramme.get(key) ?? new Map();
      const existingYear = yearsMap.get(normalizedYear.label);
      if (existingYear) {
        existingYear.chunkCount += Number(row.chunkCount ?? 0);
      } else {
        yearsMap.set(normalizedYear.label, {
          name: normalizedYear.label,
          chunkCount: Number(row.chunkCount ?? 0),
          sortOrder: normalizedYear.order,
        });
      }
      yearsByProgramme.set(key, yearsMap);
    }

    const items = Array.from(groups.values()).map((group) => ({
      program: group.program,
      totalProgrammes: group.programmes.length,
      totalChunks: group.totalChunks,
      totalSources: group.totalSources,
      programmes: group.programmes
        .map((programme) => {
          const key = `${group.program}::${programme.name}`;
          const years = Array.from(yearsByProgramme.get(key)?.values() ?? []).sort(
            (a, b) =>
              a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
          );
          return {
            name: programme.name,
            chunkCount: programme.chunkCount,
            sourceCount: programme.sourceCount,
            years: years.map((year) => ({
              name: year.name,
              chunkCount: year.chunkCount,
            })),
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name)),
    }));

    return {
      curriculumVersionId: versionId,
      totalPrograms: items.length,
      totalProgrammes: items.reduce((sum, item) => sum + item.totalProgrammes, 0),
      items,
    };
  });
};

export default adminOpsRoutes;
