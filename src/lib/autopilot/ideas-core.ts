export interface IdeaKnowledge {
  goals: unknown[];
  learnings: unknown[];
  themes: unknown[];
  signals: unknown[];
  experiments: unknown[];
  thumbsDown: string[];
  journeys: string[];
  usage: unknown;
  interviews: unknown[];
  notes: unknown[];
  uiFiles: string[];
}

export interface ProductIdea {
  title: string;
  problem: string;
  page: string;
  why: string;
  basis: string[];
}

const LIMITS = {
  goals: 5,
  learnings: 20,
  themes: 15,
  signals: 80,
  experiments: 80,
  thumbsDown: 40,
  journeys: 12,
  interviews: 12,
  notes: 20,
  uiFiles: 40,
};

function compact(value: unknown, maxLength: number): unknown {
  if (typeof value === "string") return value.trim().slice(0, maxLength);
  if (Array.isArray(value)) return value.map((item) => compact(item, maxLength));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, compact(item, maxLength)]),
    );
  }
  return value;
}

export function ideasInstructions(): string {
  return [
    "You are Kismet, proposing concrete product improvements for THIS product.",
    "Each idea must be small enough for one pull request and name a real page or route found in the repository files or usage.",
    "Say who benefits and which metric or goal it should move.",
    "Do not repeat or closely resemble existing signals, experiments, or thumbs-down items.",
    "Return JSON only: { ideas: [{ title, problem, page, why, basis }] }.",
    "Titles are at most 80 characters and problem-framed like existing signal titles.",
    "problem is 1-3 sentences. page is a route such as /experiments or a named area.",
    "why is 2-4 sentences citing the specific goal, learning, usage, theme, or note used.",
    "basis is an array of short labels for the knowledge used. Return at most 2 ideas.",
  ].join(" ");
}

export function buildIdeasInput(knowledge: IdeaKnowledge): string {
  const capped = {
    goals: knowledge.goals.slice(0, LIMITS.goals),
    learnings: knowledge.learnings.slice(0, LIMITS.learnings),
    themes: knowledge.themes.slice(0, LIMITS.themes),
    signals: knowledge.signals.slice(0, LIMITS.signals),
    experiments: knowledge.experiments.slice(0, LIMITS.experiments),
    thumbsDown: knowledge.thumbsDown.slice(0, LIMITS.thumbsDown),
    journeys: knowledge.journeys.slice(0, LIMITS.journeys),
    usage: knowledge.usage,
    interviews: knowledge.interviews.slice(0, LIMITS.interviews),
    notes: knowledge.notes.slice(0, LIMITS.notes),
    uiFiles: knowledge.uiFiles.slice(0, LIMITS.uiFiles),
  };
  return JSON.stringify(compact(capped, 500));
}

function cleanString(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, maxLength) : "";
}

export function parseIdeasResponse(value: unknown): ProductIdea[] {
  if (!value || typeof value !== "object" || !Array.isArray((value as { ideas?: unknown }).ideas)) return [];
  return (value as { ideas: unknown[] }).ideas.slice(0, 2).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const idea: ProductIdea = {
      title: cleanString(row.title, 80),
      problem: cleanString(row.problem, 600),
      page: cleanString(row.page, 120),
      why: cleanString(row.why, 1200),
      basis: Array.isArray(row.basis)
        ? row.basis.map((entry) => cleanString(entry, 80)).filter(Boolean).slice(0, 8)
        : [],
    };
    return idea.title && idea.problem && idea.page && idea.why && idea.basis.length ? [idea] : [];
  });
}

export function normalizedTitleTokens(title: string): Set<string> {
  return new Set(
    title.toLowerCase().match(/[a-z0-9]+/g)?.filter((token) => token.length > 1) ?? [],
  );
}

export function titleSimilarity(left: string, right: string): number {
  const a = normalizedTitleTokens(left);
  const b = normalizedTitleTokens(right);
  if (!a.size || !b.size) return 0;
  const intersection = [...a].filter((token) => b.has(token)).length;
  return intersection / (a.size + b.size - intersection);
}

export function dedupeIdeas(ideas: ProductIdea[], existingTitles: string[]): ProductIdea[] {
  const kept: ProductIdea[] = [];
  for (const idea of ideas) {
    const compared = [...existingTitles, ...kept.map((item) => item.title)];
    if (compared.some((title) => titleSimilarity(idea.title, title) >= 0.5)) continue;
    kept.push(idea);
  }
  return kept.slice(0, 2);
}
