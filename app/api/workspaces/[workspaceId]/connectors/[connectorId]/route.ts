import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess, unauthorizedResponse, notFoundResponse, internalErrorResponse } from "@/lib/auth/helpers";
import { apiSuccess } from "@/types";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string; connectorId: string }> }
) {
  const { workspaceId, connectorId } = await params;
  try { await requireWorkspaceAccess(workspaceId); } catch { return unauthorizedResponse(); }

  const connector = await prisma.connector.findFirst({
    where: { id: connectorId, workspaceId },
    include: { syncLogs: { orderBy: { startedAt: "desc" }, take: 10 } },
  });
  if (!connector) return notFoundResponse("Connector");
  return Response.json(apiSuccess(connector));
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string; connectorId: string }> }
) {
  const { workspaceId, connectorId } = await params;
  try { await requireWorkspaceAccess(workspaceId); } catch { return unauthorizedResponse(); }

  try {
    const body = await req.json();
    const connector = await prisma.connector.update({
      where: { id: connectorId },
      data: {
        ...(body.name ? { name: body.name } : {}),
        ...(body.config ? { config: body.config } : {}),
        ...(body.status ? { status: body.status } : {}),
      },
    });
    return Response.json(apiSuccess(connector));
  } catch (err) {
    return internalErrorResponse(err instanceof Error ? err.message : "Update failed");
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string; connectorId: string }> }
) {
  const { workspaceId, connectorId } = await params;
  try { await requireWorkspaceAccess(workspaceId); } catch { return unauthorizedResponse(); }

  await prisma.connector.delete({ where: { id: connectorId } });
  return Response.json(apiSuccess(null));
}
