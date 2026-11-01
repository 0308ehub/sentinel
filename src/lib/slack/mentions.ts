import "server-only";

import type postgres from "postgres";
import { askForJson, readJson } from "@/lib/ai/respond";
import { db } from "@/lib/autopilot/db";
import { currentUserId } from "@/lib/connections/current";
import { assignJiraIssue, createFeatureIssue, findJiraAccount, JiraApiError } from "@/lib/jira/client";
import {
  getBotUserId,
  listBotChannels,
  listRecentMessages,
  postSlackMessage,
  SlackApiError,
  slackUserName,
} from "@/lib/slack/client";
import type { SlackInboxItem } from "@/lib/slack/types";

export type { SlackInboxItem };

interface Store {
  bootstrapped: boolean;
  cursor: number;
  cursors: Record<string, string>;
  seen: string[];
  inbox: SlackInboxItem[];
}

interface Intent {
  action: "feature" | "assign" | "none";
  title: string;
  description: string;
  priority: SlackInboxItem["priority"];
  assignee: string;
  issueKey: string;
}

const PRIORITIES = new Set(["CRITICAL", "HIGH", "MEDIUM", "LOW"]);
const ISSUE_KEY = /\b[A-Z][A-Z0-9]+-\d+\b/;

const memory = new Map<string, Store>();
const chains = new Map<string, Promise<void>>();
const scanning = new Map<string, Promise<SlackInboxItem[]>>();

function emptyStore(): Store {
  return { bootstrapped: false, cursor: 0, cursors: {}, seen: [], inbox: [] };
}

async function load(userId: string): Promise<Store> {
  const cached = memory.get(userId);
  if (cached) return cached;
  const sql = await db();
  const rows = await sql<{ state: Partial<Store> }[]>`
    select state from kismet.slack_mentions where user_id = ${userId} limit 1
  `;
  const store = { ...emptyStore(), ...(rows[0]?.state ?? {}) };
  memory.set(userId, store);
  return store;
}

async function save(userId: string, store: Store): Promise<void> {
  memory.set(userId, store);
  const sql = await db();
  await sql`
    insert into kismet.slack_mentions (user_id, state)
    values (${userId}, ${sql.json(store as unknown as postgres.JSONValue)})
    on conflict (user_id) do update set state = excluded.state, updated_at = now()
  `;
}

function update<T>(userId: string, fn: (store: Store) => Promise<T>): Promise<T> {
  const chain = chains.get(userId) ?? Promise.resolve();
  const run = chain.then(() => load(userId).then(fn));
  chains.set(userId, run.then(
    () => undefined,
    () => undefined,
  ));
  return run;
}

async function mentionUserId(): Promise<string> {
  const userId = await currentUserId();
  if (!userId) throw new SlackApiError("not_connected", "Connect Slack in Settings → Connectors → Slack.", 503);
  return userId;
}

export async function pollSlackMentions(): Promise<SlackInboxItem[]> {
  const userId = await mentionUserId();
  let active = scanning.get(userId);
  if (!active) {
    active = scan(userId).finally(() => {
      scanning.delete(userId);
    });
    scanning.set(userId, active);
  }
  return active;
}

export async function acknowledgeSlackInbox(ids: string[]): Promise<void> {
  const userId = await mentionUserId();
  const drop = new Set(ids);
  return update(userId, async (store) => {
    store.inbox = store.inbox.filter((item) => !drop.has(item.id));
    await save(userId, store);
  });
}

export async function deleteSlackMentionState(userId: string): Promise<void> {
  await scanning.get(userId)?.catch(() => undefined);
  memory.delete(userId);
  chains.delete(userId);
  scanning.delete(userId);
  const sql = await db();
  await sql`delete from kismet.slack_mentions where user_id = ${userId}`;
}

async function scan(userId: string): Promise<SlackInboxItem[]> {
  const botId = await getBotUserId();
  const channels = await listBotChannels();
  const store = await load(userId);
  const batch = channels.length <= 8 ? channels : channels.slice(store.cursor, store.cursor + 8);
  const wrapped = channels.length <= 8 ? batch : batch.length === 8 ? batch : [...batch, ...channels.slice(0, 8 - batch.length)];
  store.cursor = channels.length <= 8 ? 0 : (store.cursor + wrapped.length) % channels.length;

  const mentions: { channelId: string; channelName: string; ts: string; userId: string; text: string; threadTs?: string }[] = [];
  for (const channel of wrapped) {
    const oldest = store.bootstrapped ? store.cursors[channel.id] : String(Date.now() / 1000 - 15 * 60);
    const messages = await listRecentMessages(channel.id, oldest);
    const newest = messages.reduce((max, message) => (message.ts > max ? message.ts : max), oldest ?? "");
    if (newest) store.cursors[channel.id] = newest;
    for (const message of messages) {
      const id = `${channel.id}:${message.ts}`;
      if (!message.userId || message.userId === botId) continue;
      if (!message.text.includes(`<@${botId}>`)) continue;
      if (store.seen.includes(id)) continue;
      mentions.push({
        channelId: channel.id,
        channelName: channel.name,
        ts: message.ts,
        userId: message.userId,
        text: message.text,
        threadTs: message.threadTs,
      });
    }
  }
  store.bootstrapped = true;
  await save(userId, store);

  for (const mention of mentions.reverse().slice(-2)) {
    await handleMention(userId, botId, mention);
  }
  return (await load(userId)).inbox;
}

