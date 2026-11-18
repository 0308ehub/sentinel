export const ONBOARDING_STEPS = ["you", "github", "evidence"] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export const ROLES = [
  "Product manager",
  "Founder",
  "Engineering",
  "Design",
  "Data",
  "Other",
] as const;

export const COMPANY_SIZES = ["Just me", "2–10", "11–50", "51–200", "200+"] as const;

export const GOALS = [
  { id: "decide", label: "Decide what to build next" },
  { id: "picture", label: "Keep a living picture of the product" },
  { id: "slack", label: "Pull signal out of Slack" },
  { id: "decisions", label: "Remember why decisions were made" },
  { id: "meetings", label: "Walk into meetings already briefed" },
] as const;

export interface OnboardingDraft {
  started: boolean;
  completed: boolean;
  step: OnboardingStep;
  name: string;
  email: string;
  role: string;
  company: string;
  website?: string;
  size?: string;
  goals?: string[];
}

const KEY = "kismet-onboarding";

export const EMPTY_ONBOARDING: OnboardingDraft = {
  started: false,
  completed: false,
  step: "you",
  name: "",
  email: "",
  role: "",
  company: "",
  website: "",
  size: "",
  goals: [],
};

export function isOnboardingStep(value: string): value is OnboardingStep {
  return (ONBOARDING_STEPS as readonly string[]).includes(value);
}

const listeners = new Set<() => void>();

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function normalizeOnboarding(value: unknown): OnboardingDraft {
  if (!value || typeof value !== "object" || Array.isArray(value)) return EMPTY_ONBOARDING;
  const parsed = value as Partial<OnboardingDraft>;
  const step = normalizeStep(parsed.step);
  return {
    started: parsed.started === true,
    completed: parsed.completed === true,
    step,
    name: text(parsed.name),
    email: text(parsed.email),
    role: text(parsed.role),
    company: text(parsed.company),
    website: text(parsed.website),
    size: text(parsed.size),
    goals: Array.isArray(parsed.goals) ? parsed.goals.filter((goal) => typeof goal === "string") : [],
  };
}

function normalizeStep(value: unknown): OnboardingStep {
  if (typeof value !== "string") return "you";
  if (isOnboardingStep(value)) return value;
  if (["goals", "database"].includes(value)) return "github";
  if (["connect", "organize", "tour"].includes(value)) return "evidence";
  return "you";
}

function publish(next: OnboardingDraft): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("kismet-onboarding"));
  listeners.forEach((listener) => listener());
}

export function readOnboarding(): OnboardingDraft {
  if (typeof window === "undefined") return EMPTY_ONBOARDING;
  try {
    const raw = localStorage.getItem(KEY);
    return normalizeOnboarding(raw ? JSON.parse(raw) : null);
  } catch {
    return EMPTY_ONBOARDING;
  }
}

export function writeOnboarding(patch: Partial<OnboardingDraft>): OnboardingDraft {
  const next = normalizeOnboarding({ ...readOnboarding(), ...patch });
  publish(next);
  return next;
}

export function beginSignup(name: string, email: string) {
  publish({
    ...EMPTY_ONBOARDING,
    started: true,
    completed: false,
    step: "you",
    name: name.trim(),
    email: email.trim(),
  });
}

export function replaceOnboarding(data: unknown): void {
  publish(normalizeOnboarding(data));
}

export function resetOnboarding(): void {
  publish(EMPTY_ONBOARDING);
}

export function subscribeOnboarding(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function destinationAfterSignIn(): string {
  const draft = readOnboarding();
  if (draft.completed) return "/ai";
  if (draft.started) return `/onboarding/${draft.step}`;
  return "/onboarding/you";
}

export function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Y";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
