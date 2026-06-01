import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess, unauthorizedResponse, notFoundResponse } from "@/lib/auth/helpers";
import { apiSuccess, apiError } from "@/types";
import type { GmailConfig } from "@/server/services/connectors/types";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string; connectorId: string }> }
) {
  const { workspaceId, connectorId } = await params;
  try { await requireWorkspaceAccess(workspaceId); } catch { return unauthorizedResponse(); }

  const connector = await prisma.connector.findFirst({ where: { id: connectorId, workspaceId } });
  if (!connector) return notFoundResponse("Connector");

  try {
    if (connector.type === "GMAIL") {
      const { scanGmail } = await import("@/server/services/connectors/gmail");
      const config = connector.config as unknown as GmailConfig;

      // Get already-imported externalIds so we can mark them
      const existing = await prisma.document.findMany({
        where: { workspaceId, connectorId },
        select: { externalId: true },
      });
      const importedIds = new Set(existing.map((d) => d.externalId).filter(Boolean));

      const candidates = await scanGmail(config, 80);
      const enriched = candidates.map((c) => ({ ...c, alreadyImported: importedIds.has(c.externalId) }));

      return Response.json(apiSuccess({ candidates: enriched, total: enriched.length }));
    }

    return Response.json(apiError("UNSUPPORTED", "Scan not yet supported for this connector type"), { status: 400 });
  } catch (err) {
    return Response.json(apiError("SCAN_ERROR", err instanceof Error ? err.message : "Scan failed"), { status: 500 });
  }
}
