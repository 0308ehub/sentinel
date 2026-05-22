import type { ZendeskConfig, ImportedDocument } from "./types";

function zendeskHeaders(config: ZendeskConfig) {
  const creds = Buffer.from(`${config.email}/token:${config.apiToken}`).toString("base64");
  return { Authorization: `Basic ${creds}`, "Content-Type": "application/json" };
}

export async function testZendeskConnection(config: ZendeskConfig) {
  const res = await fetch(`https://${config.subdomain}.zendesk.com/api/v2/users/me`, {
    headers: zendeskHeaders(config),
  });
  if (!res.ok) throw new Error("Invalid Zendesk credentials");
  const data = (await res.json()) as Record<string, unknown>;
  const user = data.user as Record<string, string>;
  return user.email;
}

export async function syncZendesk(config: ZendeskConfig, maxTickets = 100): Promise<ImportedDocument[]> {
  const updatedSince = config.lastSyncedAt ?? new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const base = `https://${config.subdomain}.zendesk.com/api/v2`;
  const headers = zendeskHeaders(config);

  const res = await fetch(
    `${base}/tickets.json?sort_by=updated_at&sort_order=desc&per_page=${maxTickets}`,
    { headers }
  );
  const data = (await res.json()) as Record<string, unknown>;
  const tickets = (data.tickets as unknown[]) ?? [];
  const docs: ImportedDocument[] = [];

  for (const ticket of tickets) {
    const t = ticket as Record<string, unknown>;
    if (config.lastSyncedAt && (t.updated_at as string) < updatedSince) continue;

    try {
      const commentsRes = await fetch(`${base}/tickets/${t.id}/comments.json`, { headers });
      const commentsData = (await commentsRes.json()) as Record<string, unknown>;
      const comments = ((commentsData.comments as unknown[]) ?? [])
        .map((c) => {
          const comment = c as Record<string, unknown>;
          return `[${comment.public ? "Customer" : "Agent"}]: ${comment.body}`;
        })
        .join("\n");

      const text = [
        `Status: ${t.status}`,
        `Priority: ${t.priority ?? "normal"}`,
        `\nDescription:\n${t.description}`,
        comments ? `\nConversation:\n${comments}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      docs.push({
        title: `[#${t.id}] ${t.subject}`,
        externalId: String(t.id),
        text,
        sourceType: "ZENDESK",
        metadata: { status: t.status as string, priority: (t.priority as string) ?? "normal" },
      });
    } catch {
      // skip individual ticket errors
    }
  }

  return docs;
}
