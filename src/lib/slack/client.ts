import "server-only";

import type { SlackChannel, SlackMessage, SlackStatus } from "@/lib/slack/types";

const SLACK_API = "https://slack.com/api";

export class SlackApiError extends Error {
  constructor(
    public code: string,
    public hint?: string,
    public status = 502
  ) {
    super(code);
  }
}

const HINTS: Record<string, string> = {
  missing_token: "Add SLACK_BOT_TOKEN to .env and restart the dev server.",
  not_authed: "Add SLACK_BOT_TOKEN to .env and restart the dev server.",
  invalid_auth: "SLACK_BOT_TOKEN was rejected. Copy the Bot User OAuth Token (xoxb-…) again.",
  token_revoked: "The Slack app was uninstalled or the token was revoked. Reinstall the app.",
  account_inactive: "The Slack app was uninstalled or the token was revoked. Reinstall the app.",
  not_in_channel: "Invite the bot to this channel in Slack with /invite @YourAppName.",
  channel_not_found: "Channel not found, or the bot is not a member of this private channel.",
  ratelimited: "Slack rate limit hit. Wait a minute and refresh.",
};

function getToken(): string {
  const token = process.env.SLACK_BOT_TOKEN?.trim();
  if (!token) throw new SlackApiError("missing_token", HINTS.missing_token, 503);
  return token;
}

type SlackResponse = { ok: boolean; error?: string; needed?: string } & Record<string, unknown>;

async function callSlack<T extends SlackResponse>(
  method: string,
  params: Record<string, string | number | boolean | undefined> = {}
): Promise<T> {
  const url = new URL(`${SLACK_API}/${method}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${getToken()}` },
      cache: "no-store",
    });

    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("retry-after") ?? 1);
      if (attempt === 0 && retryAfter <= 5) {
        await new Promise((r) => setTimeout(r, retryAfter * 1000));
        continue;
      }
      throw new SlackApiError("ratelimited", HINTS.ratelimited, 429);
    }

    const body = (await res.json()) as T;
    if (!body.ok) {
      const code = body.error ?? "unknown_error";
      const hint =
        code === "missing_scope" && body.needed
          ? `The Slack app is missing the "${body.needed}" scope. Add it under OAuth & Permissions, then reinstall the app.`
          : HINTS[code];
      throw new SlackApiError(code, hint);
    }
    return body;
  }

  throw new SlackApiError("ratelimited", HINTS.ratelimited, 429);
}

let teamUrlCache: string | undefined;
let botUserIdCache: string | undefined;

export async function getBotUserId(): Promise<string> {
  if (botUserIdCache) return botUserIdCache;
  const auth = await callSlack<SlackResponse & { url?: string; user_id?: string }>("auth.test");
  teamUrlCache = auth.url;
  if (!auth.user_id) throw new SlackApiError("missing_bot", "Slack did not return the bot user.", 502);
  botUserIdCache = auth.user_id;
  return botUserIdCache;
}

export async function getSlackStatus(): Promise<SlackStatus> {
  const auth = await callSlack<SlackResponse & { team?: string; url?: string; user?: string; user_id?: string }>(
    "auth.test"
  );
  teamUrlCache = auth.url;
  if (auth.user_id) botUserIdCache = auth.user_id;
  return { connected: true, team: auth.team, teamUrl: auth.url, botName: auth.user };
}

async function postSlack<T extends SlackResponse>(method: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${SLACK_API}/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getToken()}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const payload = (await res.json()) as T;
  if (!payload.ok) {
    const code = payload.error ?? "unknown_error";
    const hint =
      code === "missing_scope" && payload.needed
        ? `The Slack app is missing the "${payload.needed}" scope. Add it under OAuth & Permissions, then reinstall the app.`
        : HINTS[code];
    throw new SlackApiError(code, hint);
  }
  return payload;
}

export async function postSlackMessage(channelId: string, text: string, threadTs?: string): Promise<void> {
  await postSlack("chat.postMessage", {
    channel: channelId,
    text: text.slice(0, 3000),
    thread_ts: threadTs,
    unfurl_links: false,
  });
}

export async function slackUserName(userId: string): Promise<string> {
  return (await resolveUser(userId)).name;
}

export interface SlackHistoryItem {
  ts: string;
  userId?: string;
  text: string;
  threadTs?: string;
}

export async function listRecentMessages(channelId: string, oldest?: string): Promise<SlackHistoryItem[]> {
  const res = await callSlack<SlackResponse & { messages?: RawSlackMessage[] }>("conversations.history", {
    channel: channelId,
    limit: 25,
    oldest,
  });
  return (res.messages ?? []).map((message) => ({
    ts: message.ts,
    userId: message.user,
    text: message.text ?? "",
    threadTs: message.thread_ts,
  }));
}

export async function listBotChannels(): Promise<SlackChannel[]> {
  try {
    return await listBotChannelsOfTypes("public_channel,private_channel");
  } catch (error) {
    // Private channels need the groups:read scope; still list public ones without it.
    if (error instanceof SlackApiError && error.code === "missing_scope") {
      return listBotChannelsOfTypes("public_channel");
    }
    throw error;
  }
}

