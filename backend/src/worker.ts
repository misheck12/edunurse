import { writeFile } from "node:fs/promises";
import { prisma } from "./db.js";
import { env } from "./config.js";
import { computeChecksum, renderExportBuffer } from "./services/export-renderer.js";
import { runConnectorIngestion } from "./services/rag-ingestion.js";
import {
  buildExportStorageKey,
  ensureExportStorageDir,
  resolveExportFilePath,
} from "./services/export-storage.js";

let isShuttingDown = false;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseExportPayload(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Invalid export job payload");
  }
  const record = payload as Record<string, unknown>;
  if (typeof record.exportJobId !== "string") {
    throw new Error("Missing exportJobId in payload");
  }
  return {
    exportJobId: record.exportJobId,
  };
}

function parseIngestionPayload(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Invalid ingestion job payload");
  }
  const record = payload as Record<string, unknown>;
  if (typeof record.connectorRunId !== "string") {
    throw new Error("Missing connectorRunId in payload");
  }
  return {
    connectorRunId: record.connectorRunId,
  };
}

async function markJobFailed(
  jobId: string,
  exportJobId: string | null,
  connectorRunId: string | null,
  message: string,
) {
  await prisma.$transaction(async (tx) => {
    await tx.job.update({
      where: { id: jobId },
      data: {
        status: "failed",
        finishedAt: new Date(),
        errorMessage: message,
        lockedAt: null,
      },
    });

    if (exportJobId) {
      await tx.exportJob.update({
        where: { id: exportJobId },
        data: {
          status: "failed",
          completedAt: new Date(),
          errorMessage: message,
        },
      });
    }

    if (connectorRunId) {
      await tx.connectorRun.update({
        where: { id: connectorRunId },
        data: {
          status: "failed",
          finishedAt: new Date(),
          errorMessage: message,
        },
      });
    }
  });
}

async function processExportJob(jobId: string) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return;
  let exportJobId: string | null = null;

  try {
    const parsed = parseExportPayload(job.payloadJson);
    exportJobId = parsed.exportJobId;

    const exportJob = await prisma.exportJob.findUnique({
      where: { id: exportJobId },
      include: {
        document: true,
        documentVersion: true,
      },
    });

    if (!exportJob) {
      throw new Error(`Export job ${exportJobId} not found`);
    }

    if (
      !exportJob.documentVersion.contentJson ||
      typeof exportJob.documentVersion.contentJson !== "object" ||
      Array.isArray(exportJob.documentVersion.contentJson)
    ) {
      throw new Error("Document content is not a valid object");
    }

    await prisma.exportJob.update({
      where: { id: exportJob.id },
      data: {
        status: "running",
        errorMessage: null,
      },
    });

    const renderedBuffer = await renderExportBuffer(exportJob.format, {
      title: exportJob.document.title,
      programme: exportJob.document.programme,
      year: exportJob.document.year,
      topic: exportJob.document.topic,
      documentType: exportJob.document.documentType,
      contentJson: exportJob.documentVersion.contentJson as Record<string, unknown>,
    });

    const storageKey = buildExportStorageKey(exportJob.id, exportJob.format);
    const targetPath = resolveExportFilePath(storageKey);
    await writeFile(targetPath, renderedBuffer);
    const checksum = computeChecksum(renderedBuffer);

    await prisma.$transaction(async (tx) => {
      await tx.exportJob.update({
        where: { id: exportJob.id },
        data: {
          status: "succeeded",
          storageKey,
          checksum,
          completedAt: new Date(),
          signedUrlExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          errorMessage: null,
        },
      });

      await tx.job.update({
        where: { id: job.id },
        data: {
          status: "succeeded",
          finishedAt: new Date(),
          lockedAt: null,
          errorMessage: null,
        },
      });
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown export processing error";
    await markJobFailed(job.id, exportJobId, null, message);
  }
}

async function processIngestionJob(jobId: string) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return;

  let connectorRunId: string | null = null;

  try {
    const parsed = parseIngestionPayload(job.payloadJson);
    connectorRunId = parsed.connectorRunId;
    await runConnectorIngestion(prisma, connectorRunId);

    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: "succeeded",
        finishedAt: new Date(),
        lockedAt: null,
        errorMessage: null,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown ingestion processing error";
    await markJobFailed(job.id, null, connectorRunId, message);
  }
}

async function claimNextJob() {
  const queued = await prisma.job.findFirst({
    where: {
      status: "queued",
      runAt: {
        lte: new Date(),
      },
    },
    orderBy: [{ runAt: "asc" }, { createdAt: "asc" }],
  });

  if (!queued) return null;

  const claimed = await prisma.job.updateMany({
    where: {
      id: queued.id,
      status: "queued",
    },
    data: {
      status: "running",
      lockedAt: new Date(),
      attemptCount: {
        increment: 1,
      },
    },
  });

  if (claimed.count === 0) return null;
  return {
    id: queued.id,
    jobType: queued.jobType,
  };
}

async function start() {
  await ensureExportStorageDir();
  console.log("[worker] export worker started");

  while (!isShuttingDown) {
    try {
      const nextJob = await claimNextJob();
      if (!nextJob) {
        await sleep(env.EXPORT_WORKER_POLL_MS);
        continue;
      }

      if (nextJob.jobType === "export") {
        await processExportJob(nextJob.id);
      } else if (nextJob.jobType === "ingestion") {
        await processIngestionJob(nextJob.id);
      } else {
        await prisma.job.update({
          where: { id: nextJob.id },
          data: {
            status: "failed",
            finishedAt: new Date(),
            errorMessage: `Unsupported worker job type: ${nextJob.jobType}`,
            lockedAt: null,
          },
        });
      }
    } catch (error) {
      console.error("[worker] loop error", error);
      await sleep(env.EXPORT_WORKER_POLL_MS);
    }
  }
}

async function shutdown() {
  isShuttingDown = true;
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown();
});

process.on("SIGTERM", () => {
  void shutdown();
});

void start();
