import type { Experiment } from "./types.ts";
import type { Evidence } from "./types.ts";

export const DIGEST_UTC_HOUR = 16;

export interface TickMessage { message: string; at: string }

export function failureStreak(recentTickMessages: string[]): number {
  let count = 0;
  for (const message of recentTickMessages) {
    if (!message.startsWith("Ran with")) break;
    count += 1;
  }
  return count;
}

export function alertDue(recentTicks: TickMessage[]): { key: string; streak: number } | null {
  const streak = failureStreak(recentTicks.map((tick) => tick.message));
  if (streak < 3) return null;
  const first = recentTicks[streak - 1];
  return first ? { key: `tick_failing:${first.at}`, streak } : null;
}

export interface ReporterThread { channelId: string; threadTs: string }

/** Picks up to five distinct Slack threads from a signal's evidence. */
export function reporterThreads(evidence: Evidence[]): ReporterThread[] {
  const seen = new Set<string>();
  const threads: ReporterThread[] = [];
  for (const item of evidence) {
    // Evidence filed before bot messages were skipped has no person as its author; never reply to Kismet itself.
    if (item.source !== "slack" || !item.url?.startsWith("slack://") || !/^[UW][A-Z0-9]+$/.test(item.author ?? "")) continue;
    const match = item.url.match(/^slack:\/\/([^/]+)\/([^/]+)$/);
    if (!match) continue;
    const key = `${match[1]}:${match[2]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    threads.push({ channelId: match[1], threadTs: match[2] });
    if (threads.length === 5) break;
  }
  return threads;
}

export function reporterReplyText(prTitle: string, prUrl: string): string {
  return `Thanks for flagging this. A fix is live: ${prTitle} (${prUrl}). Kismet will keep an eye out for new reports.`;
}

export function reporterReplyKey(experimentId: string, channelId: string, threadTs: string): string {
  return `reporter_reply:${experimentId}:${channelId}:${threadTs}`;
}

export type NotifyEvent = {
  key: string;
  kind: "approval" | "result" | "broken_split" | "fix_verdict" | "failed";
  experimentId: string;
  text: string;
  blocks: unknown[];
};

function escapeMrkdwn(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function experimentLink(appUrl: string, id: string): string {
  return `${appUrl.replace(/\/$/, "")}/autopilot?experiment=${encodeURIComponent(id)}`;
}

function message(
  experiment: Experiment,
  appUrl: string,
  key: string,
  kind: NotifyEvent["kind"],
  title: string,
  detail: string,
): NotifyEvent {
  const safeTitle = escapeMrkdwn(title).slice(0, 500);
  const safeDetail = escapeMrkdwn(detail).slice(0, 1400);
  const links = [`<${experimentLink(appUrl, experiment.id)}|Open in Kismet>`];
  if (experiment.prUrl) links.push(`<${experiment.prUrl}|Open PR>`);
  const context = escapeMrkdwn(experiment.title).slice(0, 700);
  const text = `${title}: ${detail} — ${experiment.title}`.slice(0, 3000);
  return {
    key,
    kind,
    experimentId: experiment.id,
    text,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${safeTitle}*\n${safeDetail}\n${context} · ${links.join(" · ")}`.slice(0, 3000),
        },
      },
    ],
  };
}

function resultDetail(experiment: Experiment): string {
  const readout = experiment.readout!;
  const verdict = readout.verdict === "won" ? "The new version won" : readout.verdict === "lost" ? "The new version lost" : "No clear difference";
  const parts = [verdict];
  if (readout.lift != null) parts.push(`${readout.lift >= 0 ? "+" : ""}${(readout.lift * 100).toFixed(1)}% lift`);
  if (readout.arms.length >= 2) {
    parts.push(`${readout.arms[0].visitors} control / ${readout.arms[1].visitors} treatment visitors`);
  }
  return parts.join(" · ");
}

