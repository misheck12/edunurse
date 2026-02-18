import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type CliOptions = {
  connectorIds: string[];
  includePaused: boolean;
  dryRun: boolean;
};

function safeRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function parseArgs(argv: string[]): CliOptions {
  const connectorIds: string[] = [];
  let includePaused = false;
  let dryRun = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--connector" || arg === "-c") {
      const value = argv[i + 1];
      if (!value) {
        throw new Error("Missing connector id after --connector");
      }
      connectorIds.push(value);
      i += 1;
      continue;
    }
    if (arg === "--include-paused") {
      includePaused = true;
      continue;
    }
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return {
    connectorIds,
    includePaused,
    dryRun,
  };
}

async function cleanupConnectorData(tx: Prisma.TransactionClient, connectorId: string) {
  const connector = await tx.connector.findUnique({
    where: { id: connectorId },
    select: {
      createdByUserId: true,
      configJson: true,
    },
  });
  if (!connector) {
    throw new Error(`Connector not found: ${connectorId}`);
  }

  const chunkStats = await tx.$queryRaw<
    Array<{ chunkCount: bigint; sourceCount: bigint; nodeCount: bigint }>
  >(Prisma.sql`
    SELECT
      COUNT(DISTINCT cc.id) AS "chunkCount",
      COUNT(DISTINCT cs.id) AS "sourceCount",
      (
        SELECT COUNT(*)
        FROM curriculum_hierarchy_nodes chn
        INNER JOIN curriculum_sources chs ON chs.id = chn.source_id
        WHERE chs.connector_id = CAST(${connectorId} AS uuid)
      ) AS "nodeCount"
    FROM curriculum_sources cs
    LEFT JOIN curriculum_chunks cc ON cc.source_id = cs.id
    WHERE cs.connector_id = CAST(${connectorId} AS uuid)
  `);

  await tx.$executeRaw(
    Prisma.sql`
      DELETE FROM section_citations sc
      USING curriculum_chunks cc, curriculum_sources cs
      WHERE sc.curriculum_chunk_id = cc.id
        AND cc.source_id = cs.id
        AND cs.connector_id = CAST(${connectorId} AS uuid)
    `,
  );

  await tx.$executeRaw(
    Prisma.sql`
      DELETE FROM generation_run_retrievals grr
      USING curriculum_chunks cc, curriculum_sources cs
      WHERE grr.curriculum_chunk_id = cc.id
        AND cc.source_id = cs.id
        AND cs.connector_id = CAST(${connectorId} AS uuid)
    `,
  );

  await tx.$executeRaw(
    Prisma.sql`
      DELETE FROM chunk_lineages cl
      USING curriculum_chunks cc, curriculum_sources cs
      WHERE cl.curriculum_chunk_id = cc.id
        AND cc.source_id = cs.id
        AND cs.connector_id = CAST(${connectorId} AS uuid)
    `,
  );

  await tx.$executeRaw(
    Prisma.sql`
      DELETE FROM curriculum_chunks cc
      USING curriculum_sources cs
      WHERE cc.source_id = cs.id
        AND cs.connector_id = CAST(${connectorId} AS uuid)
    `,
  );

  await tx.$executeRaw(
    Prisma.sql`
      DELETE FROM curriculum_hierarchy_nodes chn
      USING curriculum_sources cs
      WHERE chn.source_id = cs.id
        AND cs.connector_id = CAST(${connectorId} AS uuid)
    `,
  );

  await tx.$executeRaw(
    Prisma.sql`
      UPDATE external_document_versions edv
      SET metadata_json = COALESCE(edv.metadata_json, '{}'::jsonb) - 'parserVersion' - 'parserUpdatedAt'
      FROM external_documents ed
      WHERE edv.external_document_id = ed.id
        AND ed.connector_id = CAST(${connectorId} AS uuid)
    `,
  );

  await tx.curriculumSource.updateMany({
    where: { connectorId },
    data: {
      status: "parsed",
    },
  });

  const config = safeRecord(connector.configJson);
  const syncCursor = safeRecord(config.syncCursor);

  await tx.connector.update({
    where: { id: connectorId },
    data: {
      status: "active",
      lastSyncedAt: null,
      configJson: {
        ...config,
        syncCursor: {
          ...syncCursor,
          lastSyncAt: null,
          lastIngestionRunId: null,
          lastStatus: null,
        },
      } as Prisma.InputJsonValue,
    },
  });

  const run = await tx.connectorRun.create({
    data: {
      connectorId,
      initiatedByUserId: connector.createdByUserId,
      status: "queued",
    },
  });

  await tx.job.create({
    data: {
      jobType: "ingestion",
      status: "queued",
      payloadJson: {
        connectorRunId: run.id,
      } as Prisma.InputJsonValue,
    },
  });

  const stats = chunkStats[0] ?? {
    chunkCount: BigInt(0),
    sourceCount: BigInt(0),
    nodeCount: BigInt(0),
  };

  return {
    runId: run.id,
    chunkCount: Number(stats.chunkCount),
    sourceCount: Number(stats.sourceCount),
    nodeCount: Number(stats.nodeCount),
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  const connectors = await prisma.connector.findMany({
    where:
      options.connectorIds.length > 0
        ? {
            id: { in: options.connectorIds },
          }
        : options.includePaused
          ? {}
          : {
              status: { in: ["active", "error"] },
            },
    select: {
      id: true,
      name: true,
      status: true,
      createdByUserId: true,
    },
    orderBy: { createdAt: "asc" },
  });

  if (connectors.length === 0) {
    console.log("No connectors matched.");
    return;
  }

  console.log(`Matched connectors: ${connectors.length}`);
  for (const connector of connectors) {
    console.log(`- ${connector.id} | ${connector.name} | ${connector.status}`);
  }

  if (options.dryRun) {
    console.log("Dry run enabled. No data was modified.");
    return;
  }

  for (const connector of connectors) {
    const result = await prisma.$transaction((tx) =>
      cleanupConnectorData(tx, connector.id),
    );
    console.log(
      [
        `Reindex queued for connector ${connector.name} (${connector.id})`,
        `cleaned chunks=${result.chunkCount}`,
        `cleaned nodes=${result.nodeCount}`,
        `sources=${result.sourceCount}`,
        `runId=${result.runId}`,
      ].join(" | "),
    );
  }

  console.log(
    "Done. Start worker if not running: PowerShell -> `cd backend; npm run dev:worker`",
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
