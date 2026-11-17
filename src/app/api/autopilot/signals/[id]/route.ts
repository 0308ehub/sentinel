import { buildNext } from "@/lib/autopilot/build";
import { designSignal } from "@/lib/autopilot/design";
import { withAutopilotUser } from "@/lib/autopilot/scope";
import { setSignalStatus } from "@/lib/autopilot/store";
import { currentUserId } from "@/lib/connections/current";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** Dismisses a problem the account does not want Kismet to work on. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { action?: string };
  if (body.action === "test") {
    try {
      const message = await withAutopilotUser(userId, async () => {
        const designed = await designSignal(id);
        const built = await buildNext();
        return [designed, built].filter(Boolean).join(" ");
      });
      return Response.json({ message });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not start a test.";
      console.error("[autopilot] test signal", error);
      return Response.json({ error: message }, { status: 400 });
    }
  }
  if (body.action !== "dismiss") return Response.json({ error: "Unknown action." }, { status: 400 });
  try {
    await withAutopilotUser(userId, () => setSignalStatus(id, "dismissed"));
    return Response.json({ message: "Dismissed. Kismet won't propose experiments for this problem." });
  } catch (error) {
    console.error("[autopilot] dismiss signal", error);
    return Response.json({ error: "Could not dismiss this problem." }, { status: 500 });
  }
}
