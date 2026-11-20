import { withAutopilotUser } from "@/lib/autopilot/scope";
import { spendOverview } from "@/lib/autopilot/spend";
import { currentAccountId } from "@/lib/connections/current";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await currentAccountId();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });
  try {
    return Response.json(await withAutopilotUser(userId, () => spendOverview(30)));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Kismet could not load spending.";
    return Response.json({ error: message }, { status: 500 });
  }
}
