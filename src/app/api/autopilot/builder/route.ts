import { accountBuilder, cursorKey, setAccountBuilder } from "@/lib/autopilot/builder-store";
import { BUILDERS, CLAUDE_WORKFLOW_FILE, CLAUDE_WORKFLOW_PATH, CLAUDE_WORKFLOW_YAML } from "@/lib/autopilot/builders";
import { chosenAutopilotRepo } from "@/lib/autopilot/repo";
import { currentAccountId } from "@/lib/connections/current";
import { workflowState, type WorkflowState } from "@/lib/github/client";

export const dynamic = "force-dynamic";

/** Which coding agent writes this account's experiments, and whether that agent is set up. */
export async function GET() {
  const userId = await currentAccountId();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });
  try {
    const [builder, key, repo] = await Promise.all([accountBuilder(), cursorKey(userId), chosenAutopilotRepo()]);
    let workflow: WorkflowState | null = null;
    if (builder === "claude-code" && repo) {
      workflow = await workflowState(repo, CLAUDE_WORKFLOW_FILE).catch(() => null);
    }
    return Response.json({
      builder,
      repo,
      cursorConnected: Boolean(key),
      workflow,
      workflowPath: CLAUDE_WORKFLOW_PATH,
      workflowYaml: CLAUDE_WORKFLOW_YAML,
    });
  } catch (error) {
    console.error("[autopilot] builder", error);
    return Response.json({ error: "Could not load the coding agent setting." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const userId = await currentAccountId();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { builder?: unknown } | null;
  const builder = BUILDERS.find((item) => item === body?.builder);
  if (!builder) return Response.json({ error: "Choose Kismet, Cursor or Claude Code." }, { status: 400 });
  try {
    await setAccountBuilder(userId, builder);
    return Response.json({ builder });
  } catch (error) {
    console.error("[autopilot] builder", error);
    return Response.json({ error: "Could not save the coding agent setting." }, { status: 500 });
  }
}
