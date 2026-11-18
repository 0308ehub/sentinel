export interface RateCount {
  visitors: number;
  conversions: number;
}

export interface RateComparison {
  lift: number | null;
  pValue: number | null;
}

export interface SrmResult {
  pValue: number;
  expected: [number, number];
  observed: [number, number];
}

/** Classic two-sided two-proportion z-test, retained for descriptive display. */
export function compareRates(control: RateCount, treatment: RateCount): RateComparison {
  if (control.visitors === 0 || treatment.visitors === 0) return { lift: null, pValue: null };
  const controlRate = control.conversions / control.visitors;
  const treatmentRate = treatment.conversions / treatment.visitors;
  const pooled = (control.conversions + treatment.conversions) / (control.visitors + treatment.visitors);
  const standardError = Math.sqrt(pooled * (1 - pooled) * (1 / control.visitors + 1 / treatment.visitors));
  const lift = controlRate > 0 ? (treatmentRate - controlRate) / controlRate : null;
  if (standardError === 0) return { lift, pValue: null };
  const z = (treatmentRate - controlRate) / standardError;
  return { lift, pValue: Math.min(1, 2 * (1 - normalCdf(Math.abs(z)))) };
}

/** Chi-square goodness-of-fit check for the configured two-arm allocation. */
export function srmCheck(controlVisitors: number, treatmentVisitors: number, expectedTreatmentShare: number): SrmResult {
  const total = controlVisitors + treatmentVisitors;
  const share = Math.min(1 - Number.EPSILON, Math.max(Number.EPSILON, expectedTreatmentShare));
  const expected: [number, number] = [total * (1 - share), total * share];
  const observed: [number, number] = [controlVisitors, treatmentVisitors];
  if (total === 0) return { pValue: 1, expected, observed };
  const chiSquare = observed.reduce((sum, value, index) => sum + ((value - expected[index]) ** 2) / expected[index], 0);
  // For one degree of freedom, the chi-square survival function is 2 * (1 - Phi(sqrt(x))).
  const pValue = Math.min(1, Math.max(0, 2 * (1 - normalCdf(Math.sqrt(chiSquare)))));
  return { pValue, expected, observed };
}

/**
 * Always-valid p-value from a normal-mixture sequential probability ratio test.
 * The null variance uses the pooled Bernoulli estimate and the alternative mixes
 * the absolute rate difference over N(0, tauSquared).
 */
export function sequentialPValue(control: RateCount, treatment: RateCount, tauSquared: number): number | null {
  const evidence = mixtureEvidence(control, treatment, tauSquared);
  return evidence == null ? null : Math.min(1, 1 / evidence.ratio);
}

/** One-sided always-valid p-value for the alternative that treatment is lower. */
export function sequentialDecreasePValue(control: RateCount, treatment: RateCount, tauSquared: number): number | null {
  const evidence = mixtureEvidence(control, treatment, tauSquared);
  if (evidence == null) return null;
  const negativeMass = normalCdf(-evidence.difference * Math.sqrt(evidence.tauSquared) /
    Math.sqrt(evidence.variance * (evidence.variance + evidence.tauSquared)));
  const oneSidedEvidence = 2 * evidence.ratio * negativeMass;
  return Math.min(1, 1 / oneSidedEvidence);
}

function mixtureEvidence(control: RateCount, treatment: RateCount, tauSquared: number) {
  if (control.visitors === 0 || treatment.visitors === 0 || tauSquared <= 0 || !Number.isFinite(tauSquared)) return null;
  const pooled = (control.conversions + treatment.conversions) / (control.visitors + treatment.visitors);
  const variance = pooled * (1 - pooled) * (1 / control.visitors + 1 / treatment.visitors);
  if (variance <= 0 || !Number.isFinite(variance)) return null;
  const difference = treatment.conversions / treatment.visitors - control.conversions / control.visitors;
  const ratio = Math.sqrt(variance / (variance + tauSquared)) *
    Math.exp((difference * difference * tauSquared) / (2 * variance * (variance + tauSquared)));
  return { difference, ratio, tauSquared, variance };
}

// Abramowitz-Stegun 7.1.26, sufficient for probability display and decisions here.
function normalCdf(z: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const erf = 1 - (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t) *
    Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}
