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
    where: { documents: { some: {} } },
    select: { id: true },
  });

  const results = await Promise.allSettled(
    workspaces.map((w) =>
      queueAction({
        workspaceId: w.id,
        type: "GENERATE_DIGEST",
        title: "Weekly PM Digest",
        description: "Weekly automated digest of workspace activity, pain points, opportunities, and sprint progress.",
        payload: {},
        triggeredBy: "cron-weekly",
        autoApprove: true,
      })
    )
  );

  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  return Response.json({ queued: workspaces.length, succeeded });
}
