import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { redirect } from "next/navigation";
import { InboxClient } from "./inbox-client";

export default async function InboxPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;

  try {
    await requireWorkspaceAccess(workspaceId);
  } catch {
    redirect("/sign-in");
  }

  const [actions, settings] = await Promise.all([
    prisma.sentinelAction.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: 60,
    }),
    prisma.workspaceSettings.findUnique({ where: { workspaceId } }),
  ]);

  return (
    <InboxClient
      workspaceId={workspaceId}
      initialActions={actions as never}
      settings={settings}
    />
  );
}
