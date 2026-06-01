import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { redirect } from "next/navigation";
import { TicketsBoard } from "./tickets-board";

export default async function TicketsPage({
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

  const tickets = await prisma.engineeringTicket.findMany({
    where: { workspaceId },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    include: {
      opportunity: { select: { title: true } },
      prd: { select: { title: true } },
    },
  });

  const hasLinearConnector = !!(await prisma.connector.findFirst({
    where: { workspaceId, type: "LINEAR", status: "ACTIVE" },
  }));

  return (
    <TicketsBoard
      workspaceId={workspaceId}
      initialTickets={tickets}
      hasLinearConnector={hasLinearConnector}
    />
  );
}
