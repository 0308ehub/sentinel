import { buildNext } from "@/lib/autopilot/build";
import { chosenBuilder } from "@/lib/autopilot/builders";
import { designSignal } from "@/lib/autopilot/design";
import { withAutopilotUser } from "@/lib/autopilot/scope";
import { setSignalAdjustments, setSignalStatus } from "@/lib/autopilot/store";
import { currentAccountId } from "@/lib/connections/current";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await currentAccountId();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { adjustments?: unknown };
  if (typeof body.adjustments !== "string") return Response.json({ error: "Notes must be text." }, { status: 400 });
  const adjustments = body.adjustments.trim().slice(0, 2000) || null;
  await withAutopilotUser(userId, () => setSignalAdjustments(id, adjustments));
  return Response.json({ adjustments });
}

/** Dismisses a problem the account does not want Kismet to work on. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await currentAccountId();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { action?: string; builder?: unknown };
  if (body.action === "test") {
    try {
      const message = await withAutopilotUser(userId, async () => {
        const designed = await designSignal(id, undefined, chosenBuilder(body.builder));
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
