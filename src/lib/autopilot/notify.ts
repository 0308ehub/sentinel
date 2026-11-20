import "server-only";

import { db } from "@/lib/autopilot/db";
import { buildDigest, deriveEvents, digestDue } from "@/lib/autopilot/notify-core";
import { autopilotUser } from "@/lib/autopilot/scope";
import { listExperiments } from "@/lib/autopilot/store";
import { siteUrl } from "@/lib/site";
import { postSlackBlocks, postSlackMessage, SlackApiError } from "@/lib/slack/client";

export interface NotifyPrefs {
  enabled: boolean;
  channelId: string;
  channelName: string;
  digest: boolean;
  baselineAt: string | null;
}

type Row = Record<string, unknown>;

function mapPrefs(row?: Row): NotifyPrefs {
  return {
    enabled: Boolean(row?.enabled),
    channelId: String(row?.channel_id ?? ""),
    channelName: String(row?.channel_name ?? ""),
    digest: row?.digest == null ? true : Boolean(row.digest),
    baselineAt: row?.baseline_at instanceof Date ? row.baseline_at.toISOString() : row?.baseline_at ? String(row.baseline_at) : null,
  };
}

export async function getNotifyPrefs(): Promise<NotifyPrefs> {
  const sql = await db();
  const rows = await sql`select * from kismet.autopilot_notify_prefs where user_id = ${autopilotUser()} limit 1`;
  return mapPrefs(rows[0]);
}

export async function saveNotifyPrefs(input: Omit<NotifyPrefs, "baselineAt">): Promise<NotifyPrefs> {
  const sql = await db();
  const userId = autopilotUser();
  const rows = await sql`
    insert into kismet.autopilot_notify_prefs (user_id, enabled, channel_id, channel_name, digest)
    values (${userId}, ${input.enabled}, ${input.channelId}, ${input.channelName}, ${input.digest})
    on conflict (user_id) do update set
      enabled = excluded.enabled,
      channel_id = excluded.channel_id,
      channel_name = excluded.channel_name,
      digest = excluded.digest,
      baseline_at = case
        when kismet.autopilot_notify_prefs.channel_id <> excluded.channel_id
          or (not kismet.autopilot_notify_prefs.enabled and excluded.enabled)
        then null else kismet.autopilot_notify_prefs.baseline_at
      end,
      updated_at = now()
    returning *
  `;
  return mapPrefs(rows[0]);
}

function readableSlackError(error: unknown): Error {
  if (error instanceof SlackApiError) return new Error(error.hint || `Slack error: ${error.code}`);
  return error instanceof Error ? error : new Error(String(error));
}

export async function claim(eventKey: string): Promise<boolean> {
  const sql = await db();
  const rows = await sql`
    insert into kismet.autopilot_notifications (user_id, event_key)
    values (${autopilotUser()}, ${eventKey})
    on conflict do nothing returning event_key
  `;
  return rows.length > 0;
}

/**
 * A claim shared by every Kismet account. Several accounts can be connected to one Slack workspace; a
 * Slack thread must still get each update once, from whichever account gets there first.
 */
export async function claimShared(eventKey: string): Promise<boolean> {
  const sql = await db();
  const rows = await sql`
    insert into kismet.autopilot_notifications (user_id, event_key)
    values (${SHARED_SCOPE}, ${eventKey})
    on conflict do nothing returning event_key
  `;
  return rows.length > 0;
}

export async function releaseShared(eventKey: string): Promise<void> {
  const sql = await db();
  await sql`delete from kismet.autopilot_notifications where user_id = ${SHARED_SCOPE} and event_key = ${eventKey}`;
}

const SHARED_SCOPE = "shared:slack";

export async function hasClaim(eventKey: string): Promise<boolean> {
  const sql = await db();
  const rows = await sql`
    select 1 from kismet.autopilot_notifications
    where user_id = ${autopilotUser()} and event_key = ${eventKey}
    limit 1
  `;
  return rows.length > 0;
}

export async function release(eventKey: string): Promise<void> {
  const sql = await db();
  await sql`delete from kismet.autopilot_notifications where user_id = ${autopilotUser()} and event_key = ${eventKey}`;
}

export async function postAccountAlert(eventKey: string, text: string): Promise<boolean> {
  const prefs = await getNotifyPrefs();
  if (!prefs.enabled || !prefs.channelId || !(await claim(eventKey))) return false;
  try {
    await postSlackMessage(prefs.channelId, text);
    return true;
  } catch (error) {
    await release(eventKey);
    throw readableSlackError(error);
  }
}

async function finish(eventKey: string, slackTs: string): Promise<void> {
  const sql = await db();
  await sql`
    update kismet.autopilot_notifications set slack_ts = ${slackTs}
    where user_id = ${autopilotUser()} and event_key = ${eventKey}
  `;
}

export async function notifySlack(): Promise<string | null> {
  const { postThreadUpdates } = await import("@/lib/autopilot/thread-updates");
  const reporterPosted = await postThreadUpdates();
  const experiments = await listExperiments();

  const prefs = await getNotifyPrefs();
  if (!prefs.enabled || !prefs.channelId) return reporterPosted ? `notify: replied to ${reporterPosted} reporter${reporterPosted === 1 ? "" : "s"}` : null;

  const sql = await db();
  const events = deriveEvents(experiments, siteUrl());

  if (!prefs.baselineAt) {
    for (const event of events) await claim(event.key);
    await sql`
      update kismet.autopilot_notify_prefs set baseline_at = now(), updated_at = now()
      where user_id = ${autopilotUser()}
    `;
    return `notify: baseline ${events.length} events${reporterPosted ? `; replied to ${reporterPosted} reporters` : ""}`;
  }

  let posted = 0;
  const eventKeys = events.map((event) => event.key);
  const sentRows = eventKeys.length
    ? await sql`
        select event_key from kismet.autopilot_notifications
        where user_id = ${autopilotUser()} and event_key in ${sql(eventKeys)}
      `
    : [];
  const sentKeys = new Set(sentRows.map((row) => String(row.event_key)));
  const pending = events.filter((event) => !sentKeys.has(event.key)).slice(0, 10);
  for (const event of pending) {
    if (!(await claim(event.key))) continue;
    try {
      const ts = await postSlackBlocks(prefs.channelId, event.text, event.blocks);
      await finish(event.key, ts);
      posted += 1;
    } catch (error) {
      await release(event.key);
      throw readableSlackError(error);
    }
  }

  if (prefs.digest) {
    const now = new Date();
    const digestRows = await sql`
      select event_key from kismet.autopilot_notifications
      where user_id = ${autopilotUser()} and event_key like 'digest:%'
      order by sent_at desc limit 1
    `;
    const lastWeek = digestRows[0] ? String(digestRows[0].event_key).slice("digest:".length) : null;
    const week = digestDue(now, lastWeek);
    if (week) {
      const key = `digest:${week}`;
      if (await claim(key)) {
        const digest = buildDigest(experiments, now, siteUrl());
        if (digest) {
          try {
            const ts = await postSlackBlocks(prefs.channelId, digest.text, digest.blocks);
            await finish(key, ts);
            posted += 1;
          } catch (error) {
            await release(key);
            throw readableSlackError(error);
          }
        }
      }
    }
  }

  const total = posted + reporterPosted;
  return total ? `notify: posted ${posted}; replied to ${reporterPosted} reporters` : null;
}
