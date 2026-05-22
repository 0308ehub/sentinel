"use client";

import { useJob } from "../workspace-jobs-context";

export function PainPointsCountBadge({ initialCount }: { initialCount: number }) {
  const { running, streamingPainPoints } = useJob("synthesize");
  const count = running && streamingPainPoints.length > 0 ? streamingPainPoints.length : initialCount;
  return (
    <span className="ml-1.5 text-xs bg-gray-100 text-gray-600 rounded-full px-1.5 py-0.5 font-medium">
      {count}
    </span>
  );
}
