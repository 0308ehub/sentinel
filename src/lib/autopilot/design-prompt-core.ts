export function fixSystemPrompt(): string {
  return [
    "Decide first whether this reported bug actually calls for a product change.",
    'If it is a test message, asks not to change anything, is praise or a question, describes already-working behavior, or has no concrete problem in the evidence, return only {"kind":"none","reason":"<one sentence>"}. This is a normal first-class outcome, not a last resort.',
    "Otherwise explain what is most likely broken given the evidence, the fix, and what could go wrong.",
    "Do not propose experiments, flags, variants, or A/B tests.",
    "Return JSON: {title,hypothesis,control,treatment,page,reasoning,evidence:[{source,quote}],confidence,confidenceReason,risks}.",
    "title is a short description without a Fix prefix. hypothesis says what is broken. treatment is the intended fix in one or two sentences.",
    "confidence must be high or medium. Cite 2–6 complaints when available.",
  ].join(" ");
}

export function designSystemPrompt(): string {
  return [
      "You are an autonomous product manager. Design one small UI change to one existing React component that addresses the problem.",
      'First decide whether the problem calls for any product change. If it is a test message, asks not to change anything, is praise or a question, describes already-working behavior, or has no concrete problem in the evidence, return only {"kind":"none","reason":"<one sentence>"}. This is a normal first-class outcome, not a last resort.',
      "Set kind to \"fix\" when the change is a small, obvious correction that should ship to everyone: a color, label, spacing, or similar tweak people have already asked for, where splitting traffic would not teach anything.",
      "Set kind to \"experiment\" when the outcome is uncertain. An experiment is safe to show to half of visitors and is measured.",
      "Set mode to \"stochastic\" when the change is a prompt, model, ranking, or generated text that can differ on each request. Otherwise \"deterministic\".",
      "A stochastic test still needs one metric both versions can produce. Do not score a single sample of the model's words.",
      "Those rules are for experiments. A fix does not split traffic and may omit the metric.",
      "For an experiment, pick the metric as the outcome the user is trying to reach, which must be possible in BOTH versions,",
      "never the new element itself (clicks on a button only the new version has would rig the test).",
      "Use one of:",
      '{"kind":"click","text":"<visible label of the button or link that completes the task in both versions, e.g. the submit button of a dialog>"}',
      'or {"kind":"visit","path":"/some/path"} (visitor reaches that page in either version)',
      'or {"kind":"event","name":"<a name listed under TRACKED EVENTS>"} (a business outcome the site reports with kismet.track, such as a purchase or sign-up).',
      "When a TRACKED EVENT is the real outcome the change is meant to move, prefer it over a click or a visit.",
      "page is the route the change appears on, like /features or /settings/connectors.",
      "Optionally choose a guardrail outcome that must not get worse, using the same metric format; omit guardrailMetric if none fits.",
      "Otherwise return JSON: {kind, mode, title, hypothesis, control,treatment, metric, page, guardrail, guardrailMetric}. kind is \"experiment\" or \"fix\". mode is \"deterministic\" or \"stochastic\".",
      "For a fix, metric may be omitted. Keep each field to one or two sentences.",
      "If earlier attempts failed or were rejected, try a meaningfully different idea.",
      "Build on LEARNINGS: repeat what won in new places, do not retry ideas that lost, were flat, or that a person rejected, unless you change them meaningfully and say how.",
      "Prefer one of the GOALS as the metric when the change can plausibly move it; otherwise use the closest outcome both versions share.",
    ].join(" ");
}

export interface DesignUserMessageParts {
  product: string;
  goals: string;
  trackedEvents: string;
  problem: string;
  themes: string;
  evidence: string[];
  learnings: string;
  earlierAttempts: string;
  preferences: string;
}

export function designUserMessage(parts: DesignUserMessageParts): string {
  return [
    `PRODUCT\n${parts.product}`,
    `GOALS\n${parts.goals}`,
    `TRACKED EVENTS\n${parts.trackedEvents}`,
    `PROBLEM\n${parts.problem}`,
    `THEMES\n${parts.themes}`,
    `EVIDENCE (${parts.evidence.length})`,
    ...parts.evidence.slice(0, 15),
    `LEARNINGS\n${parts.learnings}`,
    `EARLIER ATTEMPTS\n${parts.earlierAttempts}`,
    `PREFERENCES\n${parts.preferences}`,
  ].join("\n");
}

export function classifyDesignAnswer(answer: unknown): "none" | "fix" | "experiment" | "invalid" {
  if (!answer || typeof answer !== "object") return "invalid";
  const kind = (answer as { kind?: unknown }).kind;
  return kind === "none" || kind === "fix" || kind === "experiment" ? kind : "invalid";
}

const TEXT_FIELDS = ["kind", "reason", "mode", "title", "hypothesis", "control", "treatment", "page", "guardrail", "reasoning", "confidence", "confidenceReason", "risks", "question"] as const;

function asText(value: unknown): unknown {
  if (value == null || typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item : item && typeof item === "object" ? Object.values(item).filter((part) => typeof part === "string").join(": ") : String(item)))
      .map((item) => item.trim())
      .filter(Boolean)
      .join("; ");
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return value;
}

/** Models sometimes return a list or a number where Kismet expects a sentence; turn those fields into text. */
export function normalizeDesignAnswer<T extends object>(answer: T): T {
  if (!answer || typeof answer !== "object") return answer;
  const record = answer as Record<string, unknown>;
  const next: Record<string, unknown> = { ...record };
  for (const key of TEXT_FIELDS) if (key in record) next[key] = asText(record[key]);
  if (Array.isArray(record.evidence)) {
    next.evidence = record.evidence.map((item) => (item && typeof item === "object"
      ? { ...item, source: asText((item as Record<string, unknown>).source), quote: asText((item as Record<string, unknown>).quote) }
      : item));
  }
  return next as T;
}
