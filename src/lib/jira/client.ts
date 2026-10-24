import "server-only";

import type { JiraIssue, JiraStatus } from "@/lib/jira/types";

export class JiraApiError extends Error {
  constructor(
    public code: string,
    public hint?: string,
    public status = 502
  ) {
    super(code);
  }
}

const MISSING =
  "Add JIRA_BASE_URL, JIRA_EMAIL, and JIRA_API_TOKEN to .env, then restart the dev server. The site URL is the address in the browser on the Kismet Jira workspace, like https://your-site.atlassian.net. Create the API token at https://id.atlassian.com/manage-profile/security/api-tokens while signed into that Atlassian account.";

interface JiraConfig {
  base: string;
  email: string;
  token: string;
}

function blockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return true;
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!ipv4) return false;
  const [a, b] = ipv4.slice(1).map(Number);
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

function readConfig(): JiraConfig | null {
  const raw = process.env.JIRA_BASE_URL?.trim();
  const email = process.env.JIRA_EMAIL?.trim();
  const token = process.env.JIRA_API_TOKEN?.trim();
  if (!raw || !email || !token) return null;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new JiraApiError("invalid_site", "JIRA_BASE_URL should look like https://your-site.atlassian.net", 503);
  }
  if (url.protocol !== "https:" || blockedHost(url.hostname)) {
    throw new JiraApiError("invalid_site", "JIRA_BASE_URL should be the https address of the Jira Cloud site.", 503);
  }
  return { base: url.origin, email, token };
}

