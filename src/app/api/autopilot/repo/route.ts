import { chosenAutopilotRepo, chosenAutopilotRepoReason, repoTakenMessage, setAutopilotRepo } from "@/lib/autopilot/repo";
import { currentUserId } from "@/lib/connections/current";
import { repoName } from "@/lib/github/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });
  try {
    const [repo, reason] = await Promise.all([chosenAutopilotRepo(), chosenAutopilotRepoReason()]);
    return Response.json({ repo, reason });
  } catch (error) {
    console.error("[autopilot] repo", error);
    return Response.json({ error: "Could not load the repository." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const userId = await currentUserId();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { repo?: unknown } | null;
  const repo = typeof body?.repo === "string" ? body.repo.trim() : "";
  if (!repoName(repo)) return Response.json({ error: "Choose a repository like owner/name." }, { status: 400 });
  try {
    await setAutopilotRepo(userId, repo);
    return Response.json({ repo });
  } catch (error) {
    console.error("[autopilot] repo", error);
    if (error instanceof Error && error.message === repoTakenMessage(repo)) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    return Response.json({ error: "Could not save the repository." }, { status: 500 });
  }
}
