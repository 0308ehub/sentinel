import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess, unauthorizedResponse, notFoundResponse } from "@/lib/auth/helpers";
import { apiSuccess, apiError } from "@/types";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string; connectorId: string }> }
) {
  const { workspaceId, connectorId } = await params;
  try { await requireWorkspaceAccess(workspaceId); } catch { return unauthorizedResponse(); }

  const connector = await prisma.connector.findFirst({ where: { id: connectorId, workspaceId } });
  if (!connector) return notFoundResponse("Connector");

  try {
    const { syncConnector } = await import("@/server/services/connectors");
    const result = await syncConnector(connectorId);
    return Response.json(apiSuccess(result));
  } catch (err) {
    return Response.json(
      apiError("SYNC_ERROR", err instanceof Error ? err.message : "Sync failed"),
      { status: 500 }
    );
  }
}
