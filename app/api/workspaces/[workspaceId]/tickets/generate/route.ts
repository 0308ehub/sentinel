import { z } from "zod";
import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { generateEngineeringTickets } from "@/server/services/ticket-service";
import { apiSuccess, apiError } from "@/types";

const Schema = z.object({
  prdId: z.string().optional(),
  opportunityId: z.string().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params;
    await requireWorkspaceAccess(workspaceId);
    const body = await request.json();
    const { prdId, opportunityId } = Schema.parse(body);

    const result = await generateEngineeringTickets({ workspaceId, prdId, opportunityId });
    return Response.json(apiSuccess(result), { status: 201 });
  } catch (error) {
    console.error("[tickets-generate]", error);
    return Response.json(apiError("LLM_ERROR", "Failed to generate tickets"), { status: 500 });
  }
}
