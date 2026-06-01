import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { apiSuccess, apiError } from "@/types";
import { createLinearIssue } from "@/server/services/connectors/linear";
import type { LinearConfig } from "@/server/services/connectors/types";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string; ticketId: string }> }
) {
  try {
    const { workspaceId, ticketId } = await params;
    await requireWorkspaceAccess(workspaceId);

    const ticket = await prisma.engineeringTicket.findUnique({
      where: { id: ticketId, workspaceId },
    });
    if (!ticket) return Response.json(apiError("NOT_FOUND", "Ticket not found"), { status: 404 });

    if (ticket.externalLinearId) {
      return Response.json(apiError("CONFLICT", "Already exported to Linear"), { status: 409 });
    }

    const connector = await prisma.connector.findFirst({
      where: { workspaceId, type: "LINEAR", status: "ACTIVE" },
    });
    if (!connector) {
      return Response.json(apiError("NOT_FOUND", "No active Linear connector"), { status: 404 });
    }

    const config = connector.config as unknown as LinearConfig;
    const result = await createLinearIssue(config, {
      title: ticket.title,
      description: [
        ticket.description,
        ticket.acceptanceCriteria.length
          ? `\n**Acceptance Criteria:**\n${ticket.acceptanceCriteria.map((c) => `- ${c}`).join("\n")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
      priority: ticket.priority,
      estimate: ticket.estimate ?? undefined,
    });

    const updated = await prisma.engineeringTicket.update({
      where: { id: ticketId },
      data: { externalLinearId: result.id, externalLinearUrl: result.url },
    });

    return Response.json(apiSuccess(updated));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json(apiError("INTERNAL_ERROR", msg), { status: 500 });
  }
}