async function handleMention(
  userId: string,
  botId: string,
  mention: { channelId: string; channelName: string; ts: string; userId: string; text: string; threadTs?: string },
) {
  const id = `${mention.channelId}:${mention.ts}`;
  await update(userId, async (store) => {
    store.seen = [...store.seen, id].slice(-400);
    await save(userId, store);
  });

  const people = await mentionedPeople(mention.text, botId);
  const askedBy = await slackUserName(mention.userId).catch(() => "Someone");
  const readable = mention.text.replace(/<@([UW][A-Z0-9]+)>/g, (_, userId: string) => `@${people.get(userId) ?? "someone"}`);
  const intent = await interpret(readable, Array.from(people.values()));
  const thread = mention.threadTs && mention.threadTs !== mention.ts ? mention.threadTs : mention.ts;
  let reply = "";
  let item: SlackInboxItem | null = null;

  try {
    if (intent.action === "assign") {
      const result = await assignNamedIssue(intent.issueKey, intent.assignee);
      reply = result.reply;
      item = inboxItem(id, "assign", intent, mention.channelName, askedBy, result);
    } else if (intent.action === "feature") {
      const result = await openFeature(intent, askedBy, mention.channelName);
      reply = result.reply;
      item = inboxItem(id, "feature", intent, mention.channelName, askedBy, result);
    } else {
      reply = "I can add a feature or assign someone to a Jira issue. Try “add a feature for saved filters and assign it to Maya” or “assign Maya to SCRUM-5”.";
    }
  } catch (error) {
    reply = error instanceof JiraApiError ? error.hint ?? "Jira could not make that change." : "I could not finish that.";
  }

  try {
    await postSlackMessage(mention.channelId, reply, thread);
  } catch (error) {
    const hint = error instanceof SlackApiError && error.code === "missing_scope"
      ? " Add the chat:write scope and reinstall the Slack app so I can reply in the channel."
      : "";
    reply = `${reply}${hint}`;
  }

  if (item) {
    item.note = reply;
    await update(userId, async (store) => {
      store.inbox = [item, ...store.inbox.filter((existing) => existing.id !== id)].slice(0, 30);
      await save(userId, store);
    });
  }
}

function inboxItem(
  id: string,
  action: "feature" | "assign",
  intent: Intent,
  channelName: string,
  askedBy: string,
  result: { jiraKey?: string; jiraUrl?: string; sprint?: string; assigneeName?: string },
): SlackInboxItem {
  return {
    id,
    action,
    title: intent.title || intent.issueKey,
    description: intent.description,
    priority: intent.priority,
    assigneeName: result.assigneeName || intent.assignee,
    issueKey: intent.issueKey,
    jiraKey: result.jiraKey ?? "",
    jiraUrl: result.jiraUrl ?? "",
    sprint: result.sprint ?? "",
    channelName,
    permalink: "",
    askedBy,
    note: "",
    at: new Date().toISOString(),
  };
}

async function mentionedPeople(text: string, botId: string): Promise<Map<string, string>> {
  const ids = Array.from(text.matchAll(/<@([UW][A-Z0-9]+)>/g), (match) => match[1]).filter((id) => id !== botId);
  const names = new Map<string, string>();
  await Promise.all(
    Array.from(new Set(ids)).map(async (id) => {
      names.set(id, await slackUserName(id).catch(() => id));
    }),
  );
  return names;
}

