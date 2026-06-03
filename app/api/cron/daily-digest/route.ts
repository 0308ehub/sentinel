import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { generateWorkspaceDigest } from "@/server/services/digest-service";

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
    workspaces.map((w) => generateWorkspaceDigest(w.id, "DAILY"))
  );

  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  return Response.json({ generated: workspaces.length, succeeded });
}
