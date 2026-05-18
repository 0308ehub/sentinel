import { z } from "zod";
import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { generatePRD } from "@/server/services/prd-service";
import { apiSuccess, apiError } from "@/types";

const Schema = z.object({
  opportunityId: z.string().optional(),
  userInstruction: z.string().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params;
    const { user } = await requireWorkspaceAccess(workspaceId);
    const body = await request.json();
    const { opportunityId, userInstruction } = Schema.parse(body);

    const prd = await generatePRD({ workspaceId, opportunityId, userInstruction, userId: user.id });
    return Response.json(apiSuccess(prd), { status: 201 });
  } catch (error) {
    console.error("[prd-generate]", error);
    return Response.json(apiError("LLM_ERROR", "Failed to generate PRD"), { status: 500 });
  }
}
