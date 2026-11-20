import { experimentMeasure, measureOverview } from "@/lib/autopilot/measure-data";
import { withAutopilotUser } from "@/lib/autopilot/scope";
import { currentAccountId } from "@/lib/connections/current";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const userId = await currentAccountId();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });
  try {
    const id = new URL(request.url).searchParams.get("experiment")?.trim();
    if (!id) return Response.json(await withAutopilotUser(userId, measureOverview));
    const result = await withAutopilotUser(userId, () => experimentMeasure(id));
    return result ? Response.json(result) : Response.json({ error: "Measurement not found." }, { status: 404 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Kismet could not load measurement.";
    return Response.json({ error: message }, { status: 500 });
  }
}
