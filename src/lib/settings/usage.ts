export interface UsageNode {
  type: string;
  createdAt: string;
  updatedAt: string;
}

export interface UsageMessage {
  at: string;
  role?: string;
}

export interface UsageThread {
  createdAt: string;
  messages: UsageMessage[];
}

export interface UsageAgent {
  messages: UsageMessage[];
}

export interface UsageInput {
  nodes: UsageNode[];
  threads: UsageThread[];
  agents: UsageAgent[];
  now?: Date;
}

export interface UsageRow {
  name: string;
  count: number;
  firstSeen: string | null;
  lastSeen: string | null;
}

export interface WeekBar {
  start: string;
  label: string;
  count: number;
}

export interface MonthCounts {
  chats: number;
  agents: number;
  records: number;
}

export interface UsageReport {
  activeDays90: number;
  questions: number;
  records: number;
  agentMessages: number;
  chatMessages: number;
  thisMonth: MonthCounts;
  lastMonth: MonthCounts;
  weeks: WeekBar[];
  content: { name: string; count: number }[];
  rows: UsageRow[];
  year: {
    year: number;
    activeDays: number;
    questions: number;
    records: number;
    experiments: number;
    prds: number;
  };
}

function labelFor(type: string): string {
  if (CONTENT_LABELS[type]) return CONTENT_LABELS[type];
  return type
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

const CONTENT_LABELS: Record<string, string> = {
  PRD: "PRDs",
  FEATURE: "Features",
  EXPERIMENT: "Experiments",
  DECISION: "Decisions",
  METRIC: "Metrics",
  GOAL: "Goals",
  CUSTOMER_PROBLEM: "Problems",
  SLACK_THREAD: "Slack threads",
  MEETING: "Meetings",
  ENGINEERING_TASK: "Tasks",
  CUSTOMER_INTERVIEW: "Interviews",
};

function timeOf(value: string): number {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function dayKey(time: number): string {
  const date = new Date(time);
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function weekStart(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() - copy.getDay());
  return copy;
}

function monthCounts(stamps: { at: number; kind: "chat" | "agent" | "record" }[], year: number, month: number): MonthCounts {
  const counts = { chats: 0, agents: 0, records: 0 };
  for (const stamp of stamps) {
    const date = new Date(stamp.at);
    if (date.getFullYear() !== year || date.getMonth() !== month) continue;
    if (stamp.kind === "chat") counts.chats += 1;
    if (stamp.kind === "agent") counts.agents += 1;
    if (stamp.kind === "record") counts.records += 1;
  }
  return counts;
}

function rowFor(name: string, times: number[]): UsageRow {
  if (!times.length) return { name, count: 0, firstSeen: null, lastSeen: null };
  const sorted = [...times].sort((a, b) => a - b);
  return {
    name,
    count: times.length,
    firstSeen: new Date(sorted[0]).toISOString(),
    lastSeen: new Date(sorted[sorted.length - 1]).toISOString(),
  };
}

export function buildUsage(input: UsageInput): UsageReport {
  const now = input.now ?? new Date();
  const stamps: { at: number; kind: "chat" | "agent" | "record" }[] = [];
  const questions: number[] = [];
  const byType = new Map<string, { created: number[]; seen: number[] }>();

  for (const node of input.nodes) {
    const created = timeOf(node.createdAt);
    if (!created) continue;
    stamps.push({ at: created, kind: "record" });
    const bucket = byType.get(node.type) ?? { created: [], seen: [] };
    bucket.created.push(created);
    bucket.seen.push(created);
    const updated = timeOf(node.updatedAt);
    if (updated) bucket.seen.push(updated);
    byType.set(node.type, bucket);
  }

  for (const thread of input.threads) {
    for (const message of thread.messages) {
      const at = timeOf(message.at);
      if (!at) continue;
      stamps.push({ at, kind: "chat" });
      if (message.role === "user") questions.push(at);
    }
  }

  for (const agent of input.agents) {
    for (const message of agent.messages) {
      const at = timeOf(message.at);
      if (!at) continue;
      stamps.push({ at, kind: "agent" });
      if (message.role === "user") questions.push(at);
    }
  }

  const horizon = now.getTime() - 90 * 24 * 60 * 60 * 1000;
  const activeDays90 = new Set(stamps.filter((stamp) => stamp.at >= horizon).map((stamp) => dayKey(stamp.at))).size;

  const start = weekStart(now);
  const weeks: WeekBar[] = [];
  for (let index = 11; index >= 0; index -= 1) {
    const week = new Date(start);
    week.setDate(start.getDate() - index * 7);
    const end = week.getTime() + 7 * 24 * 60 * 60 * 1000;
    weeks.push({
      start: week.toISOString(),
      label: week.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      count: stamps.filter((stamp) => stamp.at >= week.getTime() && stamp.at < end).length,
    });
  }

  const content = [...byType.entries()]
    .map(([type, times]) => ({ name: labelFor(type), count: times.created.length }))
    .sort((a, b) => b.count - a.count);

  const rows = [
    ...[...byType.entries()]
      .map(([type, times]) => {
        const row = rowFor(labelFor(type), times.seen);
        return { ...row, count: times.created.length };
      }),
    rowFor("Chat messages", stamps.filter((stamp) => stamp.kind === "chat").map((stamp) => stamp.at)),
    rowFor("Agent messages", stamps.filter((stamp) => stamp.kind === "agent").map((stamp) => stamp.at)),
  ].sort((a, b) => b.count - a.count);

  const thisMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const year = now.getFullYear();
  const yearStart = new Date(year, 0, 1).getTime();
  const yearEnd = new Date(year + 1, 0, 1).getTime();
  const inYear = (value: number) => value >= yearStart && value < yearEnd;

  return {
    activeDays90,
    questions: questions.length,
    records: input.nodes.length,
    agentMessages: stamps.filter((stamp) => stamp.kind === "agent").length,
    chatMessages: stamps.filter((stamp) => stamp.kind === "chat").length,
    thisMonth: monthCounts(stamps, now.getFullYear(), now.getMonth()),
    lastMonth: monthCounts(stamps, thisMonthDate.getFullYear(), thisMonthDate.getMonth()),
    weeks,
    content: content.slice(0, 8),
    rows,
    year: {
      year,
      activeDays: new Set(stamps.filter((stamp) => inYear(stamp.at)).map((stamp) => dayKey(stamp.at))).size,
      questions: questions.filter(inYear).length,
      records: stamps.filter((stamp) => stamp.kind === "record" && inYear(stamp.at)).length,
      experiments: (byType.get("EXPERIMENT")?.created ?? []).filter(inYear).length,
      prds: (byType.get("PRD")?.created ?? []).filter(inYear).length,
    },
  };
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function usageCsv(rows: UsageRow[]): string {
  const lines = ["Name,Count,First seen,Last seen"];
  for (const row of rows) {
    lines.push([row.name, String(row.count), row.firstSeen ?? "", row.lastSeen ?? ""].map(csvCell).join(","));
  }
  return `${lines.join("\n")}\n`;
}

export function usageJson(rows: UsageRow[]): string {
  return JSON.stringify(
    rows.map((row) => ({
      name: row.name,
      count: row.count,
      first_seen: row.firstSeen,
      last_seen: row.lastSeen,
    })),
    null,
    2,
  );
}
