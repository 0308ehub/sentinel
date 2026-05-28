"use client";

import { useJob } from "../workspace-jobs-context";

export function PainPointsCountBadge({ initialCount }: { initialCount: number }) {
  const { streamingPainPoints } = useJob("synthesize");
  // Show live streaming count whenever data is present — even after `running`
  // flips false on "done" (streamingPainPoints lives for ~3 s until auto-cleared
  // and the page refresh brings the real initialCount from the DB).
  const count = streamingPainPoints.length > 0 ? streamingPainPoints.length : initialCount;
  return (
    <span className="ml-1.5 text-xs bg-gray-100 text-gray-600 rounded-full px-1.5 py-0.5 font-medium">
      {count}
    </span>
  );
}