async function callJira<T>(config: JiraConfig, path: string, init?: RequestInit): Promise<T> {
  const auth = Buffer.from(`${config.email}:${config.token}`).toString("base64");
  const res = await fetch(`${config.base}${path}`, {
    ...init,
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (res.status === 401) {
    throw new JiraApiError(
      "unauthorized",
      "Jira rejected the email or API token. Create a new token at https://id.atlassian.com/manage-profile/security/api-tokens for the same account as JIRA_EMAIL.",
      401
    );
  }
  if (res.status === 403) {
    throw new JiraApiError(
      "forbidden",
      "This Atlassian account can sign in, but it cannot read issues on this site. Use an account that can open the Kismet Jira workspace.",
      403
    );
  }
  if (res.status === 404) {
    throw new JiraApiError(
      "not_found",
      "That Jira site was not found. JIRA_BASE_URL should be the site root, like https://your-site.atlassian.net.",
      404
    );
  }
  if (!res.ok) {
    throw new JiraApiError("jira_error", `Jira returned ${res.status}.`, res.status);
  }
  const raw = await res.text();
  if (!raw) return {} as T;
  return JSON.parse(raw) as T;
}

function adfToText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const current = node as { text?: string; content?: unknown[] };
  const own = typeof current.text === "string" ? current.text : "";
  const children = Array.isArray(current.content) ? current.content.map(adfToText).join(" ") : "";
  return `${own} ${children}`.replace(/\s+/g, " ").trim();
}

interface Myself {
  displayName?: string;
  emailAddress?: string;
  accountId?: string;
}

interface ProjectSearch {
  values?: { name?: string; key?: string }[];
}

interface AgileList<T> {
  values?: T[];
}

interface SearchResponse {
  issues?: {
    key?: string;
    fields?: {
      summary?: string;
      description?: unknown;
      updated?: string;
      status?: { name?: string };
      issuetype?: { name?: string };
      project?: { name?: string; key?: string };
      assignee?: { displayName?: string } | null;
    };
  }[];
}

export async function getJiraStatus(): Promise<JiraStatus> {
  let config: JiraConfig | null;
  try {
    config = readConfig();
  } catch (error) {
    if (error instanceof JiraApiError) return { connected: false, error: error.hint ?? error.code };
    throw error;
  }
  if (!config) return { connected: false, error: MISSING };

  const [me, projects] = await Promise.all([
    callJira<Myself>(config, "/rest/api/3/myself"),
    callJira<ProjectSearch>(config, "/rest/api/3/project/search?maxResults=20"),
  ]);

  return {
    connected: true,
    site: config.base,
    siteName: config.base.replace(/^https:\/\//, ""),
    account: me.displayName || me.emailAddress,
    projects: (projects.values ?? [])
      .map((project) => project.name || project.key || "")
      .filter(Boolean)
      .slice(0, 12),
  };
}

export async function listRecentIssues(limit = 20): Promise<JiraIssue[]> {
  const config = readConfig();
  if (!config) throw new JiraApiError("missing_config", MISSING, 503);

  const body = await callJira<SearchResponse>(config, "/rest/api/3/search/jql", {
    method: "POST",
    body: JSON.stringify({
      jql: "updated >= -90d ORDER BY updated DESC",
      maxResults: Math.min(Math.max(limit, 1), 50),
      fields: ["summary", "status", "issuetype", "project", "assignee", "updated", "description"],
    }),
  });

  return (body.issues ?? [])
    .filter((issue) => issue.key && issue.fields?.summary)
    .map((issue) => ({
      key: issue.key!,
      summary: issue.fields!.summary!,
      status: issue.fields?.status?.name ?? "Unknown",
      type: issue.fields?.issuetype?.name ?? "Issue",
      project: issue.fields?.project?.name || issue.fields?.project?.key || "",
      assignee: issue.fields?.assignee?.displayName ?? "Unassigned",
      updated: issue.fields?.updated ?? "",
      url: `${config.base}/browse/${issue.key}`,
      description: adfToText(issue.fields?.description).slice(0, 500),
    }));
}

export async function findJiraAccount(name: string): Promise<{ accountId: string; displayName: string } | null> {
  const config = readConfig();
  const query = name.trim();
  if (!config || !query) return null;
  const users = await callJira<{ accountId?: string; displayName?: string }[]>(
    config,
    `/rest/api/3/user/search?query=${encodeURIComponent(query)}&maxResults=10`
  );
  const wanted = query.toLowerCase();
  const match =
    users.find((user) => user.displayName?.toLowerCase() === wanted) ??
    users.find((user) => user.displayName?.toLowerCase().includes(wanted)) ??
    users[0];
  if (!match?.accountId || !match.displayName) return null;
  return { accountId: match.accountId, displayName: match.displayName };
}

export async function assignJiraIssue(key: string, accountId: string): Promise<void> {
  if (!/^[A-Z][A-Z0-9]+-\d+$/.test(key)) {
    throw new JiraApiError("bad_key", "That is not a Jira issue key.", 400);
  }
  const config = readConfig();
  if (!config) throw new JiraApiError("missing_config", MISSING, 503);
  await callJira(config, `/rest/api/3/issue/${encodeURIComponent(key)}/assignee`, {
    method: "PUT",
    body: JSON.stringify({ accountId }),
  });
}

export async function createFeatureIssue(input: {
  title: string;
  description: string;
  assigneeAccountId?: string;
}): Promise<{ key: string; url: string; sprint?: string }> {
  const config = readConfig();
  if (!config) throw new JiraApiError("missing_config", MISSING, 503);

  const [me, projects] = await Promise.all([
    callJira<Myself>(config, "/rest/api/3/myself"),
    callJira<ProjectSearch>(config, "/rest/api/3/project/search?maxResults=20"),
  ]);
  const projectKey = process.env.JIRA_PROJECT_KEY?.trim() || projects.values?.find((project) => project.key)?.key;
  if (!projectKey) throw new JiraApiError("no_project", "No Jira project was found for this site.", 404);

  const description = {
    type: "doc",
    version: 1,
    content: input.description
      .split(/\n+/)
      .filter(Boolean)
      .slice(0, 20)
      .map((line) => ({
        type: "paragraph",
        content: [{ type: "text", text: line.slice(0, 2000) }],
      })),
  };

  let created: { key?: string } | null = null;
  let lastError: unknown;
  const attempts = input.assigneeAccountId
    ? [
        { issueType: "Task", accountId: input.assigneeAccountId },
        { issueType: "Story", accountId: input.assigneeAccountId },
        { issueType: "Task", accountId: undefined },
      ]
    : [
        { issueType: "Task", accountId: me.accountId },
        { issueType: "Story", accountId: me.accountId },
        { issueType: "Task", accountId: undefined },
      ];
  for (const attempt of attempts) {
    try {
      created = await callJira<{ key?: string }>(config, "/rest/api/3/issue", {
        method: "POST",
        body: JSON.stringify({
          fields: {
            project: { key: projectKey },
            summary: input.title.slice(0, 240),
            description,
            issuetype: { name: attempt.issueType },
            ...(attempt.accountId ? { assignee: { accountId: attempt.accountId } } : {}),
          },
        }),
      });
      break;
    } catch (error) {
      lastError = error;
    }
  }
  if (!created?.key) {
    throw lastError instanceof JiraApiError
      ? lastError
      : new JiraApiError("issue_failed", "Jira did not create the issue.", 502);
  }

  let sprint: string | undefined;
  try {
    const boards = await callJira<AgileList<{ id?: number }>>(
      config,
      `/rest/agile/1.0/board?projectKeyOrId=${encodeURIComponent(projectKey)}`
    );
    const boardId = boards.values?.find((board) => board.id)?.id;
    if (boardId) {
      const active = await callJira<AgileList<{ id?: number; name?: string }>>(
        config,
        `/rest/agile/1.0/board/${boardId}/sprint?state=active`
      );
      const current = active.values?.find((item) => item.id);
      if (current?.id) {
        await callJira(config, `/rest/agile/1.0/sprint/${current.id}/issue`, {
          method: "POST",
          body: JSON.stringify({ issues: [created.key] }),
        });
        sprint = current.name;
      }
    }
  } catch {
    sprint = undefined;
  }

  return { key: created.key, url: `${config.base}/browse/${created.key}`, sprint };
}

export function jiraErrorResponse(error: unknown): Response {
  if (error instanceof JiraApiError) {
    return Response.json({ error: error.code, hint: error.hint }, { status: error.status });
  }
  console.error("[jira]", error);
  return Response.json({ error: "unknown_error" }, { status: 500 });
}
