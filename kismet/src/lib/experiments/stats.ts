import type { ArmMeasure, ExpectedChange, ExperimentMetric, ReadoutState } from "@/lib/experiments/allocation";
import { metricValue } from "@/lib/experiments/allocation";

const Z_ALPHA = 1.959963984540054;
const Z_BETA = 0.8416212335729143;

export interface CompareResult {
  lift: number | null;
  pValue: number | null;
  ciLow: number | null;
  ciHigh: number | null;
}

export function compareArms(control: ArmMeasure, treatment: ArmMeasure, metric: ExperimentMetric): CompareResult {
  if (metric === "conversion") {
    return proportionTest(control.converted, control.users, treatment.converted, treatment.users);
  }
  const left = moment(control, metric);
  const right = moment(treatment, metric);
  if (!left || !right) return emptyCompare();
  return welchTest(left, right);
}

export function decide(input: {
  metric: ExperimentMetric;
  audience: number;
  rollout: number;
  control: ArmMeasure;
  treatments: ArmMeasure[];
  mismatch: boolean;
}): { state: ReadoutState; summary: string; needed: number | null } {
  const label = metricName(input.metric);
  if (input.rollout <= 0) {
    return { state: "hold", summary: "Rollout is 0%, so every customer stays on control.", needed: null };
  }
  if (input.audience === 0) {
    return { state: "collecting", summary: "No customers in this audience have an order in the warehouse window.", needed: null };
  }
  if (input.mismatch) {
    return {
      state: "mismatch",
      summary: "The customer split does not match the allocation. Hold the readout until the arms are the expected size.",
      needed: null,
    };
  }
  const tested = input.treatments
    .map((arm) => ({ arm, ...compareArms(input.control, arm, input.metric) }))
    .filter((item) => item.pValue != null);
  const winner = tested
    .filter((item) => item.pValue != null && item.pValue < 0.05 && item.arm.users >= 30 && input.control.users >= 30)
    .sort((a, b) => (a.pValue ?? 1) - (b.pValue ?? 1))[0];
  if (winner) {
    const direction = (winner.lift ?? 0) >= 0 ? "higher" : "lower";
    const lift = formatLift(winner.lift);
    return {
      state: "significant",
      summary: `This test is conclusive. ${winner.arm.name} ${direction === "higher" ? "outperforms" : "is behind"} control${lift ? ` by ${lift.replace(/^[+−]/, "")}` : ""}.`,
      needed: null,
    };
  }

  const primary = input.treatments[0];
  const needed = primary ? usersNeeded(input.control, primary, input.metric) : null;
  const ready =
    needed != null &&
    input.treatments.every((arm) => arm.users >= needed && input.control.users >= needed);
  if (ready) {
    return {
      state: "no_difference",
      summary: `This test is conclusive. No detectable difference in ${label.toLowerCase()}.`,
      needed,
    };
  }
  const smaller = primary ? Math.min(input.control.users, primary.users) : 0;
  const gap = needed != null ? Math.max(0, needed - smaller) : null;
  const more = gap != null && gap > 0 ? ` About ${gap.toLocaleString("en-US")} more customers on the smaller arm would be enough to detect a 10% change.` : "";
  return {
    state: "collecting",
    summary: `This test is still running. ${label} has not cleared 95% confidence.${more || " The baseline is too close to the floor or the ceiling to estimate how many more customers it needs."}`,
    needed,
  };
}

export function sampleMismatch(arms: { users: number; expected: number }[]): boolean {
  const usable = arms.filter((arm) => arm.expected >= 5);
  if (usable.length < 2 || usable.reduce((sum, arm) => sum + arm.users, 0) < 100) return false;
  const chi = usable.reduce((sum, arm) => sum + (arm.users - arm.expected) ** 2 / arm.expected, 0);
  return chiSquareP(chi, usable.length - 1) < 0.001;
}

export function interpret(input: {
  metric: ExperimentMetric;
  direction: ExpectedChange;
  state: ReadoutState;
  summary: string;
  needed: number | null;
  controlUsers: number;
  arms: { name: string; users: number; lift: number | null; pValue: number | null }[];
}): { state: ReadoutState; summary: string } {
  if (input.state === "hold" || input.state === "mismatch" || input.controlUsers === 0) {
    return { state: input.state, summary: input.summary };
  }
  const winner = input.arms
    .filter((arm) => arm.pValue != null && arm.users >= 30 && input.controlUsers >= 30 && directedP(arm.pValue, arm.lift, input.direction) < 0.05)
    .sort((a, b) => directedP(a.pValue ?? 1, a.lift, input.direction) - directedP(b.pValue ?? 1, b.lift, input.direction))[0];
  if (winner && winner.lift != null) {
    const ahead = winner.lift >= 0;
    const amount = formatLift(winner.lift).replace(/^[+−]/, "");
    return {
      state: "significant",
      summary: ahead
        ? `This test is conclusive. ${winner.name} outperforms control by ${amount}.`
        : `This test is conclusive. ${winner.name} is behind control by ${amount}.`,
    };
  }
  const ready = input.needed != null && input.controlUsers >= input.needed && input.arms.every((arm) => arm.users >= (input.needed as number));
  if (ready) {
    const change = input.direction === "increase" ? "increase" : input.direction === "decrease" ? "decrease" : "difference";
    return { state: "no_difference", summary: `This test is conclusive. No detectable ${change} in ${metricName(input.metric).toLowerCase()}.` };
  }
  return { state: "collecting", summary: input.summary };
}

