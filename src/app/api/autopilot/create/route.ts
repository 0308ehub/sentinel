import { buildNext } from "@/lib/autopilot/build";
import { chosenBuilder } from "@/lib/autopilot/builders";
import { designSignal } from "@/lib/autopilot/design";
import { withAutopilotUser } from "@/lib/autopilot/scope";
import { createSignal } from "@/lib/autopilot/store";
import { currentUserId } from "@/lib/connections/current";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const userId = await currentUserId();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { title?: unknown; change?: unknown; page?: unknown; builder?: unknown } | null;
  const change = typeof body?.change === "string" ? body.change.trim() : "";
  const title = (typeof body?.title === "string" ? body.title.trim() : "") || change.slice(0, 80);
  const page = typeof body?.page === "string" ? body.page.trim() : "";
  if (change.length < 8 || !title) {
    return Response.json({ error: "Describe the change you want to test." }, { status: 400 });
  }
  try {
    const message = await withAutopilotUser(userId, async () => {
      const id = await createSignal({ title, problem: change, area: page });
      const designed = await designSignal(id, "experiment", chosenBuilder(body?.builder));
      const built = await buildNext();
      return [designed, built].filter(Boolean).join(" ");
    });
    return Response.json({ message });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create the experiment.";
    console.error("[autopilot] create", error);
    return Response.json({ error: message }, { status: 400 });
  }
}
