"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useJob, type StreamingOpportunity } from "../workspace-jobs-context";
import { OpportunityCard } from "./opportunity-card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Target, Loader2 } from "lucide-react";

// ---------------------------------------------------------------------------
// Skeleton — shaped like OpportunityCard so layout doesn't jump
// ---------------------------------------------------------------------------
function OpportunityCardSkeleton({ index }: { index: number }) {
  return (
    <div className="bg-white rounded-xl border p-5 animate-pulse">
      <div className="flex items-start gap-4">
        {/* Rank circle */}
        <div className="w-8 h-8 rounded-full bg-gray-100 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
            </div>
            {/* Score badge */}
            <Skeleton className="h-14 w-[72px] rounded-xl shrink-0" />
          </div>
          {/* Problem block */}
          <div className="mt-4 space-y-1.5">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </div>
          {/* Score pills */}
          <div className="flex gap-4 mt-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-10 rounded" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Streaming preview card — shown as each opportunity arrives
// ---------------------------------------------------------------------------
function scoreColor(score: number) {
  if (score >= 80) return "text-emerald-400 bg-emerald-500/10 border-emerald-500/25";
  if (score >= 60) return "text-amber-400 bg-amber-500/10 border-amber-500/25";
  return "text-red-400 bg-red-500/10 border-red-500/25";
}

function StreamingOpportunityCard({
  opp,
  index,
}: {
  opp: StreamingOpportunity;
  index: number;
}) {
  return (
    <div className="bg-card rounded-xl border border-indigo-500/30 ring-1 ring-indigo-500/10 p-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-start gap-4">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-bold text-sm shrink-0 mt-0.5">
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-foreground mb-1">{opp.title}</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{opp.description}</p>
            </div>
            <div
              className={cn(
                "flex flex-col items-center justify-center min-w-[72px] rounded-xl border-2 px-3 py-2 shrink-0",
                scoreColor(opp.totalScore)
              )}
            >
              <span className="text-2xl font-bold leading-none">{opp.totalScore.toFixed(0)}</span>
              <span className="text-xs font-medium mt-0.5 opacity-70">score</span>
            </div>
          </div>
          {/* Mini score pills */}
          <div className="flex items-center gap-4 mt-4">
            {[
              { label: "Impact", value: opp.impactScore },
              { label: "Urgency", value: opp.urgencyScore },
            ].map(({ label, value }) => (
              <div key={label} className="flex flex-col items-center">
                <span className="text-sm font-bold text-foreground/80">{value.toFixed(0)}</span>
                <span className="text-xs text-muted-foreground/70">{label}</span>
              </div>
            ))}
            {opp.targetSegments.length > 0 && (
              <span className="text-xs text-gray-400 ml-auto">
                {opp.targetSegments.slice(0, 2).join(", ")}
                {opp.targetSegments.length > 2 ? ` +${opp.targetSegments.length - 2}` : ""}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------
interface CommittedOpportunity {
  id: string;
  title: string;
  description: string;
  problemStatement: string;
  proposedSolution: string | null;
  impactScore: number;
  confidenceScore: number;
  urgencyScore: number;
  effortScore: number;
  riskScore: number;
  totalScore: number;
  targetSegments: string[];
  status: "PROPOSED" | "ACCEPTED" | "REJECTED" | "IN_PROGRESS" | "SHIPPED";
}

export function OpportunitiesClient({
  initialOpportunities,
  workspaceId,
}: {
  initialOpportunities: CommittedOpportunity[];
  workspaceId: string;
}) {
  const router = useRouter();
  const { running: synthesizing, streamingOpportunities: synthOpps } =
    useJob("synthesize");
  const { running: generating, streamingOpportunities: genOpps } =
    useJob("generate-opportunities");

  const isRunning = synthesizing || generating;
  // Use whichever job has arrived opportunities; fall through to the other.
  const streamingOpps = synthOpps.length > 0 ? synthOpps : genOpps;

  // When either job finishes, refresh this route's server data so committed
  // opportunities replace the (potentially stale) initialOpportunities.
  // router.refresh() from SynthesizeButton only refreshes the insights route;
  // this component is responsible for refreshing its own route.
  const prevRunning = useRef(isRunning);
  useEffect(() => {
    if (prevRunning.current && !isRunning) {
      router.refresh();
    }
    prevRunning.current = isRunning;
  }, [isRunning, router]);

  // ---- Streaming state — show as soon as the first opportunity arrives ----
  // Keep showing these even after isRunning goes false so there's no flash of
  // empty state while router.refresh() re-fetches committed data from the DB.
  if (streamingOpps.length > 0) {
    return (
      <div className="space-y-4">
        {isRunning && (
          <div className="flex items-center gap-2 text-sm text-indigo-600 font-medium">
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating… {streamingOpps.length} so far
          </div>
        )}
        {streamingOpps.map((opp, i) => (
          <StreamingOpportunityCard key={i} opp={opp} index={i} />
        ))}
        {/* Trailing skeleton only while still running */}
        {isRunning && <OpportunityCardSkeleton index={streamingOpps.length} />}
      </div>
    );
  }

  // ---- Running but nothing streamed yet ----
  if (isRunning && initialOpportunities.length === 0) {
    // No committed data to show — render skeleton placeholders.
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-indigo-600 font-medium">
          <Loader2 className="h-4 w-4 animate-spin" />
          Generating opportunities…
        </div>
        {[0, 1, 2].map((i) => (
          <OpportunityCardSkeleton key={i} index={i} />
        ))}
      </div>
    );
  }

  // ---- Empty state (not running) ----
  if (initialOpportunities.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-dashed p-16 text-center">
        <Target className="h-12 w-12 text-gray-200 mx-auto mb-4" />
        <h3 className="font-semibold text-gray-900 mb-2">No opportunities yet</h3>
        <p className="text-sm text-gray-500 max-w-sm mx-auto">
          Generate opportunities from your synthesized pain points and insights.
        </p>
      </div>
    );
  }

  // ---- Committed list ----
  return (
    <div className="space-y-4">
      {initialOpportunities.map((opp, index) => (
        <OpportunityCard
          key={opp.id}
          opp={opp}
          workspaceId={workspaceId}
          index={index}
        />
      ))}
    </div>
  );
}
