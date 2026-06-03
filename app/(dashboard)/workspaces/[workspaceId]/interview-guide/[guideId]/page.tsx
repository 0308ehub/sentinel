import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { redirect, notFound } from "next/navigation";
import { GuideDetailClient } from "./guide-detail-client";

export default async function GuideDetailPage({
  params,
}: {
  params: Promise<{ workspaceId: string; guideId: string }>;
}) {
  const { workspaceId, guideId } = await params;
  try { await requireWorkspaceAccess(workspaceId); } catch { redirect("/sign-in"); }

  const guide = await prisma.interviewGuide.findFirst({
    where: { id: guideId, workspaceId },
    include: {
      questions: { orderBy: { order: "asc" } },
      sessions: { orderBy: { date: "desc" } },
    },
  });

  if (!guide) notFound();
  return <GuideDetailClient workspaceId={workspaceId} guide={guide} />;
}
