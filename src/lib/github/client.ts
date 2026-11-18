import "server-only";

import { actingUserId } from "@/lib/connections/current";
import { getConnection } from "@/lib/connections/store";

const API = "https://api.github.com";
const CONNECT = "Connect GitHub in Settings → Connectors → GitHub.";
const MISSING = "Add GITHUB_TOKEN to .env and restart the dev server.";

export class GitHubApiError extends Error {
  constructor(
    public code: string,
    public hint?: string,
    public status = 502
  ) {
    super(code);
  }
}

export interface GitHubAccount {
  login: string;
}

export interface GitHubRepoSummary {
  fullName: string;
  private: boolean;
  defaultBranch: string;
  description: string;
}

export interface GitHubFile {
  path: string;
  content: string;
  sha: string;
}

export interface GitHubPull {
  number: number;
  url: string;
  branch: string;
}

export async function createPullFromBranch(
  fullName: string,
  head: string,
  base: string,
  title: string,
  body: string,
): Promise<{ number: number; url: string }> {
  const parsed = repoName(fullName);
  if (!parsed) throw new GitHubApiError("bad_repo", "Use a repository like owner/name.", 400);
  try {
    const pull = await github<{ number?: number; html_url?: string }>(`/repos/${parsed.owner}/${parsed.repo}/pulls`, {
      method: "POST",
      body: JSON.stringify({ head, base, title: title.slice(0, 120), body: body.slice(0, 6000) }),
    });
    return pullResult(pull);
  } catch (error) {
    if (!(error instanceof GitHubApiError) || error.status !== 422) throw error;
    const pulls = await github<{ number?: number; html_url?: string }[]>(
      `/repos/${parsed.owner}/${parsed.repo}/pulls?head=${encodeURIComponent(`${parsed.owner}:${head}`)}&state=open`,
    );
    return pullResult(pulls[0]);
  }
}

export interface GitHubCompareFile {
  filename: string;
  status: string;
  patch?: string;
}

export async function compareFiles(fullName: string, base: string, head: string): Promise<GitHubCompareFile[]> {
  const parsed = repoName(fullName);
  if (!parsed) throw new GitHubApiError("bad_repo", "Use a repository like owner/name.", 400);
  const result = await github<{ files?: GitHubCompareFile[] }>(
    `/repos/${parsed.owner}/${parsed.repo}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`,
  );
  return result.files ?? [];
}

function pullResult(pull: { number?: number; html_url?: string } | undefined): { number: number; url: string } {
  if (!pull?.number || !pull.html_url) {
    throw new GitHubApiError("github_error", "GitHub did not return the pull request.", 502);
  }
  return { number: pull.number, url: pull.html_url };
}

interface RepoPayload {
  full_name?: string;
  private?: boolean;
  default_branch?: string;
  description?: string | null;
  permissions?: { push?: boolean; };
}

interface ContentPayload {
  type?: string;
  encoding?: string;
  content?: string;
  sha?: string;
  size?: number;
}

interface TreePayload {
  truncated?: boolean;
  tree?: { path?: string; type?: string }[];
}

async function token(): Promise<string> {
  const userId = await actingUserId();
  if (userId) {
    try {
      const stored = await getConnection<{ token?: unknown }>(userId, "github");
      const value = typeof stored?.secret.token === "string" ? stored.secret.token.trim() : "";
      if (value) return value;
    } catch (error) {
      if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) throw error;
    }
  }
  if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) throw new GitHubApiError("missing_token", CONNECT, 503);
  const value = process.env.GITHUB_TOKEN?.trim();
  if (!value) throw new GitHubApiError("missing_token", MISSING, 503);
  return value;
}

