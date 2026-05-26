"use client";

import { useJob } from "../workspace-jobs-context";

/**
 * Live count badge for an insight tab. While synthesis is streaming, shows
 * the running tally of insights matching `insightTypes`; otherwise falls back
 * to the server-rendered `initialCount`.
 */
export function InsightCountBadge({
  initialCount,
  insightTypes,
}: {
  initialCount: number;
  insightTypes: string[];
}) {
  const { streamingInsights } = useJob("synthesize");
  const streamingCount = streamingInsights.filter((i) =>
    insightTypes.includes(i.type)
  ).length;
  const count = streamingCount > 0 ? streamingCount : initialCount;

  return (
    <span className="ml-1.5 text-xs bg-gray-100 text-gray-600 rounded-full px-1.5 py-0.5 font-medium">
      {count}
    </span>
  );
}