async function listBotChannelsOfTypes(types: string): Promise<SlackChannel[]> {
  const channels: SlackChannel[] = [];
  let cursor: string | undefined;

  do {
    const page = await callSlack<
      SlackResponse & {
        channels: {
          id: string;
          name: string;
          is_private: boolean;
          topic?: { value?: string };
          num_members?: number;
        }[];
        response_metadata?: { next_cursor?: string };
      }
    >("users.conversations", {
      types,
      exclude_archived: true,
      limit: 200,
      cursor,
    });

    for (const c of page.channels) {
      channels.push({
        id: c.id,
        name: c.name,
        isPrivate: c.is_private,
        topic: c.topic?.value || undefined,
        memberCount: c.num_members,
      });
    }
    cursor = page.response_metadata?.next_cursor || undefined;
  } while (cursor);

  return channels.sort((a, b) => a.name.localeCompare(b.name));
}

interface RawSlackMessage {
  ts: string;
  thread_ts?: string;
  user?: string;
  bot_id?: string;
  username?: string;
  subtype?: string;
  text?: string;
  reply_count?: number;
  latest_reply?: string;
  bot_profile?: { name?: string };
}

const userCache = new Map<string, { name: string; avatar?: string }>();

async function resolveUser(userId: string): Promise<{ name: string; avatar?: string }> {
  const cached = userCache.get(userId);
  if (cached) return cached;
  try {
    const res = await callSlack<
      SlackResponse & {
        user: {
          name: string;
          real_name?: string;
          profile?: { display_name?: string; real_name?: string; image_48?: string };
        };
      }
    >("users.info", { user: userId });
    const p = res.user.profile;
    const resolved = {
      name: p?.display_name || p?.real_name || res.user.real_name || res.user.name,
      avatar: p?.image_48,
    };
    userCache.set(userId, resolved);
    return resolved;
  } catch {
    return { name: userId };
  }
}

function slackTsToIso(ts: string): string {
  return new Date(Number(ts) * 1000).toISOString();
}

function permalinkFor(channelId: string, ts: string, threadTs?: string): string | undefined {
  if (!teamUrlCache) return undefined;
  const base = `${teamUrlCache}archives/${channelId}/p${ts.replace(".", "")}`;
  return threadTs && threadTs !== ts ? `${base}?thread_ts=${threadTs}&cid=${channelId}` : base;
}

/** Converts Slack mrkdwn tokens (<@U1>, <#C1|name>, <url|label>) into readable text. */
async function formatText(text: string): Promise<string> {
  const mentionIds = Array.from(text.matchAll(/<@([UW][A-Z0-9]+)(?:\|[^>]+)?>/g), (m) => m[1]);
  const names = new Map<string, string>();
  await Promise.all(
    Array.from(new Set(mentionIds)).map(async (id) => names.set(id, (await resolveUser(id)).name))
  );

  return text
    .replace(/<@([UW][A-Z0-9]+)(?:\|[^>]+)?>/g, (_, id: string) => `@${names.get(id) ?? id}`)
    .replace(/<#[CG][A-Z0-9]+\|([^>]*)>/g, (_, name: string) => `#${name}`)
    .replace(/<!(here|channel|everyone)>/g, "@$1")
    .replace(/<(https?:[^|>]+)\|([^>]+)>/g, "$2 ($1)")
    .replace(/<(https?:[^>]+)>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

const SKIPPED_SUBTYPES = new Set(["channel_join", "channel_leave", "channel_purpose", "channel_topic"]);

async function toMessages(channelId: string, raw: RawSlackMessage[]): Promise<SlackMessage[]> {
  if (!teamUrlCache) await getSlackStatus().catch(() => undefined);

  const visible = raw.filter((m) => !m.subtype || !SKIPPED_SUBTYPES.has(m.subtype));
  return Promise.all(
    visible.map(async (m) => {
      const author = m.user
        ? await resolveUser(m.user)
        : { name: m.bot_profile?.name ?? m.username ?? "Bot" };
      return {
        ts: m.ts,
        threadTs: m.thread_ts,
        userId: m.user,
        userName: author.name,
        userAvatar: "avatar" in author ? author.avatar : undefined,
        text: await formatText(m.text ?? ""),
        postedAt: slackTsToIso(m.ts),
        replyCount: m.reply_count ?? 0,
        latestReplyAt: m.latest_reply ? slackTsToIso(m.latest_reply) : undefined,
        permalink: permalinkFor(channelId, m.ts, m.thread_ts),
      };
    })
  );
}

export async function getChannelMessages(channelId: string, limit = 50): Promise<SlackMessage[]> {
  const res = await callSlack<SlackResponse & { messages: RawSlackMessage[] }>(
    "conversations.history",
    { channel: channelId, limit }
  );
  return toMessages(channelId, res.messages);
}

export async function getThreadReplies(channelId: string, threadTs: string): Promise<SlackMessage[]> {
  const res = await callSlack<SlackResponse & { messages: RawSlackMessage[] }>(
    "conversations.replies",
    { channel: channelId, ts: threadTs, limit: 200 }
  );
  return toMessages(channelId, res.messages);
}

export const CHANNEL_ID_PATTERN = /^[CG][A-Z0-9]{6,}$/;
export const SLACK_TS_PATTERN = /^\d{9,11}\.\d{1,6}$/;

export function slackErrorResponse(error: unknown): Response {
  if (error instanceof SlackApiError) {
    return Response.json({ error: error.code, hint: error.hint }, { status: error.status });
  }
  console.error("[slack]", error);
  return Response.json({ error: "unknown_error" }, { status: 500 });
}
