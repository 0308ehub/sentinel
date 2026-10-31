/** Planning sketch for an any% run. Not a price list and not a model bench. */

export type PlanGoal = "speed" | "price" | "customers" | "locked";

export interface PlanInput {
  /** Visits per week that can enter the experiment. */
  weeklyVisits: number;
  /** Baseline rate, 0–1. */
  baseline: number;
  /** Relative lift to detect, 0–1. 0.1 is a 10% relative change. */
  relativeLift: number;
  /** Dollars per thousand visits, for paid or incentivized traffic. */
  costPerThousand: number;
}

export interface PlanDesign {
  id: "fixed" | "sequential" | "bandit";
  label: string;
  /** Expected samples across both arms. */
  samples: number;
  days: number;
  /** Dollars. Traffic plus a flat monitoring assumption. */
  cost: number;
  /** People expected to see the worse version. */
  worse: number;
  note: string;
}

const Z = 1.96 + 0.84;

/** Two-proportion sample size per arm. 95% confidence, 80% power. */
export function samplesPerArm(baseline: number, relativeLift: number): number {
  const p = Math.min(0.99, Math.max(0.01, baseline));
  const delta = p * relativeLift;
  if (delta <= 0) return 0;
  return Math.ceil((2 * p * (1 - p) * Z * Z) / (delta * delta));
}

/**
 * Sequential expected sample is about 70% of a fixed test when the effect is real.
 * The maximum sample can be higher. Bandits spend a similar sample and put fewer
 * people on the worse arm. Monitoring fees are sketch assumptions so price and
 * speed can pick different designs.
 */
const MONITORING = { fixed: 0, sequential: 400, bandit: 700 };
const SAMPLE_SHARE = { fixed: 1, sequential: 0.7, bandit: 0.85 };
const WORSE_SHARE = { fixed: 0.5, sequential: 0.5, bandit: 0.32 };

export function planDesigns(input: PlanInput): PlanDesign[] {
  const perArm = samplesPerArm(input.baseline, input.relativeLift);
  const fixedTotal = perArm * 2;
  const weekly = Math.max(1, input.weeklyVisits);
  const designs: Array<PlanDesign["id"]> = ["fixed", "sequential", "bandit"];
  const labels = { fixed: "Fixed horizon", sequential: "Sequential", bandit: "Bandit" };
  const notes = {
    fixed: "One readout at the end. Half the sample stays on each version the whole time.",
    sequential: "You can stop early when the effect is real. The cap can run past a fixed test.",
    bandit: "More people see the better version while you are still learning. It is not a pre-registered winner.",
  };
  return designs.map((id) => {
    const samples = Math.ceil(fixedTotal * SAMPLE_SHARE[id]);
    const days = Math.max(1, Math.ceil((samples / weekly) * 7));
    const cost = Math.round((samples / 1000) * input.costPerThousand + MONITORING[id]);
    const worse = Math.round(samples * WORSE_SHARE[id]);
    return { id, label: labels[id], samples, days, cost, worse, note: notes[id] };
  });
}

export function winningDesign(designs: PlanDesign[], goal: PlanGoal): PlanDesign["id"] {
  if (goal === "locked") return "fixed";
  if (goal === "customers") return lowest(designs, (item) => item.worse);
  if (goal === "price") return lowest(designs, (item) => item.cost);
  return lowest(designs, (item) => item.days);
}

function lowest(designs: PlanDesign[], value: (item: PlanDesign) => number): PlanDesign["id"] {
  return designs.reduce((best, item) => (value(item) < value(best) ? item : best)).id;
}
