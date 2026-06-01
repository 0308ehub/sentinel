import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess, unauthorizedResponse, notFoundResponse } from "@/lib/auth/helpers";
import { apiSuccess, apiError } from "@/types";
import type { GmailConfig } from "@/server/services/connectors/types";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string; connectorId: string }> }
) {
  const { workspaceId, connectorId } = await params;
  try { await requireWorkspaceAccess(workspaceId); } catch { return unauthorizedResponse(); }

  const connector = await prisma.connector.findFirst({ where: { id: connectorId, workspaceId } });
  if (!connector) return notFoundResponse("Connector");

  const body = await req.json();
  const externalIds: string[] = body.externalIds ?? [];
  if (!externalIds.length) return Response.json(apiError("EMPTY", "No items selected"), { status: 400 });

  try {
    if (connector.type === "GMAIL") {
      const { syncGmailById } = await import("@/server/services/connectors/gmail");
      const { dispatchIngestion } = await import("@/server/jobs/dispatch");
      const config = connector.config as unknown as GmailConfig;

      // Skip already-imported
      const existing = await prisma.document.findMany({
        where: { workspaceId, connectorId, externalId: { in: externalIds } },
        select: { externalId: true },
      });
      const alreadyDone = new Set(existing.map((d) => d.externalId));
      const toImport = externalIds.filter((id) => !alreadyDone.has(id));

      const docs = await syncGmailById(config, toImport);
      let imported = 0;

      for (const doc of docs) {
        const created = await prisma.document.create({
          data: {
            workspaceId,
            uploadedById: connector.id, // connector as uploader placeholder
            title: doc.title,
            sourceType: "EMAIL",
            fileType: "txt",
            rawText: doc.text,
            externalId: doc.externalId,
            connectorId,
            status: "PENDING",
            metadata: doc.metadata as never,
          },
        });
        await dispatchIngestion(created.id);
        imported++;
      }

      await prisma.connector.update({ where: { id: connectorId }, data: { lastSyncedAt: new Date() } });
      await prisma.connectorSyncLog.create({
        data: { connectorId, status: "COMPLETED", documentsImported: imported, startedAt: new Date(), completedAt: new Date() },
      });

      return Response.json(apiSuccess({ imported }));
    }

    return Response.json(apiError("UNSUPPORTED", "Selective import not supported for this connector"), { status: 400 });
  } catch (err) {
    return Response.json(apiError("IMPORT_ERROR", err instanceof Error ? err.message : "Import failed"), { status: 500 });
  }
}