export function repoName(value: string): { owner: string; repo: string } | null {
  const match = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/.exec(value.trim());
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

async function github<T>(path: string, init?: RequestInit, candidateToken?: string): Promise<T> {
  const resolvedToken = candidateToken ?? await token();
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${resolvedToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "kismet",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (res.status === 401) {
    throw new GitHubApiError(
      "unauthorized",
      "GitHub rejected the token. Create a new token at https://github.com/settings/tokens.",
      401,
    );
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string; };
    throw new GitHubApiError("github_error", body.message || "GitHub request failed.", res.status);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function githubAccount(candidateToken?: string): Promise<GitHubAccount> {
  const user = await github<{ login?: string; }>("/user", undefined, candidateToken);
  if (!user.login) throw new GitHubApiError("github_error", "GitHub did not return an account.", 502);
  return { login: user.login };
}

export async function listWritableRepos(): Promise<GitHubRepoSummary[]> {
  const rows = await github<RepoPayload[]>(
    "/user/repos?per_page=50&sort=updated&affiliation=owner,collaborator,organization_member",
  );
  return rows
    .filter((row) => row.full_name && row.permissions?.push !== false)
    .map((row) => ({
      fullName: row.full_name as string,
      private: Boolean(row.private),
      defaultBranch: row.default_branch || "main",
      description: row.description?.trim() || "",
    }));
}

export async function repoDefaultBranch(fullName: string): Promise<string> {
  const parsed = repoName(fullName);
  if (!parsed) throw new GitHubApiError("bad_repo", "Use a repository like owner/name.", 400);
  const repo = await github<RepoPayload>(`/repos/${parsed.owner}/${parsed.repo}`);
  if (repo.permissions?.push === false) {
    throw new GitHubApiError("forbidden", "This token can see the repository, but it cannot push a branch.", 403);
  }
  return repo.default_branch || "main";
}

export async function listUiFiles(fullName: string, branch: string, limit = 24): Promise<string[]> {
  const parsed = repoName(fullName);
  if (!parsed) throw new GitHubApiError("bad_repo", "Use a repository like owner/name.", 400);
  const tree = await github<TreePayload>(
    `/repos/${parsed.owner}/${parsed.repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`
  );
  const paths = (tree.tree ?? [])
    .filter((item) => item.type === "blob" && item.path && isUiPath(item.path))
    .map((item) => item.path as string);
  paths.sort((a, b) => rankUiPath(a) - rankUiPath(b) || a.length - b.length);
  return paths.slice(0, limit);
}

export async function readFile(fullName: string, path: string, branch: string): Promise<GitHubFile | null> {
  const parsed = repoName(fullName);
  if (!parsed || !isUiPath(path)) return null;
  const payload = await github<ContentPayload>(
    `/repos/${parsed.owner}/${parsed.repo}/contents/${path}?ref=${encodeURIComponent(branch)}`
  );
  if (payload.type !== "file" || payload.encoding !== "base64" || !payload.content || !payload.sha) return null;
  if ((payload.size ?? 0) > 24_000) return null;
  const content = Buffer.from(payload.content.replace(/\n/g, ""), "base64").toString("utf8");
  return { path, content, sha: payload.sha };
}

export async function openPullRequest(input: {
  fullName: string;
  base: string;
  branch: string;
  path: string;
  content: string;
  sha: string;
  title: string;
  body: string;
  message: string;
}): Promise<GitHubPull> {
  const parsed = repoName(input.fullName);
  if (!parsed) throw new GitHubApiError("bad_repo", "Use a repository like owner/name.", 400);
  const head = await github<{ object?: { sha?: string; }; }>(
    `/repos/${parsed.owner}/${parsed.repo}/git/ref/heads/${encodeURIComponent(input.base)}`
  );
  const sha = head.object?.sha;
  if (!sha) throw new GitHubApiError("github_error", "GitHub did not return the base commit.", 502);
  await github(`/repos/${parsed.owner}/${parsed.repo}/git/refs`, {
    method: "POST",
    body: JSON.stringify({ ref: `refs/heads/${input.branch}`, sha }),
  });
  await github(`/repos/${parsed.owner}/${parsed.repo}/contents/${input.path}`, {
    method: "PUT",
    body: JSON.stringify({
      message: input.message.slice(0, 120),
      content: Buffer.from(input.content, "utf8").toString("base64"),
      branch: input.branch,
      sha: input.sha,
    }),
  });
  const pull = await github<{ number?: number; html_url?: string }>(`/repos/${parsed.owner}/${parsed.repo}/pulls`, {
    method: "POST",
    body: JSON.stringify({
      title: input.title.slice(0, 120),
      head: input.branch,
      base: input.base,
      body: input.body.slice(0, 6000),
    }),
  });
  if (!pull.number || !pull.html_url) {
    throw new GitHubApiError("github_error", "GitHub did not open the pull request.", 502);
  }
  return { number: pull.number, url: pull.html_url, branch: input.branch };
}

/** Creates a branch at the tip of `base`. A branch that already exists is left as it is. */
export async function createBranch(fullName: string, branch: string, base: string): Promise<void> {
  const parsed = repoName(fullName);
  if (!parsed) throw new GitHubApiError("bad_repo", "Use a repository like owner/name.", 400);
  const head = await github<{ object?: { sha?: string } }>(
    `/repos/${parsed.owner}/${parsed.repo}/git/ref/heads/${encodeURIComponent(base)}`,
  );
  const sha = head.object?.sha;
  if (!sha) throw new GitHubApiError("github_error", "GitHub did not return the base commit.", 502);
  try {
    await github(`/repos/${parsed.owner}/${parsed.repo}/git/refs`, {
      method: "POST",
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha }),
    });
  } catch (error) {
    if (!(error instanceof GitHubApiError) || error.status !== 422) throw error;
  }
}

export type WorkflowState = "ready" | "missing" | "disabled" | "forbidden";

/** Whether a workflow file is on the default branch and can be started. */
export async function workflowState(fullName: string, file: string): Promise<WorkflowState> {
  const parsed = repoName(fullName);
  if (!parsed) throw new GitHubApiError("bad_repo", "Use a repository like owner/name.", 400);
  try {
    const workflow = await github<{ state?: string }>(
      `/repos/${parsed.owner}/${parsed.repo}/actions/workflows/${encodeURIComponent(file)}`,
    );
    return workflow.state === "active" ? "ready" : "disabled";
  } catch (error) {
    if (error instanceof GitHubApiError && error.status === 404) return "missing";
    if (error instanceof GitHubApiError && error.status === 403) return "forbidden";
    throw error;
  }
}

/** Starts a workflow on `ref`. GitHub answers before the run exists; find it with listWorkflowRuns. */
export async function dispatchWorkflow(
  fullName: string,
  file: string,
  ref: string,
  inputs: Record<string, string>,
): Promise<void> {
  const parsed = repoName(fullName);
  if (!parsed) throw new GitHubApiError("bad_repo", "Use a repository like owner/name.", 400);
  await github(`/repos/${parsed.owner}/${parsed.repo}/actions/workflows/${encodeURIComponent(file)}/dispatches`, {
    method: "POST",
    body: JSON.stringify({ ref, inputs }),
  });
}

export interface GitHubWorkflowRun {
  id: number;
  status: string;
  conclusion: string | null;
  url: string;
  createdAt: string;
}

/** Runs of a workflow that were started by hand or by the API on one branch, newest first. */
export async function listWorkflowRuns(fullName: string, file: string, branch: string): Promise<GitHubWorkflowRun[]> {
  const parsed = repoName(fullName);
  if (!parsed) throw new GitHubApiError("bad_repo", "Use a repository like owner/name.", 400);
  const result = await github<{
    workflow_runs?: { id?: number; status?: string; conclusion?: string | null; html_url?: string; created_at?: string }[];
  }>(
    `/repos/${parsed.owner}/${parsed.repo}/actions/workflows/${encodeURIComponent(file)}/runs` +
      `?branch=${encodeURIComponent(branch)}&event=workflow_dispatch&per_page=5`,
  );
  return (result.workflow_runs ?? [])
    .filter((run) => typeof run.id === "number")
    .map((run) => ({
      id: run.id as number,
      status: run.status ?? "",
      conclusion: run.conclusion ?? null,
      url: run.html_url ?? "",
      createdAt: run.created_at ?? "",
    }));
}

/** Stops a workflow run. A run that already ended cannot be cancelled, which is fine. */
export async function cancelWorkflowRun(fullName: string, runId: number): Promise<void> {
  const parsed = repoName(fullName);
  if (!parsed) throw new GitHubApiError("bad_repo", "Use a repository like owner/name.", 400);
  try {
    await github(`/repos/${parsed.owner}/${parsed.repo}/actions/runs/${runId}/cancel`, { method: "POST" });
  } catch (error) {
    if (!(error instanceof GitHubApiError) || error.status !== 409) throw error;
  }
}

export interface GitHubPullState {
  state: "open" | "closed";
  merged: boolean;
  headSha: string;
}

export async function getPull(fullName: string, number: number): Promise<GitHubPullState> {
  const parsed = repoName(fullName);
  if (!parsed) throw new GitHubApiError("bad_repo", "Use a repository like owner/name.", 400);
  const pull = await github<{ state?: string; merged?: boolean; head?: { sha?: string; }; }>(
    `/repos/${parsed.owner}/${parsed.repo}/pulls/${number}`
  );
  return {
    state: pull.state === "closed" ? "closed" : "open",
    merged: Boolean(pull.merged),
    headSha: pull.head?.sha ?? "",
  };
}

export async function mergePull(fullName: string, number: number, title: string): Promise<void> {
  const parsed = repoName(fullName);
  if (!parsed) throw new GitHubApiError("bad_repo", "Use a repository like owner/name.", 400);
  await github(`/repos/${parsed.owner}/${parsed.repo}/pulls/${number}/merge`, {
    method: "PUT",
    body: JSON.stringify({ merge_method: "squash", commit_title: title.slice(0, 120) }),
  });
}

/** Deletes a Kismet branch. Other branches, including the default branch, are left alone. */
export async function deleteBranch(fullName: string, branch: string): Promise<void> {
  const parsed = repoName(fullName);
  if (!parsed || !branch.startsWith("kismet/")) return;
  const ref = `heads/${branch.replaceAll("/", "%2F")}`;
  await github(`/repos/${parsed.owner}/${parsed.repo}/git/refs/${ref}`, { method: "DELETE" });
}

export async function closePull(fullName: string, number: number): Promise<void> {
  const parsed = repoName(fullName);
  if (!parsed) throw new GitHubApiError("bad_repo", "Use a repository like owner/name.", 400);
  await github(`/repos/${parsed.owner}/${parsed.repo}/pulls/${number}`, {
    method: "PATCH",
    body: JSON.stringify({ state: "closed" }),
  });
}

/** The combined result of the checks GitHub knows about for a commit (the Vercel preview build among them). */
export async function commitChecks(fullName: string, sha: string): Promise<"pending" | "success" | "failure" | "none"> {
  const parsed = repoName(fullName);
  if (!parsed || !sha) return "none";
  const status = await github<{ state?: string; total_count?: number }>(
    `/repos/${parsed.owner}/${parsed.repo}/commits/${sha}/status`
  );
  const runs = await github<{ check_runs?: { status?: string; conclusion?: string | null }[] }>(
    `/repos/${parsed.owner}/${parsed.repo}/commits/${sha}/check-runs`
  );
  const results: string[] = [];
  if (status.total_count) results.push(status.state ?? "pending");
  for (const run of runs.check_runs ?? []) {
    if (run.status !== "completed") results.push("pending");
    else {
      results.push(
        run.conclusion === "success" || run.conclusion === "neutral" || run.conclusion === "skipped"
          ? "success"
          : "failure",
      );
    }
  }
  if (results.length === 0) return "none";
  if (results.includes("failure") || results.includes("error")) return "failure";
  if (results.includes("pending")) return "pending";
  return "success";
}

let repoNotesAt = 0;
let repoNotes = "";

/** Open issues and pull requests, for a workspace that does not have Slack yet. */
export async function recentRepoNotes(): Promise<string> {
  if (Date.now() - repoNotesAt < 60_000 && repoNotes) return repoNotes;
  const named = process.env.KISMET_GITHUB_REPO?.trim() ?? "";
  let fullName = repoName(named) ? named : "";
  if (!fullName) {
    const repos = await listWritableRepos();
    fullName = repos[0]?.fullName ?? "";
  }
  const parsed = repoName(fullName);
  if (!parsed) return "";
  const issues = await github<{ number?: number; title?: string; pull_request?: unknown }[]>(
    `/repos/${parsed.owner}/${parsed.repo}/issues?state=open&per_page=8&sort=updated`,
  );
  const lines = issues
    .filter((issue) => typeof issue.number === "number" && typeof issue.title === "string")
    .map((issue) => `- #${issue.number} ${issue.pull_request ? "pull request" : "issue"}: ${issue.title}`);
  repoNotes = lines.length ? `Open work on ${fullName}:\n${lines.join("\n")}` : "";
  repoNotesAt = Date.now();
  return repoNotes;
}

export function githubErrorResponse(error: unknown): Response {
  if (error instanceof GitHubApiError) {
    return Response.json({ error: error.code, hint: error.hint }, { status: error.status });
  }
  console.error("[github]", error);
  return Response.json({ error: "unknown_error" }, { status: 500 });
}

export function isUiPath(path: string): boolean {
  if (path.includes("..") || path.startsWith("/") || path.includes("node_modules")) return false;
  return /^(app|src\/app|pages|src\/pages|components|src\/components)\/[A-Za-z0-9_./-]+\.(tsx|jsx)$/.test(path);
}

export function rankUiPath(path: string): number {
  if (path.endsWith("/page.tsx") || path.endsWith("/page.jsx")) return 0;
  if (path.endsWith("page.tsx") || path.endsWith("index.tsx")) return 1;
  if (path.includes("pricing") || path.includes("hero") || path.includes("landing")) return 2;
  return 3;
}
