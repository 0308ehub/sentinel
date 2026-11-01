import "server-only";

import { JiraApiError, getJiraStatus, jiraConnectionKey, listRecentIssues } from "@/lib/jira/client";

const CACHE_MS = 60_000;
const MAX_ISSUES = 15;
const MAX_CHARS = 16_000;

const cache = new Map<string, { at: number; text: string; keys: string[]; site: string }>();

export async function getJiraContext(): Promise<{
  configured: boolean;
  text: string;
  keys: string[];
  site: string;
}> {
  const key = await jiraConnectionKey();
  if (!key) {
    return { configured: false, text: "", keys: [], site: "" };
  }
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_MS) {
    return { configured: true, text: cached.text, keys: cached.keys, site: cached.site };
  }

  const issues = await listRecentIssues(MAX_ISSUES);
  const status = await getJiraStatus();
  const site = status.connected ? (status.site ?? "").replace(/^https:\/\//, "") : "";
  const blocks = issues.map((issue) => {
    const detail = issue.description ? `\n${issue.description}` : "";
    return `${issue.key} [${issue.status}] ${issue.summary} — ${issue.assignee}${detail}`;
  });
  const text = blocks.join("\n\n").slice(0, MAX_CHARS);
  const keys = issues.map((issue) => issue.key);
  cache.set(key, { at: Date.now(), text, keys, site });
  return { configured: true, text, keys, site };
}

export function jiraContextError(error: unknown): string {
  if (error instanceof JiraApiError) return error.hint ?? error.code;
  return "Jira could not be read.";
}
