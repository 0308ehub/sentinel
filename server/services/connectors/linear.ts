import type { LinearConfig, ImportedDocument } from "./types";

const LINEAR_API = "https://api.linear.app/graphql";

async function linearQuery(apiKey: string, query: string, variables?: Record<string, unknown>) {
  const res = await fetch(LINEAR_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: apiKey },
    body: JSON.stringify({ query, variables }),
  });
  const json = (await res.json()) as { data?: unknown; errors?: unknown[] };
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

export async function testLinearConnection(apiKey: string) {
  const data = await linearQuery(apiKey, `{ viewer { name email } }`) as Record<string, unknown>;
  const viewer = data.viewer as Record<string, string>;
  return viewer.email;
}

interface CreateLinearIssueInput {
  title: string;
  description?: string;
  priority?: string;
  estimate?: string;
}

const PRIORITY_MAP: Record<string, number> = {
  LOW: 4,
  MEDIUM: 3,
  HIGH: 2,
  CRITICAL: 1,
};

export async function createLinearIssue(
  config: LinearConfig,
  input: CreateLinearIssueInput
): Promise<{ id: string; url: string }> {
  // First fetch teams to get the default team id
  const teamsData = (await linearQuery(config.apiKey, `{ teams { nodes { id name } } }`)) as Record<
    string,
    unknown
  >;
  const teams = ((teamsData.teams as Record<string, unknown[]>).nodes ?? []) as Array<
    Record<string, string>
  >;

  const teamId =
    (config.teamIds?.length ? config.teamIds[0] : null) ?? teams[0]?.id;
  if (!teamId) throw new Error("No Linear team available");

  const mutation = `
    mutation CreateIssue($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        success
        issue { id url }
      }
    }
  `;

  const variables = {
    input: {
      teamId,
      title: input.title,
      description: input.description ?? "",
      priority: PRIORITY_MAP[input.priority ?? "MEDIUM"] ?? 3,
    },
  };

  const data = (await linearQuery(config.apiKey, mutation, variables)) as Record<string, unknown>;
  const created = data.issueCreate as Record<string, unknown>;
  if (!created?.success) throw new Error("Linear issue creation failed");
  const issue = created.issue as Record<string, string>;
  return { id: issue.id, url: issue.url };
}

export async function syncLinear(config: LinearConfig, maxIssues = 100): Promise<ImportedDocument[]> {
  const after = config.lastSyncedAt
    ? `updatedAt: { gt: "${config.lastSyncedAt}" }`
    : "";
  const teamFilter = config.teamIds?.length
    ? `team: { id: { in: ${JSON.stringify(config.teamIds)} } }`
    : "";
  const filter = [after, teamFilter].filter(Boolean).join(", ");

  const query = `
    query Issues {
      issues(
        first: ${maxIssues}
        ${filter ? `filter: { ${filter} }` : ""}
        orderBy: updatedAt
      ) {
        nodes {
          id title description state { name }
          priority priorityLabel
          labels { nodes { name } }
          comments { nodes { body createdAt user { name } } }
          createdAt updatedAt
          team { name }
        }
      }
    }
  `;

  const data = await linearQuery(config.apiKey, query) as Record<string, unknown>;
  const issues = ((data.issues as Record<string, unknown>).nodes as unknown[]) ?? [];

  return issues.map((issue) => {
    const i = issue as Record<string, unknown>;
    const state = (i.state as Record<string, string>)?.name ?? "";
    const team = (i.team as Record<string, string>)?.name ?? "";
    const labels = ((i.labels as Record<string, unknown[]>)?.nodes ?? [])
      .map((l) => (l as Record<string, string>).name)
      .join(", ");
    const comments = ((i.comments as Record<string, unknown[]>)?.nodes ?? [])
      .map((c) => {
        const cm = c as Record<string, unknown>;
        const user = (cm.user as Record<string, string>)?.name ?? "Unknown";
        return `[${user}]: ${cm.body}`;
      })
      .join("\n");

    const text = [
      `Team: ${team}`,
      `Status: ${state}`,
      `Priority: ${i.priorityLabel ?? ""}`,
      labels ? `Labels: ${labels}` : "",
      `\nDescription:\n${i.description ?? "No description"}`,
      comments ? `\nComments:\n${comments}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    return {
      title: i.title as string,
      externalId: i.id as string,
      text,
      sourceType: "LINEAR",
      metadata: { state, team, priority: String(i.priority ?? "") },
    };
  });
}
