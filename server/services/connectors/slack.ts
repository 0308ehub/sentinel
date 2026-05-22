import { WebClient } from "@slack/web-api";
import type { SlackConfig, ImportedDocument } from "./types";

export function getSlackAuthUrl(state: string) {
  const scopes = ["channels:history", "channels:read", "users:read"].join(",");
  return (
    `https://slack.com/oauth/v2/authorize` +
    `?client_id=${process.env.SLACK_CLIENT_ID}` +
    `&scope=${scopes}` +
    `&redirect_uri=${process.env.NEXT_PUBLIC_APP_URL}/api/auth/slack/callback` +
    `&state=${state}`
  );
}

export async function exchangeSlackCode(code: string) {
  const res = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.SLACK_CLIENT_ID!,
      client_secret: process.env.SLACK_CLIENT_SECRET!,
      code,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/slack/callback`,
    }),
  });
  const data = (await res.json()) as Record<string, unknown>;
  if (!data.ok) throw new Error(`Slack OAuth error: ${data.error}`);

  const team = data.team as Record<string, string>;
  return {
    botToken: (data.access_token as string),
    teamId: team.id,
    teamName: team.name,
    channelIds: [] as string[],
  };
}

export async function listSlackChannels(botToken: string) {
  const client = new WebClient(botToken);
  const res = await client.conversations.list({ types: "public_channel", limit: 200 });
  return (res.channels ?? []).map((c) => ({ id: c.id!, name: c.name! }));
}

export async function syncSlack(config: SlackConfig, maxMessages = 200): Promise<ImportedDocument[]> {
  const client = new WebClient(config.botToken);
  const docs: ImportedDocument[] = [];

  const oldest = config.oldestTs ?? String(Date.now() / 1000 - 30 * 24 * 3600);

  for (const channelId of config.channelIds) {
    try {
      // Get channel info
      const chanInfo = await client.conversations.info({ channel: channelId });
      const chanName = chanInfo.channel?.name ?? channelId;

      // Fetch message history
      const history = await client.conversations.history({
        channel: channelId,
        oldest,
        limit: maxMessages,
      });

      const messages = history.messages ?? [];
      if (messages.length === 0) continue;

      // Group messages into threads for context
      const threads = new Map<string, typeof messages>();
      for (const msg of messages) {
        const threadTs = msg.thread_ts ?? msg.ts!;
        if (!threads.has(threadTs)) threads.set(threadTs, []);
        threads.get(threadTs)!.push(msg);
      }

      for (const [threadTs, threadMsgs] of threads) {
        const text = threadMsgs
          .map((m) => `[${new Date(Number(m.ts) * 1000).toISOString()}] ${m.text ?? ""}`)
          .join("\n");
        if (!text.trim()) continue;

        docs.push({
          title: `#${chanName} — ${new Date(Number(threadTs) * 1000).toLocaleDateString()}`,
          externalId: `${channelId}:${threadTs}`,
          text: `Channel: #${chanName}\n\n${text}`,
          sourceType: "SLACK",
          metadata: { channelId, channelName: chanName, threadTs },
        });
      }
    } catch {
      // skip individual channel errors
    }
  }

  return docs;
}
