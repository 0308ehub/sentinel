export interface DirectionalCount { visitors: number; conversions: number }

export function directionalComparison(before: DirectionalCount, after: DirectionalCount) {
  return {
    beforeRate: before.visitors ? before.conversions / before.visitors : null,
    afterRate: after.visitors ? after.conversions / after.visitors : null,
  };
}

export function directionalNote(before: DirectionalCount, after: DirectionalCount): string {
  const comparison = directionalComparison(before, after);
  const pct = (rate: number | null) => rate == null ? "—" : `${(rate * 100).toFixed(1)}%`;
  return `Kept on. Directional only: ${pct(comparison.beforeRate)} before → ${pct(comparison.afterRate)} after (${before.visitors} and ${after.visitors} visitors). Not proven.`;
}
