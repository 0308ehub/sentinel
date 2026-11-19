import { unifiedDiff } from "@/lib/autopilot/diff";
import { chosenAutopilotRepo } from "@/lib/autopilot/repo";
import { defaultAutopilotRepo } from "@/lib/autopilot/repo";
import { withAutopilotUser } from "@/lib/autopilot/scope";
import { siteUrlFor } from "@/lib/autopilot/sites";
import { experimentDraft, getExperiment } from "@/lib/autopilot/store";
import { currentUserId } from "@/lib/connections/current";
import {
  commitChecks,
  compareFiles,
  deploymentPreviewUrl,
  GitHubApiError,
  pullChanges,
  repoDefaultBranch,
} from "@/lib/github/client";

export const dynamic = "force-dynamic";

const CHANGES_TTL_MS = 60_000;
const changesCache = new Map<string, { expiresAt: number; body: unknown }>();

function cachedChanges(key: string): unknown | null {
  const entry = changesCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    changesCache.delete(key);
    return null;
  }
  return entry.body;
}

function rememberChanges(key: string, body: unknown) {
  changesCache.set(key, { expiresAt: Date.now() + CHANGES_TTL_MS, body });
  if (changesCache.size > 200) {
    const now = Date.now();
    for (const [candidate, entry] of changesCache) if (entry.expiresAt <= now) changesCache.delete(candidate);
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await params;
  return withAutopilotUser(userId, async () => {
    const experiment = await getExperiment(id);
    if (!experiment) return Response.json({ error: "Experiment not found." }, { status: 404 });
    const cleanup = new URL(request.url).searchParams.get("cleanup") === "1";
    const prNumber = cleanup ? experiment.cleanup?.prNumber : experiment.prNumber;
    const cacheKey = [userId, id, experiment.version, cleanup, prNumber ?? "", experiment.branch ?? "", experiment.draftPath ?? ""].join(":");
    const cached = cachedChanges(cacheKey);
    if (cached) return Response.json(cached);
    const repo = await chosenAutopilotRepo();
    const siteUrl = repo === defaultAutopilotRepo() ? null : await siteUrlFor(userId);
    try {
      if (prNumber && repo) {
        const pull = await pullChanges(repo, prNumber);
        const [checks, previewUrl] = await Promise.all([
          commitChecks(repo, pull.headSha),
          deploymentPreviewUrl(repo, pull.headSha).catch(() => null),
        ]);
        const body = { source: "pull", pull, checks, previewUrl, siteUrl, ownRepo: repo === defaultAutopilotRepo() };
        rememberChanges(cacheKey, body);
        return Response.json(body);
      }
      if (!cleanup && experiment.branch && repo) {
        const defaultBranch = await repoDefaultBranch(repo);
        const files = await compareFiles(repo, defaultBranch, experiment.branch);
        const body = { source: "branch", branch: experiment.branch, files, siteUrl, ownRepo: repo === defaultAutopilotRepo() };
        rememberChanges(cacheKey, body);
        return Response.json(body);
      }
      if (!cleanup) {
        const draft = await experimentDraft(id);
        if (draft) {
          const body = {
            source: "draft",
            files: [{
              filename: draft.path,
              status: "modified",
              patch: unifiedDiff(draft.path, draft.original ?? "", draft.content),
            }],
            siteUrl,
            ownRepo: repo === defaultAutopilotRepo(),
          };
          rememberChanges(cacheKey, body);
          return Response.json(body);
        }
      }
      const body = { source: "none", siteUrl, ownRepo: repo === defaultAutopilotRepo() };
      rememberChanges(cacheKey, body);
      return Response.json(body);
    } catch (error) {
      const message = error instanceof GitHubApiError ? error.hint ?? error.message : "GitHub request failed.";
      return Response.json({ error: message }, { status: 502 });
    }
  });
}