async function interpret(text: string, people: string[]): Promise<Intent> {
  const fallback = heuristic(text, people);
  try {
    const raw = await askForJson(
      [
        "A teammate mentioned Kismet in Slack. Decide what to do.",
        "Return JSON only with keys action, title, description, priority, assignee, issueKey.",
        "action is feature, assign, or none.",
        "feature means add a product feature. assign means change who owns an existing Jira issue.",
        "issueKey must be copied from the message. Leave it empty if the message has no issue key.",
        "assignee must be a person's name that appears in the message. Leave it empty if nobody is named.",
        "priority is one of CRITICAL, HIGH, MEDIUM, LOW.",
        "title is a short feature name. description is one or two sentences.",
      ].join(" "),
      `People mentioned: ${people.join(", ") || "none"}\n\n${text.slice(0, 2000)}`,
      false,
      undefined,
      "feature-draft",
    );
    const parsed = readJson<Partial<Intent>>(raw);
    const issueKey = parsed.issueKey && text.includes(parsed.issueKey) ? parsed.issueKey : fallback.issueKey;
    const assignee = personInMessage(parsed.assignee ?? "", text, people) || fallback.assignee;
    const action = parsed.action === "feature" || parsed.action === "assign" || parsed.action === "none" ? parsed.action : fallback.action;
    return {
      action,
      title: parsed.title?.trim().slice(0, 140) || fallback.title,
      description: parsed.description?.trim().slice(0, 800) || fallback.description,
      priority: PRIORITIES.has(parsed.priority ?? "") ? (parsed.priority as Intent["priority"]) : "MEDIUM",
      assignee,
      issueKey,
    };
  } catch {
    return fallback;
  }
}

function personInMessage(name: string, text: string, people: string[]): string {
  const trimmed = name.trim();
  if (!trimmed) return "";
  const known = people.find((person) => person.toLowerCase() === trimmed.toLowerCase());
  if (known) return known;
  if (text.toLowerCase().includes(trimmed.toLowerCase())) return trimmed;
  return "";
}

function heuristic(text: string, people: string[]): Intent {
  const issueKey = text.match(ISSUE_KEY)?.[0] ?? "";
  const lower = text.toLowerCase();
  const assignee = people[0] ?? "";
  const assigning = lower.includes("assign") || lower.includes("give this to") || lower.includes("owner");
  const feature = lower.includes("feature") || lower.includes("idea") || lower.includes("add ") || lower.includes("build ");
  const title = text
    .replace(/<@[UW][A-Z0-9]+>/g, "")
    .replace(/^(please\s+)?(can you\s+)?(add|create|make|draft)\s+(a\s+)?(feature|idea)\s+(for|about|to)?\s*/i, "")
    .replace(ISSUE_KEY, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
  if (issueKey && assigning && !feature) {
    return { action: "assign", title: issueKey, description: text, priority: "MEDIUM", assignee, issueKey };
  }
  if (feature && title) {
    return { action: "feature", title, description: title, priority: "MEDIUM", assignee, issueKey };
  }
  return { action: "none", title: "", description: "", priority: "MEDIUM", assignee, issueKey };
}

async function assignNamedIssue(issueKey: string, assignee: string) {
  if (!ISSUE_KEY.test(issueKey)) {
    return { reply: "Tell me which Jira issue to assign, like SCRUM-5." };
  }
  if (!assignee) return { reply: `Who should own ${issueKey}? Mention them or say their name.` };
  const account = await findJiraAccount(assignee);
  if (!account) return { reply: `I could not find ${assignee} in Jira, so ${issueKey} was left as it is.` };
  await assignJiraIssue(issueKey, account.accountId);
  return { reply: `Assigned ${account.displayName} to ${issueKey}.`, assigneeName: account.displayName, jiraKey: issueKey };
}

async function openFeature(intent: Intent, askedBy: string, channelName: string) {
  const title = intent.title || "Feature from Slack";
  const description = [
    intent.assignee ? `Assigned to ${intent.assignee}.` : "",
    intent.description || title,
    `Asked in Slack #${channelName} by ${askedBy}.`,
  ]
    .filter(Boolean)
    .join(" ");
  let jiraKey = "";
  let jiraUrl = "";
  let sprint = "";
  let assigneeName = "";
  let jiraNote = "Jira is not connected, so this is only in Kismet for now.";
  try {
    const account = intent.assignee ? await findJiraAccount(intent.assignee) : null;
    const created = await createFeatureIssue({
      title,
      description,
      assigneeAccountId: account?.accountId,
    });
    jiraKey = created.key;
    jiraUrl = created.url;
    sprint = created.sprint ?? "";
    assigneeName = account?.displayName ?? "";
    jiraNote = account
      ? `${created.key} is assigned to ${account.displayName}.`
      : intent.assignee
        ? `${created.key} was created. I could not find ${intent.assignee} in Jira, so it was left unassigned.`
        : `${created.key} was created.`;
  } catch (error) {
    if (error instanceof JiraApiError && error.code !== "missing_config") jiraNote = error.hint ?? "Jira did not create the issue.";
  }
  return {
    reply: `Added “${title}” to Kismet. ${jiraNote}`,
    jiraKey,
    jiraUrl,
    sprint,
    assigneeName,
  };
}
