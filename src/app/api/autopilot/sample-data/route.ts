import { removeSampleData } from "@/lib/autopilot/sample-data";
import { withAutopilotUser } from "@/lib/autopilot/scope";
import { currentAccountId } from "@/lib/connections/current";

export const dynamic = "force-dynamic";

/** Removes the signed-in account's synthetic Autopilot data. */
export async function DELETE() {
  const userId = await currentAccountId();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });
  try {
    return Response.json(await withAutopilotUser(userId, () => removeSampleData()));
  } catch (error) {
    console.error("[autopilot] sample data", error);
    return Response.json({ error: "Could not remove the sample data." }, { status: 500 });
  }
}
