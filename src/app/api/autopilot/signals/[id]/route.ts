import { withAutopilotUser } from "@/lib/autopilot/scope";
import { setSignalStatus } from "@/lib/autopilot/store";
import { currentUserId } from "@/lib/connections/current";

export const dynamic = "force-dynamic";

/** Dismisses a problem the account does not want Kismet to work on. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { action?: string };
  if (body.action !== "dismiss") return Response.json({ error: "Unknown action." }, { status: 400 });
  try {
    await withAutopilotUser(userId, () => setSignalStatus(id, "dismissed"));
    return Response.json({ message: "Dismissed. Kismet won't propose experiments for this problem." });
  } catch (error) {
    console.error("[autopilot] dismiss signal", error);
    return Response.json({ error: "Could not dismiss this problem." }, { status: 500 });
  }
}
