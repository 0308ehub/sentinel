export interface GoalFindingInput {
  goal: string;
  now: string | Date;
  minVisitors: number;
  visitors: Array<{ firstAt: string; pages: string[]; converted: boolean }>;
}

export interface ComputedFinding { title: string; body: string }

const percent = (value: number): string => `${(value * 100).toFixed(1)}%`;
const rate = (converted: number, total: number): number => total ? converted / total : 0;
const ratioAtLeast = (a: number, b: number, threshold: number): boolean => b === 0 ? a > 0 : a / b >= threshold;

export function computeGoalFindings(input: GoalFindingInput): ComputedFinding[] {
  const cutoff = new Date(input.now).getTime() - 14 * 86_400_000;
  const groups = { new: input.visitors.filter((v) => new Date(v.firstAt).getTime() >= cutoff), returning: input.visitors.filter((v) => new Date(v.firstAt).getTime() < cutoff) };
  const findings: ComputedFinding[] = [];
  if (groups.new.length >= input.minVisitors && groups.returning.length >= input.minVisitors) {
    const newRate = rate(groups.new.filter((v) => v.converted).length, groups.new.length);
    const returningRate = rate(groups.returning.filter((v) => v.converted).length, groups.returning.length);
    if (ratioAtLeast(returningRate, newRate, 1.5)) findings.push({
      title: `New visitors rarely reach “${input.goal}”`,
      body: `Only ${percent(newRate)} of new visitors reached ${input.goal} in the last 14 days, versus ${percent(returningRate)} of returning visitors.`,
    });
  }
  const pageMap = new Map<string, typeof input.visitors>();
  for (const visitor of input.visitors) for (const page of new Set(visitor.pages)) pageMap.set(page, [...(pageMap.get(page) ?? []), visitor]);
  const pages = [...pageMap].map(([page, viewers]) => {
    const nonViewers = input.visitors.filter((v) => !v.pages.includes(page));
    return { page, viewers, viewerRate: rate(viewers.filter((v) => v.converted).length, viewers.length),
      nonViewerRate: rate(nonViewers.filter((v) => v.converted).length, nonViewers.length), converters: viewers.filter((v) => v.converted).length };
  }).filter((p) => p.viewers.length >= input.minVisitors);
  const associated = pages.filter((p) => p.converters >= 10 && ratioAtLeast(p.viewerRate, p.nonViewerRate, 2))
    .sort((a, b) => b.viewerRate / Math.max(b.nonViewerRate, 0.000001) - a.viewerRate / Math.max(a.nonViewerRate, 0.000001)).slice(0, 2);
  for (const page of associated) findings.push({ title: `Visitors who open ${page.page} reach “${input.goal}” far more often`,
    body: `${percent(page.viewerRate)} of visitors who opened ${page.page} reached ${input.goal}, versus ${percent(page.nonViewerRate)} who did not.` });
  const overall = rate(input.visitors.filter((v) => v.converted).length, input.visitors.length);
  const busyCutoff = [...pages].sort((a, b) => a.viewers.length - b.viewers.length)[Math.floor(pages.length * 0.75)]?.viewers.length ?? Infinity;
  const deadEnds = pages.filter((p) => p.viewers.length >= busyCutoff && p.viewerRate <= overall / 2).sort((a, b) => b.viewers.length - a.viewers.length).slice(0, 2);
  for (const page of deadEnds) findings.push({ title: `Most visitors to ${page.page} never reach “${input.goal}”`,
    body: `Only ${percent(page.viewerRate)} of visitors who opened ${page.page} reached ${input.goal}, versus ${percent(overall)} overall.` });
  return findings;
}

export function retentionFinding(eligible: number, returned: number, minVisitors: number): ComputedFinding | null {
  if (eligible < minVisitors || rate(returned, eligible) >= 0.3) return null;
  return { title: "Few new visitors come back", body: `Only ${percent(rate(returned, eligible))} of visitors first seen 8–14 days ago came back within 7 days.` };
}
