import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { queueAction } from "@/server/services/autonomous-pm";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaces = await prisma.workspace.findMany({
    where: { connectors: { some: { type: "LINEAR", status: "ACTIVE" } } },
    select: { id: true },
  });

  for (const w of workspaces) {
    await queueAction({
      workspaceId: w.id,
      type: "SYNC_LINEAR_STATUS",
      title: "Sync ticket status from Linear",
      description: "Pull latest ticket status changes from Linear and update the board.",
      payload: {},
      triggeredBy: "cron-sync-linear",
      autoApprove: true,
    });
  }

  return Response.json({ queued: workspaces.length });
}
