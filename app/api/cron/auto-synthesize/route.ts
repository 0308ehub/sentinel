import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { synthesizeWorkspace } from "@/server/services/synthesis-service";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find workspaces that have COMPLETED documents newer than lastSynthesizedAt
  const staleWorkspaces = await prisma.$queryRaw<{ id: string }[]>`
    SELECT DISTINCT w.id
    FROM "Workspace" w
    JOIN "Document" d ON d."workspaceId" = w.id
    WHERE d.status = 'COMPLETED'
      AND d."updatedAt" > COALESCE(w."lastSynthesizedAt", '1970-01-01')
  `;

  const results = await Promise.allSettled(
    staleWorkspaces.map((w) => synthesizeWorkspace(w.id))
  );

  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  return Response.json({ checked: staleWorkspaces.length, synthesized: succeeded });
}
