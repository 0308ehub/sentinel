export type ProviderId = "claude" | "openai";
export type OrchestratedTask = "chat" | "feature-draft" | "recommendations" | "experiment";
export type ModelPolicy = "auto" | "claude" | "openai";

export interface RouteInput {
  task: OrchestratedTask;
  needsTools: boolean;
  deep: boolean;
  claudeReady: boolean;
  openaiReady: boolean;
  policy: ModelPolicy;
  claudeModel: string;
  openaiModel: string;
  prefer?: ProviderId;
}

export interface RouteDecision {
  provider: ProviderId;
  model: string;
  reason: string;
  fallback?: { provider: ProviderId; model: string };
}

export interface RoutePreview {
  label: string;
  provider: ProviderId;
  model: string;
  reason: string;
}

const SAMPLES: { task: OrchestratedTask; needsTools: boolean; label: string }[] = [
  { task: "chat", needsTools: true, label: "Chat" },
  { task: "recommendations", needsTools: true, label: "Feature recommendations" },
  { task: "feature-draft", needsTools: true, label: "Feature drafts that need a warehouse number" },
  { task: "feature-draft", needsTools: false, label: "Feature drafts" },
  { task: "experiment", needsTools: false, label: "Experiment drafts" },
];

export function readPolicy(value: string | undefined): ModelPolicy {
  if (value === "claude" || value === "openai") return value;
  return "auto";
}

export function chooseModel(input: RouteInput): RouteDecision {
  if (!input.claudeReady && !input.openaiReady) {
    throw new Error("Add ANTHROPIC_API_KEY or OPENAI_API_KEY to .env and restart the dev server.");
  }
  const preferred = preferredProvider(input);
  const provider = ready(preferred, input) ? preferred : other(preferred);
  const alternate = other(provider);
  return {
    provider,
    model: modelFor(provider, input),
    reason: reasonFor(input, preferred, provider),
    fallback: ready(alternate, input) ? { provider: alternate, model: modelFor(alternate, input) } : undefined,
  };
}

export function previewRoutes(input: Omit<RouteInput, "task" | "needsTools" | "deep">): RoutePreview[] {
  if (!input.claudeReady && !input.openaiReady) return [];
  return SAMPLES.map((sample) => {
    const decision = chooseModel({ ...input, ...sample, deep: false });
    return { label: sample.label, provider: decision.provider, model: decision.model, reason: decision.reason };
  });
}

export function modelTitle(provider: ProviderId, model: string): string {
  if (model.includes("opus")) return "Claude Opus";
  if (model.includes("sonnet")) return "Claude Sonnet";
  if (model.includes("haiku")) return "Claude Haiku";
  if (model.includes("fable")) return "Claude Fable";
  if (provider === "claude") return "Claude";
  return model;
}

function preferredProvider(input: RouteInput): ProviderId {
  if (input.prefer) return input.prefer;
  if (input.policy === "claude") return "claude";
  if (input.policy === "openai") return "openai";
  if (input.task === "chat" || input.task === "recommendations" || input.needsTools || input.deep) return "claude";
  return "openai";
}

function reasonFor(input: RouteInput, preferred: ProviderId, actual: ProviderId): string {
  if (preferred !== actual) {
    return actual === "openai"
      ? "Claude is not configured, so this uses OpenAI."
      : "OpenAI is not configured, so this uses Claude.";
  }
  if (input.prefer === "claude") return "You picked Claude for this chat.";
  if (input.prefer === "openai") return "You picked OpenAI for this chat.";
  if (input.policy === "claude") return "KISMET_MODEL_POLICY is set to Claude.";
  if (input.policy === "openai") return "KISMET_MODEL_POLICY is set to OpenAI.";
  if (input.task === "chat") return "Chat reads the workspace and can use tools.";
  if (input.task === "recommendations") return "Recommendations read Slack, Jira, and the warehouse.";
  if (input.needsTools) return "This draft may query the warehouse.";
  return "This is a short structured draft.";
}

function ready(provider: ProviderId, input: RouteInput): boolean {
  return provider === "claude" ? input.claudeReady : input.openaiReady;
}

function other(provider: ProviderId): ProviderId {
  return provider === "claude" ? "openai" : "claude";
}

function modelFor(provider: ProviderId, input: RouteInput): string {
  return provider === "claude" ? input.claudeModel : input.openaiModel;
}