/** Derive stable, idempotent notification identities from current experiment state. */
export function deriveEvents(experiments: Experiment[], appUrl: string): NotifyEvent[] {
  return [...experiments]
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    .flatMap((experiment) => {
      const events: NotifyEvent[] = [];
      if (experiment.status === "awaiting_approval") {
        const title = experiment.kind === "test"
          ? "A/B test ready for your review"
          : experiment.kind === "change"
            ? "Change ready for your review"
            : "Fix PR ready for your review";
        events.push(message(experiment, appUrl, `approval:${experiment.id}:v${experiment.version}`, "approval", title, "Review the proposed change and PR."));
      }
      if (
        experiment.readout &&
        ["won", "lost", "flat"].includes(experiment.readout.verdict) &&
        ["awaiting_rollout", "rolled_out", "stopped"].includes(experiment.status)
      ) {
        events.push(message(experiment, appUrl, `result:${experiment.id}`, "result", "Experiment result", resultDetail(experiment)));
      }
      if (experiment.readout?.srm) {
        const [control, treatment] = experiment.readout.srm.observed;
        events.push(message(experiment, appUrl, `broken_split:${experiment.id}`, "broken_split", "Experiment split looks broken", `${control} control vs ${treatment} treatment visitors. Results are paused.`));
      }
      if (experiment.kind === "fix" && experiment.verdict) {
        const detail = experiment.verdict === "fixed"
          ? "Fixed — no new complaints in 14 days"
          : "Complaints came back — reopened";
        events.push(message(experiment, appUrl, `fix_verdict:${experiment.id}`, "fix_verdict", "Fix verification", detail));
      }
      if (experiment.status === "failed") {
        events.push(message(experiment, appUrl, `failed:${experiment.id}`, "failed", "Experiment needs attention", experiment.note || "Kismet could not complete this experiment."));
      }
      return events;
    });
}

function isoWeek(date: Date): string {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function digestDue(now: Date, lastDigestWeek: string | null): string | null {
  const mondayBasedDay = now.getUTCDay() || 7;
  if (mondayBasedDay === 1 && now.getUTCHours() < DIGEST_UTC_HOUR) return null;
  const week = isoWeek(now);
  return week === lastDigestWeek ? null : week;
}

export function buildDigest(experiments: Experiment[], now: Date, appUrl: string): { text: string; blocks: unknown[] } | null {
  const since = now.getTime() - 7 * 86_400_000;
  const recent = (value: string | null) => value != null && Date.parse(value) >= since && Date.parse(value) <= now.getTime();
  const shipped = experiments.filter((item) => item.status === "rolled_out" && recent(item.endedAt)).length;
  const won = experiments.filter((item) => item.readout?.verdict === "won" && recent(item.endedAt)).length;
  const lostFlat = experiments.filter((item) => ["lost", "flat"].includes(item.readout?.verdict ?? "") && recent(item.endedAt)).length;
  const fixes = experiments.filter((item) => item.kind === "fix" && item.verdict === "fixed" && recent(item.verifiedAt)).length;
  const started = experiments.filter((item) => recent(item.startedAt)).length;
  const waiting = experiments.filter((item) => item.status === "awaiting_approval" || item.status === "awaiting_rollout").length;
  if (shipped + won + lostFlat + fixes + started + waiting === 0) return null;
  const detail = `Shipped: ${shipped} · Won: ${won} · Lost/flat: ${lostFlat} · Fixes verified: ${fixes} · Started: ${started}`;
  const link = `<${appUrl.replace(/\/$/, "")}/autopilot|Open Kismet>`;
  return {
    text: `Kismet weekly digest — ${detail}. Waiting on you: ${waiting}.`.slice(0, 3000),
    blocks: [{ type: "section", text: { type: "mrkdwn", text: `*Kismet weekly digest*\n${detail}\nWaiting on you: ${waiting} · ${link}`.slice(0, 3000) } }],
  };
}
