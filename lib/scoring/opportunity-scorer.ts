export interface RawScores {
  impact: number;
  confidence: number;
  urgency: number;
  effort: number;
  risk: number;
}

export function calculateTotalScore(scores: RawScores): number {
  const raw =
    scores.impact * 0.35 +
    scores.confidence * 0.25 +
    scores.urgency * 0.20 +
    (6 - scores.effort) * 0.15 +
    (6 - scores.risk) * 0.05;

  // Normalize to 0-100
  return Math.round((raw / 5) * 100 * 10) / 10;
}
