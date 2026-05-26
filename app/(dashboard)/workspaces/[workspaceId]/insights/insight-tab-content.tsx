"use client";

import { useJob, type StreamingInsight } from "../workspace-jobs-context";
import { InsightCard } from "./insight-card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Lightbulb, Loader2 } from "lucide-react";
import type { InsightType } from "@prisma/client";

function InsightCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border p-4 animate-pulse">
      <div className="flex items-start justify-between gap-3 mb-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-5 w-10 rounded-full shrink-0" />
      </div>
      <Skeleton className="h-3 w-full mb-1.5" />
      <Skeleton className="h-3 w-5/6 mb-4" />
      <Skeleton className="h-1.5 w-full rounded-full" />
    </div>
  );
}

interface CommittedInsight {
  id: string;
  title: string;
  description: string;
  confidence: number;
  evidenceIds: string[];
  type: InsightType;
  metadata: unknown;
}

/** Compact card shown while insights are being streamed during synthesis. */
function StreamingInsightCard({ insight }: { insight: StreamingInsight }) {
  const pct = Math.round(
    typeof insight.confidence === "number" && isFinite(insight.confidence)
      ? insight.confidence * 100
      : 0
  );
  const colorClass =
    pct >= 75
      ? "bg-emerald-100 text-emerald-700"
      : pct >= 50
      ? "bg-violet-100 text-violet-700"
      : "bg-gray-100 text-gray-600";

  return (
    <div className="bg-white rounded-xl border border-violet-200 ring-1 ring-violet-100 p-4 animate-in fade-in slide-in-from-bottom-1 duration-200">
      <div className="flex items-start justify-between gap-3 mb-1.5">
        <p className="text-sm font-medium text-gray-900 leading-snug">
          {insight.title}
        </p>
        <span
          className={cn(
            "text-xs px-1.5 py-0.5 rounded font-medium shrink-0",
            colorClass
          )}
        >
          {pct}%
        </span>
      </div>
      <p className="text-xs text-gray-500 leading-relaxed line-clamp-3">
        {insight.description}
      </p>
    </div>
  );
}

/**
 * Insight tab that streams cards during synthesis and shows committed insights
 * at rest. Handles both 1-col list layout (quotes) and 2-col grid layout (all others).
 */
export function InsightTabContent({
  initialInsights,
  insightTypes,
  workspaceId,
  layout = "grid",
  emptyMessage,
}: {
  initialInsights: CommittedInsight[];
  /** Which InsightType strings this tab covers — used to filter streaming data. */
  insightTypes: string[];
  workspaceId: string;
  layout?: "grid" | "list";
  emptyMessage?: string;
}) {
  const { running, streamingInsights, insightsDone } = useJob("synthesize");

  const filteredStreaming = streamingInsights.filter((i) =>
    insightTypes.includes(i.type)
  );

  // Show live preview whenever synthesis is running AND there are no committed
  // insights yet (i.e., the workspace was just reset).
  const showStreaming = running && initialInsights.length === 0;

  // The "extracting" spinner should only show while we're still in the
  // extraction phase. Once insights_done fires, the count is final.
  const stillExtracting = running && !insightsDone;

  if (showStreaming) {
    if (filteredStreaming.length > 0) {
      return (
        <div className="space-y-3">
          {stillExtracting && (
            <div className="flex items-center gap-2 text-sm text-violet-600 font-medium">
              <Loader2 className="h-4 w-4 animate-spin" />
              Extracting… {filteredStreaming.length} found so far
            </div>
          )}
          <div
            className={
              layout === "grid"
                ? "grid grid-cols-1 md:grid-cols-2 gap-4"
                : "space-y-4"
            }
          >
            {filteredStreaming.map((insight, i) => (
              <StreamingInsightCard key={i} insight={insight} />
            ))}
          </div>
        </div>
      );
    }

    // Running but no matching insights yet — show skeleton placeholders.
    return (
      <div className="space-y-3">
        {stillExtracting && (
          <div className="flex items-center gap-2 text-sm text-violet-600 font-medium">
            <Loader2 className="h-4 w-4 animate-spin" />
            Extracting insights…
          </div>
        )}
        <div className={layout === "grid" ? "grid grid-cols-1 md:grid-cols-2 gap-4" : "space-y-4"}>
          {[0, 1, 2, 3].map((i) => <InsightCardSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  // Not streaming — render committed insights or empty state.
  if (initialInsights.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-dashed p-16 text-center">
        <Lightbulb className="h-10 w-10 text-gray-200 mx-auto mb-3" />
        <p className="text-sm text-gray-500 max-w-sm mx-auto">
          {emptyMessage ??
            "No insights in this category yet. Synthesize your workspace to extract insights from uploaded documents."}
        </p>
      </div>
    );
  }

  return (
    <div
      className={
        layout === "grid"
          ? "grid grid-cols-1 md:grid-cols-2 gap-4"
          : "space-y-4"
      }
    >
      {initialInsights.map((insight) => (
        <InsightCard key={insight.id} insight={insight} workspaceId={workspaceId} />
      ))}
    </div>
  );
}
