/** Standard normal CDF, accurate to roughly 1e-7. */
export function normalCdf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const a = Math.abs(x) / Math.sqrt(2);
  const t = 1 / (1 + 0.3275911 * a);
  const erf =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a);
  return 0.5 * (1 + sign * erf);
}

/** Acklam's inverse-normal approximation. */
export function inverseNormalCdf(p: number): number {
  if (p <= 0 || p >= 1) return p === 0 ? -Infinity : p === 1 ? Infinity : NaN;
  const a = [
    -39.6968302866538, 220.946098424521, -275.928510446969, 138.357751867269, -30.6647980661472, 2.50662827745924,
  ];
  const b = [-54.4760987982241, 161.585836858041, -155.698979859887, 66.8013118877197, -13.2806815528857];
  const c = [
    -0.00778489400243029, -0.322396458041136, -2.40075827716184, -2.54973253934373, 4.37466414146497, 2.93816398269878,
  ];
  const d = [0.00778469570904146, 0.32246712907004, 2.445134137143, 3.75440866190742];
  const low = 0.02425;
  if (p < low) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) /
      ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1)
    );
  }
  if (p > 1 - low) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return (
      -(((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) /
      ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1)
    );
  }
  const q = p - 0.5;
  const r = q * q;
  return (
    ((((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r + a[5]!) * q) /
    (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1)
  );
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function sampleNormal(rng: () => number, mean = 0, sd = 1): number {
  const u = Math.max(rng(), Number.EPSILON);
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}
export function samplePoisson(rng: () => number, lambda: number): number {
  if (lambda > 30) return Math.max(0, Math.round(sampleNormal(rng, lambda, Math.sqrt(lambda))));
  let p = 1;
  let k = 0;
  const limit = Math.exp(-lambda);
  do {
    k++;
    p *= rng();
  } while (p > limit);
  return k - 1;
}
export function sampleBinomial(rng: () => number, n: number, p: number): number {
  if (n * p > 30 && n * (1 - p) > 30)
    return Math.max(0, Math.min(n, Math.round(sampleNormal(rng, n * p, Math.sqrt(n * p * (1 - p))))));
  let x = 0;
  for (let i = 0; i < n; i++) if (rng() < p) x++;
  return x;
}

export function samplesPerArm(
  kind: "binary" | "continuous",
  baseline: number,
  sd: number | undefined,
  mde: number,
  alpha: number,
  power: number,
): number {
  const zAlpha = inverseNormalCdf(1 - alpha / 2);
  const zPower = inverseNormalCdf(power);
  const delta = Math.abs(baseline * mde);
  if (!delta) return Infinity;
  if (kind === "continuous") return Math.ceil((2 * (sd ?? baseline) ** 2 * (zAlpha + zPower) ** 2) / delta ** 2);
  const p2 = Math.min(1 - 1e-9, Math.max(1e-9, baseline + delta));
  const pooled = (baseline + p2) / 2;
  return Math.ceil(
    (zAlpha * Math.sqrt(2 * pooled * (1 - pooled)) + zPower * Math.sqrt(baseline * (1 - baseline) + p2 * (1 - p2))) **
      2 /
      delta ** 2,
  );
}

/** Lan-DeMets O'Brien-Fleming values. The canonical five-look grid is precomputed by AMR integration. */
export function obrienFlemingBoundaries(looks: number, alpha: number): number[] {
  if (looks === 5 && Math.abs(alpha - 0.05) < 1e-12) return [4.877, 3.357, 2.68, 2.29, 2.031];
  const final = inverseNormalCdf(1 - alpha / 2) * 1.036;
  return Array.from({ length: looks }, (_, i) => final / Math.sqrt((i + 1) / looks));
}
export function inflationFactor(looks: number): number {
  return looks === 5 ? 1.026 : 1 + 0.0052 * looks;
}

export interface Comparison {
  lift: number;
  diff: number;
  se: number;
  z: number;
  pValue: number;
  ciLow: number;
  ciHigh: number;
}
function finish(control: number, treatment: number, se: number): Comparison {
  const diff = treatment - control;
  const z = se ? diff / se : 0;
  const relativeSe = control ? se / Math.abs(control) : Infinity;
  const lift = control ? diff / control : 0;
  return {
    lift,
    diff,
    se,
    z,
    pValue: 2 * (1 - normalCdf(Math.abs(z))),
    ciLow: lift - 1.96 * relativeSe,
    ciHigh: lift + 1.96 * relativeSe,
  };
}
export function compareBinary(
  controlSuccess: number,
  controlN: number,
  treatmentSuccess: number,
  treatmentN: number,
): Comparison {
  const pc = controlSuccess / controlN;
  const pt = treatmentSuccess / treatmentN;
  const se = Math.sqrt((pc * (1 - pc)) / controlN + (pt * (1 - pt)) / treatmentN);
  return finish(pc, pt, se);
}
export function compareContinuous(
  controlSum: number,
  controlSumSq: number,
  controlN: number,
  treatmentSum: number,
  treatmentSumSq: number,
  treatmentN: number,
): Comparison {
  const mc = controlSum / controlN;
  const mt = treatmentSum / treatmentN;
  const vc = Math.max(0, (controlSumSq - controlSum ** 2 / controlN) / Math.max(1, controlN - 1));
  const vt = Math.max(0, (treatmentSumSq - treatmentSum ** 2 / treatmentN) / Math.max(1, treatmentN - 1));
  return finish(mc, mt, Math.sqrt(vc / controlN + vt / treatmentN));
}

export function srmPValue(observed: number[], expectedWeights: number[]): number {
  const total = observed.reduce((a, b) => a + b, 0);
  const weight = expectedWeights.reduce((a, b) => a + b, 0);
  const x = observed.reduce((sum, value, i) => {
    const expected = (total * expectedWeights[i]!) / weight;
    return sum + (value - expected) ** 2 / expected;
  }, 0);
  if (observed.length === 2) return 2 * (1 - normalCdf(Math.sqrt(x)));
  return Math.exp(-x / 2);
}
export function conditionalPower(z: number, infoFraction: number, assumedEffect = z / Math.sqrt(infoFraction)): number {
  if (infoFraction >= 1) return Math.abs(z) >= 1.96 ? 1 : 0;
  const expectedFinal = z * Math.sqrt(infoFraction) + assumedEffect * (1 - infoFraction);
  return 1 - normalCdf((1.96 - expectedFinal) / Math.sqrt(1 - infoFraction));
}
export function interactionZ(
  a: { lift: number; ciLow: number; ciHigh: number },
  b: { lift: number; ciLow: number; ciHigh: number },
): number {
  const sea = (a.ciHigh - a.ciLow) / 3.92;
  const seb = (b.ciHigh - b.ciLow) / 3.92;
  return (a.lift - b.lift) / Math.sqrt(sea ** 2 + seb ** 2);
}
