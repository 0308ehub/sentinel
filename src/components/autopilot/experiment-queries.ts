"use client";

import { useQuery, type QueryClient } from "@tanstack/react-query";
import type { ExperimentActivity } from "@/lib/autopilot/activity-core";
import type { ChangeSummary } from "@/lib/autopilot/change-summary";
import type { Experiment } from "@/lib/autopilot/types";

export type { ExperimentActivity };

export type ChangeFile = { filename?: string; status?: string; additions?: number; deletions?: number; patch?: string };
export type ExperimentChanges = {
  source: "none" | "draft" | "branch" | "pull";
  branch?: string;
  previewUrl?: string | null;
  siteUrl?: string | null;
  ownRepo?: boolean;
  files?: ChangeFile[];
  checks?: "pending" | "success" | "failure" | "none";
  pull?: {
    title?: string;
    state: "open" | "closed" | "merged";
    url?: string;
    additions?: number;
    deletions?: number;
    changedFiles?: number;
    files?: ChangeFile[];
  };
};
export type ExperimentSummary = { summary?: ChangeSummary; pending?: boolean; siteUrl?: string | null };
export type ExperimentSnapshot = {
  status: "none" | "rendering" | "ready" | "failed";
  scenario?: string | null;
  error?: string | null;
  controlHtml?: string | null;
  treatmentHtml?: string | null;
  stage?: "setting_up" | "rendering_current" | "rendering_new" | "checking" | "ready";
  elapsedMinutes?: number;
};
export type DailyVisitors = { day: string; control: number; treatment: number };

const STALE_TIME = 5 * 60 * 1000;
const GC_TIME = 30 * 60 * 1000;
// PR checks and merge state move on their own; cached data still shows instantly while this refreshes.
const CHANGES_STALE_TIME = 30 * 1000;

export function experimentRevision(experiment: Pick<Experiment, "id" | "prNumber" | "branch" | "draftPath" | "version">) {
  return [experiment.id, experiment.prNumber ?? null, experiment.branch ?? null, experiment.draftPath ?? null, experiment.version] as const;
}

export const experimentQueryKeys = {
  summary: (experiment: Pick<Experiment, "id" | "prNumber" | "branch" | "draftPath" | "version">) =>
    ["experiment", "summary", ...experimentRevision(experiment)] as const,
  // Status is in the key so a merge or a new build shows at once; checks refresh via the short stale time.
  changes: (experiment: Pick<Experiment, "id" | "prNumber" | "branch" | "draftPath" | "version" | "status">, cleanup = false) =>
    ["experiment", "changes", ...experimentRevision(experiment), experiment.status, cleanup] as const,
  snapshot: (experiment: Pick<Experiment, "id" | "prNumber" | "branch" | "draftPath" | "version">) =>
    ["experiment", "snapshot", ...experimentRevision(experiment)] as const,
  visitors: (experiment: Pick<Experiment, "id" | "startedAt" | "version">) =>
    ["experiment", "visitors", experiment.id, experiment.startedAt ?? null, experiment.version] as const,
};

async function jsonRequest<T>(url: string, message: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { cache: "no-store", signal });
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(body.error || message);
  return body;
}

export function summaryQueryOptions(experiment: Experiment) {
  return {
    queryKey: experimentQueryKeys.summary(experiment),
    queryFn: ({ signal }: { signal: AbortSignal }) => jsonRequest<ExperimentSummary>(`/api/autopilot/experiments/${experiment.id}/summary`, "Could not load the change summary.", signal),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  };
}

export function changesQueryOptions(experiment: Experiment, cleanup = false) {
  return {
    queryKey: experimentQueryKeys.changes(experiment, cleanup),
    queryFn: ({ signal }: { signal: AbortSignal }) => jsonRequest<ExperimentChanges>(`/api/autopilot/experiments/${experiment.id}/changes${cleanup ? "?cleanup=1" : ""}`, "", signal),
    staleTime: CHANGES_STALE_TIME,
    gcTime: GC_TIME,
  };
}

export function snapshotQueryOptions(experiment: Experiment) {
  return {
    queryKey: experimentQueryKeys.snapshot(experiment),
    queryFn: ({ signal }: { signal: AbortSignal }) => jsonRequest<ExperimentSnapshot>(`/api/autopilot/experiments/${experiment.id}/snapshot`, "Could not load the sample preview.", signal),
    staleTime: 10_000,
    gcTime: GC_TIME,
  };
}

export interface VisitorActivity {
  series: DailyVisitors[];
  activity: ExperimentActivity | null;
}

const LIVE_STATUS = new Set<Experiment["status"]>(["queued", "running", "awaiting_rollout", "rolling_out"]);

export function visitorSeriesQueryOptions(experiment: Experiment | null) {
  const live = experiment != null && LIVE_STATUS.has(experiment.status);
  return {
    queryKey: experiment ? experimentQueryKeys.visitors(experiment) : (["experiment", "visitors", "none"] as const),
    enabled: Boolean(experiment?.startedAt),
    queryFn: async ({ signal }: { signal: AbortSignal }) => {
      if (!experiment) return { series: [], activity: null } satisfies VisitorActivity;
      const body = await jsonRequest<{ series?: DailyVisitors[]; activity?: ExperimentActivity | null }>(`/api/autopilot/experiments/${experiment.id}`, "Could not load visitors.", signal);
      return { series: body.series ?? [], activity: body.activity ?? null } satisfies VisitorActivity;
    },
    staleTime: 10_000,
    gcTime: GC_TIME,
    refetchInterval: (live ? 15_000 : false) as number | false,
  };
}

export function useExperimentSummary(experiment: Experiment) { return useQuery(summaryQueryOptions(experiment)); }
export function useExperimentChanges(experiment: Experiment, options: { cleanup?: boolean } = {}) { return useQuery(changesQueryOptions(experiment, options.cleanup)); }
export function useExperimentSnapshot(experiment: Experiment) { return useQuery(snapshotQueryOptions(experiment)); }
export function useVisitorSeries(experiment: Experiment | null) { return useQuery(visitorSeriesQueryOptions(experiment)); }

export async function prefetchExperiment(queryClient: QueryClient, experiment: Experiment) {
  const requests = [
    queryClient.prefetchQuery(summaryQueryOptions(experiment)),
    queryClient.prefetchQuery(changesQueryOptions(experiment)),
  ];
  if (experiment.startedAt) requests.push(queryClient.prefetchQuery(visitorSeriesQueryOptions(experiment)));
  await Promise.all(requests);
}