function proportionTest(x1: number, n1: number, x2: number, n2: number): CompareResult {
  if (n1 < 2 || n2 < 2) return emptyCompare();
  const p1 = x1 / n1;
  const p2 = x2 / n2;
  const pooled = (x1 + x2) / (n1 + n2);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / n1 + 1 / n2));
  const spread = Math.sqrt((p1 * (1 - p1)) / n1 + (p2 * (1 - p2)) / n2);
  const lift = p1 === 0 ? null : (p2 - p1) / p1;
  if (se === 0) return { lift, pValue: 1, ciLow: lift, ciHigh: lift };
  return { lift, pValue: twoSided(Math.abs((p2 - p1) / se)), ...relativeInterval(p2 - p1, spread, p1) };
}

function welchTest(left: Moment, right: Moment): CompareResult {
  const se = Math.sqrt(left.variance / left.n + right.variance / right.n);
  const lift = left.mean === 0 ? null : (right.mean - left.mean) / left.mean;
  if (!Number.isFinite(se) || se === 0) return { lift, pValue: 1, ciLow: lift, ciHigh: lift };
  return {
    lift,
    pValue: twoSided(Math.abs((right.mean - left.mean) / se)),
    ...relativeInterval(right.mean - left.mean, se, left.mean),
  };
}

function relativeInterval(diff: number, se: number, base: number): { ciLow: number | null; ciHigh: number | null } {
  if (base === 0) return { ciLow: null, ciHigh: null };
  return { ciLow: (diff - Z_ALPHA * se) / base, ciHigh: (diff + Z_ALPHA * se) / base };
}

function directedP(p: number, lift: number | null, direction: ExpectedChange): number {
  if (direction === "any") return p;
  const matches = direction === "increase" ? (lift ?? 0) > 0 : (lift ?? 0) < 0;
  return matches ? p / 2 : 1 - p / 2;
}

function emptyCompare(): CompareResult {
  return { lift: null, pValue: null, ciLow: null, ciHigh: null };
}

interface Moment {
  mean: number;
  variance: number;
  n: number;
}

function moment(arm: ArmMeasure, metric: ExperimentMetric): Moment | null {
  const mean = metricValue(arm, metric);
  if (mean == null || arm.users < 2) return null;
  const sum = metric === "orders" ? arm.orders : metric === "aov" ? arm.aovSum : arm.revenue;
  const sumSq = metric === "orders" ? arm.ordersSq : metric === "aov" ? arm.aovSq : arm.revenueSq;
  const variance = (sumSq - (sum * sum) / arm.users) / (arm.users - 1);
  if (!Number.isFinite(variance) || variance < 0) return null;
  return { mean, variance, n: arm.users };
}

function usersNeeded(control: ArmMeasure, treatment: ArmMeasure, metric: ExperimentMetric): number | null {
  if (metric === "conversion") {
    const p = control.conversion;
    if (p == null || p <= 0.02 || p >= 0.98) return null;
    const next = Math.min(0.98, p * 1.1);
    const delta = next - p;
    if (delta <= 0) return null;
    return Math.ceil(((Z_ALPHA + Z_BETA) ** 2 * (p * (1 - p) + next * (1 - next))) / (delta * delta));
  }
  const left = moment(control, metric);
  const right = moment(treatment, metric);
  if (!left || !right || left.mean === 0) return null;
  const delta = Math.abs(left.mean) * 0.1;
  if (delta === 0) return null;
  return Math.ceil(((Z_ALPHA + Z_BETA) ** 2 * (left.variance + right.variance)) / (delta * delta));
}

function twoSided(z: number): number {
  return Math.min(1, Math.max(0, 2 * (1 - normalCdf(z))));
}

function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp((-z * z) / 2);
  const p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z >= 0 ? 1 - p : p;
}

function chiSquareP(x: number, df: number): number {
  if (df <= 0) return 1;
  if (df === 1) return Math.min(1, Math.max(0, 1 - (2 * normalCdf(Math.sqrt(x)) - 1)));
  if (x <= 0) return 1;
  return Math.min(1, Math.max(0, 1 - lowerGamma(df / 2, x / 2)));
}

function lowerGamma(shape: number, x: number): number {
  let term = 1 / shape;
  let sum = term;
  for (let n = 1; n < 80; n += 1) {
    term *= x / (shape + n);
    sum += term;
    if (term < 1e-12 * sum) break;
  }
  const log = shape * Math.log(x) - x - logGamma(shape);
  return Math.exp(log) * sum;
}

function logGamma(z: number): number {
  const coefficients = [676.5203681218851, -1259.1392167224028, 771.3234287776531, -176.6150291621406, 12.507343278686905, -0.13857109526572012, 9.98436965407898e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  let value = 0.9999999999998099;
  for (let i = 0; i < coefficients.length; i += 1) value += coefficients[i] / (z + i);
  const shifted = z + coefficients.length - 1.5;
  return 0.5 * Math.log(2 * Math.PI) + (z - 0.5) * Math.log(shifted) - shifted + Math.log(value);
}

function metricName(metric: ExperimentMetric): string {
  if (metric === "conversion") return "Conversion";
  if (metric === "orders") return "Orders per customer";
  if (metric === "revenue") return "Revenue per customer";
  return "Average order value";
}

function formatLift(lift: number | null): string {
  if (lift == null || !Number.isFinite(lift)) return "";
  const points = Math.abs(lift * 100);
  return `${lift >= 0 ? "+" : "−"}${points.toFixed(1)}%`;
}
