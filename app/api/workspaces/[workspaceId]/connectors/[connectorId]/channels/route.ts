import { prisma } from "@/lib/db/prisma";
import {
  requireWorkspaceAccess,
  unauthorizedResponse,
  notFoundResponse,
} from "@/lib/auth/helpers";
import { apiSuccess, apiError } from "@/types";
import type { SlackConfig } from "@/server/services/connectors/types";

/** GET — list Slack channels available in the connected workspace */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string; connectorId: string }> }
) {
  const { workspaceId, connectorId } = await params;
  try {
    await requireWorkspaceAccess(workspaceId);
  } catch {
    return unauthorizedResponse();
  }

  const connector = await prisma.connector.findFirst({ where: { id: connectorId, workspaceId } });
  if (!connector) return notFoundResponse("Connector");
  if (connector.type !== "SLACK") {
    return Response.json(apiError("UNSUPPORTED", "Only Slack connectors have channels"), { status: 400 });
  }

  try {
    const config = connector.config as unknown as SlackConfig;
    const { listSlackChannels } = await import("@/server/services/connectors/slack");
    const channels = await listSlackChannels(config.botToken);
    // Also return the currently selected channelIds so the UI can pre-check them
    return Response.json(apiSuccess({ channels, selectedIds: config.channelIds ?? [] }));
  } catch (err) {
    return Response.json(
      apiError("FETCH_FAILED", err instanceof Error ? err.message : "Failed to fetch channels"),
      { status: 500 }
    );
  }
}

/** PATCH — save selected channelIds into the connector config */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string; connectorId: string }> }
) {
  const { workspaceId, connectorId } = await params;
  try {
    await requireWorkspaceAccess(workspaceId);
  } catch {
    return unauthorizedResponse();
  }

  const connector = await prisma.connector.findFirst({ where: { id: connectorId, workspaceId } });
  if (!connector) return notFoundResponse("Connector");

  const { channelIds } = (await req.json()) as { channelIds: string[] };
  if (!Array.isArray(channelIds) || channelIds.length === 0) {
    return Response.json(apiError("VALIDATION", "Select at least one channel"), { status: 400 });
  }

  const existingConfig = connector.config as Record<string, unknown>;
  const updated = await prisma.connector.update({
    where: { id: connectorId },
    data: {
      config: { ...existingConfig, channelIds },
      status: "ACTIVE",
    },
  });

  return Response.json(apiSuccess(updated));
}
