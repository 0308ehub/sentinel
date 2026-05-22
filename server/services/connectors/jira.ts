import type { JiraConfig, ImportedDocument } from "./types";

function jiraHeaders(config: JiraConfig) {
  const creds = Buffer.from(`${config.email}:${config.apiToken}`).toString("base64");
  return { Authorization: `Basic ${creds}`, "Content-Type": "application/json" };
}

export async function testJiraConnection(config: JiraConfig) {
  const res = await fetch(`https://${config.domain}/rest/api/3/myself`, {
    headers: jiraHeaders(config),
  });
  if (!res.ok) throw new Error("Invalid Jira credentials");
  const data = (await res.json()) as Record<string, string>;
  return data.emailAddress;
}

export async function listJiraProjects(config: JiraConfig) {
  const res = await fetch(`https://${config.domain}/rest/api/3/project`, {
    headers: jiraHeaders(config),
  });
  const data = (await res.json()) as unknown[];
  return data.map((p) => {
    const proj = p as Record<string, string>;
    return { key: proj.key, name: proj.name };
  });
}

export async function syncJira(config: JiraConfig, maxIssues = 100): Promise<ImportedDocument[]> {
  const projectJql = config.projectKeys?.length
    ? `project in (${config.projectKeys.join(",")}) AND `
    : "";
  const updatedJql = config.lastSyncedAt
    ? `updated >= "${config.lastSyncedAt.slice(0, 10)}" AND `
    : "";
  const jql = `${projectJql}${updatedJql}issuetype in (Bug, Story, Task, "Feature Request") ORDER BY updated DESC`;

  const res = await fetch(
    `https://${config.domain}/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=${maxIssues}&fields=summary,description,status,priority,comment,issuetype,assignee,reporter,labels`,
    { headers: jiraHeaders(config) }
  );
  const data = (await res.json()) as Record<string, unknown>;
  const issues = (data.issues as unknown[]) ?? [];

  return issues.map((issue) => {
    const i = issue as Record<string, unknown>;
    const fields = i.fields as Record<string, unknown>;
    const summary = fields.summary as string;
    const status = (fields.status as Record<string, string>)?.name ?? "";
    const priority = (fields.priority as Record<string, string>)?.name ?? "";
    const issueType = (fields.issuetype as Record<string, string>)?.name ?? "";
    const description = extractJiraDescription(fields.description);
    const comments = ((fields.comment as Record<string, unknown[]>)?.comments ?? [])
      .slice(0, 10)
      .map((c) => {
        const cm = c as Record<string, unknown>;
        const author = ((cm.author as Record<string, string>)?.displayName) ?? "Unknown";
        const body = extractJiraDescription(cm.body);
        return `[${author}]: ${body}`;
      })
      .join("\n");

    const text = [
      `Type: ${issueType}`,
      `Status: ${status}`,
      `Priority: ${priority}`,
      `\nDescription:\n${description || "No description"}`,
      comments ? `\nComments:\n${comments}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    return {
      title: `[${i.key}] ${summary}`,
      externalId: i.id as string,
      text,
      sourceType: "JIRA",
      metadata: { key: i.key as string, status, priority, issueType },
    };
  });
}

function extractJiraDescription(doc: unknown): string {
  if (!doc || typeof doc !== "object") return "";
  const d = doc as Record<string, unknown>;
  if (d.type === "doc" && Array.isArray(d.content)) {
    return d.content.map(extractJiraText).join("\n");
  }
  if (typeof d === "string") return d;
  return "";
}

function extractJiraText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as Record<string, unknown>;
  if (n.type === "text") return (n.text as string) ?? "";
  if (Array.isArray(n.content)) return n.content.map(extractJiraText).join(" ");
  return "";
}
