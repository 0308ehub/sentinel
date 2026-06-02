"use client";

import { useJob, type StreamingPainPoint } from "../workspace-jobs-context";
import { FilteredPainPoints } from "./filtered-pain-points";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, Loader2 } from "lucide-react";

function PainPointCardSkeleton() {
  return (
    <div className="bg-card rounded-xl border p-5 animate-pulse">
      <div className="flex items-start justify-between gap-4 mb-3">
        <Skeleton className="h-5 w-2/3" />
        <div className="flex gap-2 shrink-0">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      </div>
      <Skeleton className="h-3 w-full mb-1.5" />
      <Skeleton className="h-3 w-4/5" />
    </div>
  );
}

interface PainPoint {
  id: string;
  title: string;
  description: string;
  severity: number;
  urgency: number;
  frequency: number;
  affectedSegments: string[];
  evidenceIds: string[];
}

function severityBadgeClass(score: number) {
  if (score >= 8) return "bg-red-500/10 text-red-400 border-red-500/20";
  if (score >= 5) return "bg-orange-500/10 text-orange-400 border-orange-500/20";
  return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
}

function StreamingPainPointCard({ pp }: { pp: StreamingPainPoint }) {
  return (
    <div className="bg-card rounded-xl border border-indigo-500/30 shadow-sm ring-1 ring-indigo-500/10 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="px-5 pt-4 pb-0">
        <div className="flex items-start justify-between gap-4">
          <h3 className="text-base font-semibold text-foreground">{pp.title}</h3>
          <div className="flex items-center gap-2 shrink-0">
            <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full border", severityBadgeClass(pp.severity))}>
              Severity {Math.round(pp.severity)}/10
            </span>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Urgency {Math.round(pp.urgency)}/10
            </span>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
              {pp.frequency} {pp.frequency === 1 ? "mention" : "mentions"}
            </span>
          </div>
        </div>
      </div>
      <div className="px-5 pt-3 pb-4">
        <p className="text-sm text-muted-foreground leading-relaxed mb-3">{pp.description}</p>
        <div className="flex flex-wrap items-center gap-2">
          {pp.affectedSegments.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {pp.affectedSegments.map((seg) => (
                <Badge key={seg} variant="secondary" className="text-xs">{seg}</Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function PainPointsTabContent({
  initialPainPoints,
  workspaceId,
}: {
  initialPainPoints: PainPoint[];
  workspaceId: string;
}) {
  const { running, streamingPainPoints } = useJob("synthesize");

  // Show streaming preview when synthesizing and no committed pain points exist yet
  if (running && initialPainPoints.length === 0) {
    return (
      <div className="space-y-4">
        {streamingPainPoints.length > 0 ? (
          <>
            <div className="flex items-center gap-2 text-sm text-indigo-600 font-medium">
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyzing clusters… {streamingPainPoints.length} found so far
            </div>
            <div className="space-y-4">
              {streamingPainPoints.map((pp, i) => (
                <StreamingPainPointCard key={i} pp={pp} />
              ))}
            </div>
          </>
        ) : (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => <PainPointCardSkeleton key={i} />)}
          </div>
        )}
      </div>
    );
  }

  if (initialPainPoints.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-dashed p-16 text-center">
        <Lightbulb className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          No pain points extracted yet. Synthesize your workspace to extract insights.
        </p>
      </div>
    );
  }

  return <FilteredPainPoints painPoints={initialPainPoints} workspaceId={workspaceId} />;
}
