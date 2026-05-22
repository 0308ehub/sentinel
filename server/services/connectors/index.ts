import { prisma } from "@/lib/db/prisma";
import { processDocument } from "@/server/services/ingestion-service";
import type { GmailConfig, SlackConfig, LinearConfig, JiraConfig, IntercomConfig, ZendeskConfig, HubSpotConfig, ImportedDocument } from "./types";

export async function syncConnector(connectorId: string): Promise<{ imported: number; errors: string[] }> {
  const connector = await prisma.connector.findUniqueOrThrow({
    where: { id: connectorId },
    include: { workspace: { include: { organization: { include: { memberships: { take: 1 } } } } } },
  });

  const uploadedById = connector.workspace.organization.memberships[0]?.userId;
  if (!uploadedById) throw new Error("No workspace member found to attribute documents to");

  await prisma.connector.update({ where: { id: connectorId }, data: { status: "ACTIVE" } });

  const log = await prisma.connectorSyncLog.create({
    data: { connectorId, status: "RUNNING" },
  });

  let docs: ImportedDocument[] = [];
  const errors: string[] = [];

  try {
    docs = await fetchDocumentsFromConnector(connector);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await prisma.connectorSyncLog.update({
      where: { id: log.id },
      data: { status: "FAILED", error: msg, completedAt: new Date() },
    });
    await prisma.connector.update({
      where: { id: connectorId },
      data: { status: "ERROR", errorMessage: msg },
    });
    return { imported: 0, errors: [msg] };
  }

  // Deduplicate: skip docs already imported by externalId
  const existingIds = new Set(
    (
      await prisma.document.findMany({
        where: { connectorId, externalId: { in: docs.map((d) => d.externalId) } },
        select: { externalId: true },
      })
    ).map((d) => d.externalId)
  );

  const newDocs = docs.filter((d) => !existingIds.has(d.externalId));
  let imported = 0;

  for (const doc of newDocs) {
    try {
      const created = await prisma.document.create({
        data: {
          workspaceId: connector.workspaceId,
          uploadedById,
          connectorId,
          externalId: doc.externalId,
          title: doc.title,
          sourceType: doc.sourceType as never,
          rawText: doc.text,
          fileType: "txt",
          status: "PENDING",
          metadata: (doc.metadata ?? {}) as Record<string, string>,
        },
      });
      // Process async (fire and forget)
      processDocument(created.id).catch(console.error);
      imported++;
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  await prisma.connectorSyncLog.update({
    where: { id: log.id },
    data: { status: "COMPLETED", documentsImported: imported, completedAt: new Date() },
  });

  await prisma.connector.update({
    where: { id: connectorId },
    data: { status: "ACTIVE", lastSyncedAt: new Date(), errorMessage: null },
  });

  return { imported, errors };
}

async function fetchDocumentsFromConnector(connector: { type: string; config: unknown }): Promise<ImportedDocument[]> {
  const config = connector.config as Record<string, unknown>;

  switch (connector.type) {
    case "GMAIL": {
      const { syncGmail } = await import("./gmail");
      return syncGmail(config as unknown as GmailConfig);
    }
    case "SLACK": {
      const { syncSlack } = await import("./slack");
      return syncSlack(config as unknown as SlackConfig);
    }
    case "LINEAR": {
      const { syncLinear } = await import("./linear");
      return syncLinear(config as unknown as LinearConfig);
    }
    case "JIRA": {
      const { syncJira } = await import("./jira");
      return syncJira(config as unknown as JiraConfig);
    }
    case "INTERCOM": {
      const { syncIntercom } = await import("./intercom");
      return syncIntercom(config as unknown as IntercomConfig);
    }
    case "ZENDESK": {
      const { syncZendesk } = await import("./zendesk");
      return syncZendesk(config as unknown as ZendeskConfig);
    }
    case "HUBSPOT": {
      const { syncHubSpot } = await import("./hubspot");
      return syncHubSpot(config as unknown as HubSpotConfig);
    }
    default:
      throw new Error(`Unknown connector type: ${connector.type}`);
  }
}
