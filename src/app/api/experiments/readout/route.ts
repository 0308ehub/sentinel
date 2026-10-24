import { parseAllocation } from "@/lib/experiments/allocation";
import { runExperimentReadout } from "@/lib/experiments/readout";
import { databricksErrorResponse } from "@/lib/databricks/client";

export const maxDuration = 60;

export async function POST(request: Request) {
  let plan;
  let control = "Control";
  try {
    const body = (await request.json()) as { plan?: unknown; control?: unknown };
    control = typeof body.control === "string" && body.control.trim() ? body.control.trim().slice(0, 40) : "Control";
    const treatment = "Treatment";
    plan = parseAllocation(body.plan, treatment, control);
  } catch {
    return Response.json({ error: "Send the allocation." }, { status: 400 });
  }

  try {
    return Response.json(await runExperimentReadout(plan, { control }));
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unexpected name")) {
      return Response.json({ error: "That audience is not in the warehouse." }, { status: 400 });
    }
    return databricksErrorResponse(error);
  }
}
