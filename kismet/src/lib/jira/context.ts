import "server-only";

import { JiraApiError, listRecentIssues } from "@/lib/jira/client";

const CACHE_MS = 60_000;
const MAX_ISSUES = 15;
const MAX_CHARS = 16_000;

let cache: { at: number; text: string; keys: string[]; site: string } | null = null;

export async function getJiraContext(): Promise<{
  configured: boolean;
  text: string;
  keys: string[];
  site: string;
}> {
  if (!process.env.JIRA_BASE_URL?.trim() || !process.env.JIRA_EMAIL?.trim() || !process.env.JIRA_API_TOKEN?.trim()) {
    return { configured: false, text: "", keys: [], site: "" };
  }
  if (cache && Date.now() - cache.at < CACHE_MS) {
    return { configured: true, text: cache.text, keys: cache.keys, site: cache.site };
  }

  const issues = await listRecentIssues(MAX_ISSUES);
  const site = process.env.JIRA_BASE_URL.trim().replace(/\/+$/, "").replace(/^https:\/\//, "");
  const blocks = issues.map((issue) => {
    const detail = issue.description ? `\n${issue.description}` : "";
    return `${issue.key} [${issue.status}] ${issue.summary} — ${issue.assignee}${detail}`;
  });
  const text = blocks.join("\n\n").slice(0, MAX_CHARS);
  const keys = issues.map((issue) => issue.key);
  cache = { at: Date.now(), text, keys, site };
  return { configured: true, text, keys, site };
}

export function jiraContextError(error: unknown): string {
  if (error instanceof JiraApiError) return error.hint ?? error.code;
  return "Jira could not be read.";
}
