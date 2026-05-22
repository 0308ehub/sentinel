import type { IntercomConfig, ImportedDocument } from "./types";

export async function testIntercomConnection(accessToken: string) {
  const res = await fetch("https://api.intercom.io/me", {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error("Invalid Intercom credentials");
  const data = (await res.json()) as Record<string, unknown>;
  const app = data.app as Record<string, string>;
  return app?.name ?? "Unknown app";
}

export async function syncIntercom(config: IntercomConfig, maxConvs = 100): Promise<ImportedDocument[]> {
  const headers = { Authorization: `Bearer ${config.accessToken}`, Accept: "application/json" };
  const updatedSince = config.lastSyncedAt
    ? Math.floor(new Date(config.lastSyncedAt).getTime() / 1000)
    : Math.floor(Date.now() / 1000 - 30 * 24 * 3600);

  const res = await fetch(
    `https://api.intercom.io/conversations?per_page=${maxConvs}&updated_since=${updatedSince}`,
    { headers }
  );
  const data = (await res.json()) as Record<string, unknown>;
  const conversations = (data.conversations as unknown[]) ?? [];
  const docs: ImportedDocument[] = [];

  for (const conv of conversations) {
    const c = conv as Record<string, unknown>;
    const id = c.id as string;

    try {
      const detailRes = await fetch(`https://api.intercom.io/conversations/${id}`, { headers });
      const detail = (await detailRes.json()) as Record<string, unknown>;

      const source = detail.source as Record<string, unknown>;
      const subject = (source?.subject as string) || "Support Conversation";
      const body = stripHtml((source?.body as string) ?? "");
      const contact = ((detail.contacts as Record<string, unknown[]>)?.contacts?.[0] ?? {}) as Record<string, string>;

      const messages = ((detail.conversation_parts as Record<string, unknown[]>)?.conversation_parts ?? [])
        .filter((p) => {
          const part = p as Record<string, unknown>;
          return part.part_type === "comment" || part.part_type === "note";
        })
        .map((p) => {
          const part = p as Record<string, unknown>;
          const author = part.author as Record<string, string>;
          return `[${author?.name ?? "Unknown"}]: ${stripHtml((part.body as string) ?? "")}`;
        })
        .join("\n");

      const text = [
        contact.email ? `Customer: ${contact.email}` : "",
        `\nInitial message:\n${body}`,
        messages ? `\nConversation:\n${messages}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      docs.push({
        title: subject,
        externalId: id,
        text,
        sourceType: "INTERCOM",
        metadata: { customerEmail: contact.email ?? "" },
      });
    } catch {
      // skip individual conversation errors
    }
  }

  return docs;
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}
