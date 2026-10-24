export const ONBOARDING_STEPS = ["you", "company", "goals", "connect", "organize", "tour"] as const;

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
  website: string;
  size: string;
  goals: string[];
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

export function readOnboarding(): OnboardingDraft {
  if (typeof window === "undefined") return EMPTY_ONBOARDING;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY_ONBOARDING;
    const parsed = JSON.parse(raw) as Partial<OnboardingDraft>;
    return {
      ...EMPTY_ONBOARDING,
      ...parsed,
      goals: Array.isArray(parsed.goals) ? parsed.goals.filter((g) => typeof g === "string") : [],
      step: parsed.step && isOnboardingStep(parsed.step) ? parsed.step : "you",
    };
  } catch {
    return EMPTY_ONBOARDING;
  }
}

export function writeOnboarding(patch: Partial<OnboardingDraft>): OnboardingDraft {
  const next = { ...readOnboarding(), ...patch };
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("kismet-onboarding"));
  return next;
}

export function beginSignup(name: string, email: string) {
  const next: OnboardingDraft = {
    ...EMPTY_ONBOARDING,
    started: true,
    completed: false,
    step: "you",
    name: name.trim(),
    email: email.trim(),
  };
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("kismet-onboarding"));
}

export function destinationAfterSignIn(): string {
  const draft = readOnboarding();
  if (draft.completed) return "/ai";
  if (draft.started) return `/onboarding/${draft.step}`;
  return "/ai";
}

export function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Y";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
