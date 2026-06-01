import { z } from "zod";
import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { apiSuccess, apiError } from "@/types";
import { approveAndExecute, rejectAction } from "@/server/services/autonomous-pm";

export const maxDuration = 300;

const Schema = z.object({ decision: z.enum(["approve", "reject"]) });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string; actionId: string }> }
) {
  try {
    const { workspaceId, actionId } = await params;
    await requireWorkspaceAccess(workspaceId);

    const { decision } = Schema.parse(await req.json());

    if (decision === "approve") {
      const result = await approveAndExecute(actionId);
      return Response.json(apiSuccess(result));
    } else {
      const action = await rejectAction(actionId);
      return Response.json(apiSuccess(action));
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed";
    return Response.json(apiError("INTERNAL_ERROR", msg), { status: 500 });
  }
}
