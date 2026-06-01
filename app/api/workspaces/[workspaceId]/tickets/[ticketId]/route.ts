import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { apiSuccess, apiError } from "@/types";

const UpdateSchema = z.object({
  status: z.enum(["BACKLOG", "IN_SPRINT", "IN_PROGRESS", "IN_REVIEW", "DONE"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  title: z.string().min(1).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string; ticketId: string }> }
) {
  try {
    const { workspaceId, ticketId } = await params;
    await requireWorkspaceAccess(workspaceId);

    const body = await req.json();
    const data = UpdateSchema.parse(body);

    const ticket = await prisma.engineeringTicket.update({
      where: { id: ticketId, workspaceId },
      data,
    });

    return Response.json(apiSuccess(ticket));
  } catch {
    return Response.json(apiError("INTERNAL_ERROR", "Failed to update ticket"), { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string; ticketId: string }> }
) {
  try {
    const { workspaceId, ticketId } = await params;
    await requireWorkspaceAccess(workspaceId);

    await prisma.engineeringTicket.delete({ where: { id: ticketId, workspaceId } });

    return Response.json(apiSuccess({ deleted: true }));
  } catch {
    return Response.json(apiError("INTERNAL_ERROR", "Failed to delete ticket"), { status: 500 });
  }
}
