export interface SeedAgent {
  slug: string;
  name: string;
  letter: string;
  color: string;
  type: string;
  instructions: string;
}

/** Quieter marks, closer to a Messages monogram than a neon tile. */
export const PALETTE = ["#6e8caf", "#6f9a7b", "#8d7eae", "#c4896a", "#c46d6d", "#b09a62", "#c47d96"] as const;

const PREVIOUS_COLORS: Record<string, string> = {
  insights: "#2f6bff",
  experiments: "#00c853",
  prds: "#8b5cf6",
  monitoring: "#ff6a00",
  decisions: "#ff3b30",
  research: "#ffc400",
  growth: "#ff2d87",
};

export function previousSeedColor(slug: string): string | null {
  return PREVIOUS_COLORS[slug] ?? null;
}

export function seedColor(slug: string, color: string): string {
  const next = SEED_AGENTS.find((agent) => agent.slug === slug);
  if (next && color.toLowerCase() === PREVIOUS_COLORS[slug]) return next.color;
  return color;
}

export const SEED_AGENTS: SeedAgent[] = [
  {
    slug: "insights",
    name: "Insights",
    letter: "I",
    color: "#6e8caf",
    type: "insight",
    instructions: "You watch product evidence. Text only when a pattern is strong enough to act on.",
  },
  {
    slug: "experiments",
    name: "Experiments",
    letter: "E",
    color: "#6f9a7b",
    type: "experiment",
    instructions: "You watch tests and guardrails. Text when a test needs a decision.",
  },
  {
    slug: "prds",
    name: "PRDs",
    letter: "P",
    color: "#8d7eae",
    type: "prd",
    instructions: "You draft from evidence. Text when a draft is ready for a look.",
  },
  {
    slug: "monitoring",
    name: "Monitoring",
    letter: "M",
    color: "#c4896a",
    type: "monitor",
    instructions: "You watch live metrics. Text on regressions and guardrail breaches.",
  },
  {
    slug: "decisions",
    name: "Decisions",
    letter: "D",
    color: "#c46d6d",
    type: "decision",
    instructions: "You watch open decisions. Text when one has been waiting and the evidence is in.",
  },
  {
    slug: "research",
    name: "Research",
    letter: "R",
    color: "#b09a62",
    type: "research",
    instructions: "You read what people say outside the company. Text when it matches something we already measure.",
  },
  {
    slug: "growth",
    name: "Growth",
    letter: "G",
    color: "#c47d96",
    type: "growth",
    instructions: "You watch invites and activation. Text when a channel moves outside its usual range.",
  },
];

export const SIGNAL_TYPES = [...new Set(SEED_AGENTS.map((agent) => agent.type))];

const LEGACY_ICON: Record<string, string> = { I: "In", E: "Ex", P: "Pr", M: "Mo" };

export function markLetter(icon: string, name: string): string {
  const raw = icon.trim();
  const fromLegacy = Object.entries(LEGACY_ICON).find(([, old]) => old === raw)?.[0];
  const source = fromLegacy || raw || name;
  const letter = source.match(/[A-Za-z0-9]/)?.[0] ?? "A";
  return letter.toUpperCase();
}
