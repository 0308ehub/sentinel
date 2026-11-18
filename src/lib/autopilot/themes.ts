import type { Evidence, EvidenceSource, Signal } from "./types";

export type ThemeTrend = "rising" | "falling" | "steady";

export interface ThemeQuote {
  text: string;
  source: EvidenceSource;
  author: string;
}

export interface Theme {
  signalId: string;
  title: string;
  problem: string;
  mentions: number;
  people: number;
  sources: EvidenceSource[];
  last7: number;
  prev7: number;
  trend: ThemeTrend;
  quotes: ThemeQuote[];
  hasNumbers: boolean;
}

const person = (evidence: Pick<Evidence, "author">) => {
  const author = evidence.author.trim();
  return author && author.toLowerCase() !== "kismet analytics" ? author : "";
};

function representativeQuotes(items: Evidence[]): ThemeQuote[] {
  const remaining = [...items].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
  const authors = new Set<string>();
  const sources = new Set<EvidenceSource>();
  const result: ThemeQuote[] = [];
  const seen = new Set<string>();
  while (remaining.length && result.length < 3) {
    let best = 0;
    let bestScore = -1;
    for (let index = 0; index < remaining.length; index += 1) {
      const item = remaining[index];
      const author = person(item);
      const score = (author && !authors.has(author) ? 2 : 0) + (!sources.has(item.source) ? 1 : 0);
      if (score > bestScore) {
        best = index;
        bestScore = score;
      }
    }
    const [item] = remaining.splice(best, 1);
    // Slack evidence keeps the message in the title and the channel in the body.
    const text = (item.source === "slack" ? item.title : item.body || item.title).trim().slice(0, 200);
    const key = text.toLowerCase().replace(/\s+/g, " ");
    if (!text || seen.has(key)) continue;
    seen.add(key);
    const author = person(item);
    if (author) authors.add(author);
    sources.add(item.source);
    result.push({ text, source: item.source, author });
  }
  return result;
}

export function buildThemes(signals: Signal[], now: Date): Theme[] {
  const current = now.getTime();
  const day = 24 * 60 * 60 * 1000;
  return signals
    .filter((signal) => signal.status === "open" || signal.status === "experimenting" || signal.status === "stale")
    .flatMap((signal) => {
      const qualitative = signal.evidence.filter((item) => item.source !== "analytics");
      if (!qualitative.length) return [];
      const people = new Set(qualitative.map(person).filter(Boolean)).size;
      const last7 = qualitative.filter((item) => {
        const age = current - Date.parse(item.occurredAt);
        return age >= 0 && age <= 7 * day;
      }).length;
      const prev7 = qualitative.filter((item) => {
        const age = current - Date.parse(item.occurredAt);
        return age > 7 * day && age <= 14 * day;
      }).length;
      const trend: ThemeTrend = last7 >= 2 && last7 > prev7 * 1.5
        ? "rising"
        : prev7 >= 2 && last7 < prev7 / 1.5
          ? "falling"
          : "steady";
      return [{
        signalId: signal.id,
        title: signal.title,
        problem: signal.problem,
        mentions: qualitative.length,
        people,
        sources: [...new Set(qualitative.map((item) => item.source))],
        last7,
        prev7,
        trend,
        quotes: representativeQuotes(qualitative),
        hasNumbers: signal.evidence.some((item) => item.source === "analytics"),
      }];
    })
    .sort((a, b) => b.people - a.people || b.mentions - a.mentions);
}
