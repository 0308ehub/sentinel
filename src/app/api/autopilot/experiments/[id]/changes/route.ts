import { unifiedDiff } from "@/lib/autopilot/diff";
import { chosenAutopilotRepo } from "@/lib/autopilot/repo";
import { withAutopilotUser } from "@/lib/autopilot/scope";
import { experimentDraft, getExperiment } from "@/lib/autopilot/store";
import { currentUserId } from "@/lib/connections/current";
import {
  commitChecks,
  compareFiles,
  GitHubApiError,
  pullChanges,
  repoDefaultBranch,
} from "@/lib/github/client";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await params;
  return withAutopilotUser(userId, async () => {
    const experiment = await getExperiment(id);
    if (!experiment) return Response.json({ error: "Experiment not found." }, { status: 404 });
    const cleanup = new URL(request.url).searchParams.get("cleanup") === "1";
    const prNumber = cleanup ? experiment.cleanup?.prNumber : experiment.prNumber;
    const repo = await chosenAutopilotRepo();
    try {
      if (prNumber && repo) {
        const pull = await pullChanges(repo, prNumber);
        const checks = await commitChecks(repo, pull.headSha);
        return Response.json({ source: "pull", pull, checks });
      }
      if (!cleanup && experiment.branch && repo) {
        const defaultBranch = await repoDefaultBranch(repo);
        const files = await compareFiles(repo, defaultBranch, experiment.branch);
        return Response.json({ source: "branch", branch: experiment.branch, files });
      }
      if (!cleanup) {
        const draft = await experimentDraft(id);
        if (draft) {
          return Response.json({
            source: "draft",
            files: [{
              filename: draft.path,
              status: "modified",
              patch: unifiedDiff(draft.path, draft.original ?? "", draft.content),
            }],
          });
        }
      }
      return Response.json({ source: "none" });
    } catch (error) {
      const message = error instanceof GitHubApiError ? error.hint ?? error.message : "GitHub request failed.";
      return Response.json({ error: message }, { status: 502 });
    }
  });
}
