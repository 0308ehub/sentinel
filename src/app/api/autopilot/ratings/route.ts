import { withAutopilotUser } from "@/lib/autopilot/scope";
import { getExperiment, listSignals, log, rateSuggestion, setSignalStatus } from "@/lib/autopilot/store";
import type { SuggestionRatingValue, SuggestionTargetKind } from "@/lib/autopilot/types";
import { currentUserId } from "@/lib/connections/current";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const userId = await currentUserId();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as {
    targetKind?: SuggestionTargetKind;
    targetId?: string;
    rating?: SuggestionRatingValue;
    reason?: string;
  };
  if (!body.targetId || !["signal", "experiment"].includes(body.targetKind ?? "")) {
    return Response.json({ error: "Choose a suggestion to rate." }, { status: 400 });
  }
  if (!body.rating || !["good", "not_useful"].includes(body.rating)) {
    return Response.json({ error: "Unknown rating." }, { status: 400 });
  }
  const reason = body.reason?.trim() ?? "";
  if (reason.length > 200) return Response.json({ error: "Reason must be 200 characters or fewer." }, { status: 400 });

  return withAutopilotUser(userId, async () => {
    const targetKind = body.targetKind!;
    const targetId = body.targetId!;
    const target = targetKind === "signal"
      ? (await listSignals()).find((signal) => signal.id === targetId) ?? null
      : await getExperiment(targetId);
    if (!target) return Response.json({ error: "Suggestion not found." }, { status: 404 });
    const rating = await rateSuggestion({ targetKind, targetId, rating: body.rating!, reason, title: target.title });
    if (targetKind === "signal" && body.rating === "not_useful") {
      await setSignalStatus(targetId, "dismissed");
      await log("rating", `You marked “${target.title}” not useful.`, targetId);
    }
    return Response.json({ rating });
  });
}
