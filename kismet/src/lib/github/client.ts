import "server-only";

const API = "https://api.github.com";
const MISSING =
  "Add GITHUB_TOKEN to .env and restart the dev server. Create a fine-grained token at https://github.com/settings/tokens with Contents read and write, Pull requests read and write, and Metadata read on the repository you will test. A classic token needs the repo scope. Fork the app into your account first.";

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

interface RepoPayload {
  full_name?: string;
  private?: boolean;
  default_branch?: string;
  description?: string | null;
  permissions?: { push?: boolean };
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

function token(): string {
  const value = process.env.GITHUB_TOKEN?.trim();
  if (!value) throw new GitHubApiError("missing_token", MISSING, 503);
  return value;
}

export function repoName(value: string): { owner: string; repo: string } | null {
  const match = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/.exec(value.trim());
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

async function github<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token()}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "kismet",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (res.status === 401) {
    throw new GitHubApiError("unauthorized", "GitHub rejected GITHUB_TOKEN. Create a new token and restart the dev server.", 401);
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new GitHubApiError("github_error", body.message || "GitHub request failed.", res.status);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function githubAccount(): Promise<GitHubAccount> {
  const user = await github<{ login?: string }>("/user");
  if (!user.login) throw new GitHubApiError("github_error", "GitHub did not return an account.", 502);
  return { login: user.login };
}

export async function listWritableRepos(): Promise<GitHubRepoSummary[]> {
  const rows = await github<RepoPayload[]>("/user/repos?per_page=50&sort=updated&affiliation=owner,collaborator,organization_member");
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

export async function listUiFiles(fullName: string, branch: string): Promise<string[]> {
  const parsed = repoName(fullName);
  if (!parsed) throw new GitHubApiError("bad_repo", "Use a repository like owner/name.", 400);
  const tree = await github<TreePayload>(
    `/repos/${parsed.owner}/${parsed.repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`
  );
  const paths = (tree.tree ?? [])
    .filter((item) => item.type === "blob" && item.path && isUiPath(item.path))
    .map((item) => item.path as string);
  paths.sort((a, b) => rank(a) - rank(b) || a.length - b.length);
  return paths.slice(0, 24);
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
  const head = await github<{ object?: { sha?: string } }>(
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
  if (!pull.number || !pull.html_url) throw new GitHubApiError("github_error", "GitHub did not open the pull request.", 502);
  return { number: pull.number, url: pull.html_url, branch: input.branch };
}

export function githubErrorResponse(error: unknown): Response {
  if (error instanceof GitHubApiError) {
    return Response.json({ error: error.code, hint: error.hint }, { status: error.status });
  }
  console.error("[github]", error);
  return Response.json({ error: "unknown_error" }, { status: 500 });
}

function isUiPath(path: string): boolean {
  if (path.includes("..") || path.startsWith("/") || path.includes("node_modules")) return false;
  return /^(app|src\/app|pages|src\/pages|components|src\/components)\/[A-Za-z0-9_./-]+\.(tsx|jsx)$/.test(path);
}

function rank(path: string): number {
  if (path.endsWith("/page.tsx") || path.endsWith("/page.jsx")) return 0;
  if (path.endsWith("page.tsx") || path.endsWith("index.tsx")) return 1;
  if (path.includes("pricing") || path.includes("hero") || path.includes("landing")) return 2;
  return 3;
}
