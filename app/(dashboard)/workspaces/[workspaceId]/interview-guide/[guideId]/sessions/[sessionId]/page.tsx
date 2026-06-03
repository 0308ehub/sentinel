import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { redirect, notFound } from "next/navigation";
import { ConductorClient } from "./conductor-client";

export default async function SessionConductorPage({
  params,
}: {
  params: Promise<{ workspaceId: string; guideId: string; sessionId: string }>;
}) {
  const { workspaceId, guideId, sessionId } = await params;
  try { await requireWorkspaceAccess(workspaceId); } catch { redirect("/sign-in"); }

  const session = await prisma.interviewSession.findFirst({
    where: { id: sessionId, guideId },
    include: {
      notes: true,
      guide: {
        include: { questions: { orderBy: { order: "asc" } } },
      },
    },
  });

  if (!session || session.guide.workspaceId !== workspaceId) notFound();

  return <ConductorClient workspaceId={workspaceId} session={session} />;
}
