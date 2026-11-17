"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ExploreSpec, SegmentFilter } from "@/lib/analytics/explore-types";
import {
  decodeBoard,
  type SavedDashboard,
  type SavedMetric,
  type SavedSegment,
  type ShareBoard,
} from "@/lib/analytics/library";

interface AnalyticsLibraryState {
  segments: SavedSegment[];
  metrics: SavedMetric[];
  dashboards: SavedDashboard[];
  activeDashboardId: string | null;
  saveSegment: (input: { name: string; description: string; filter: SegmentFilter }) => string;
  deleteSegment: (id: string) => void;
  saveMetric: (input: Omit<SavedMetric, "id">) => string;
  deleteMetric: (id: string) => void;
  ensureDashboard: () => string;
  createDashboard: (name?: string) => string;
  renameDashboard: (id: string, name: string) => void;
  deleteDashboard: (id: string) => void;
  setActiveDashboard: (id: string) => void;
  addCard: (dashboardId: string, card: { title: string; spec: ExploreSpec }) => void;
  removeCard: (dashboardId: string, cardId: string) => void;
  importShared: (token: string) => string | null;
  rememberShare: (dashboardId: string, token: string) => void;
}

function nid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;
}

export const useAnalyticsLibrary = create<AnalyticsLibraryState>()(
  persist(
    (set, get) => ({
      segments: [],
      metrics: [],
      dashboards: [],
      activeDashboardId: null,

      saveSegment: (input) => {
        const id = nid("seg");
        const segment: SavedSegment = {
          id,
          name: input.name.trim().slice(0, 80) || "Segment",
          description: input.description.trim().slice(0, 240),
          filter: input.filter,
        };
        set((state) => ({ segments: [segment, ...state.segments] }));
        return id;
      },

      deleteSegment: (id) => {
        set((state) => ({
          segments: state.segments.filter((segment) => segment.id !== id),
          metrics: state.metrics.map((metric) => (metric.segmentId === id ? { ...metric, segmentId: null } : metric)),
        }));
      },

      saveMetric: (input) => {
        const id = nid("met");
        const metric: SavedMetric = { ...input, id, name: input.name.trim().slice(0, 80) || "Metric" };
        set((state) => ({ metrics: [metric, ...state.metrics] }));
        return id;
      },

      deleteMetric: (id) => set((state) => ({ metrics: state.metrics.filter((metric) => metric.id !== id) })),

      ensureDashboard: () => {
        const current = get();
        if (current.activeDashboardId && current.dashboards.some((board) => board.id === current.activeDashboardId)) {
          return current.activeDashboardId;
        }
        return get().createDashboard();
      },

      createDashboard: (name) => {
        const board: SavedDashboard = {
          id: nid("board"),
          name: name?.trim().slice(0, 80) || "Untitled board",
          shareToken: null,
          cards: [],
        };
        set((state) => ({ dashboards: [board, ...state.dashboards], activeDashboardId: board.id }));
        return board.id;
      },

      renameDashboard: (id, name) => {
        set((state) => ({
          dashboards: state.dashboards.map((board) =>
            board.id === id ? { ...board, name: name.trim().slice(0, 80) || board.name, shareToken: null } : board
          ),
        }));
      },

      deleteDashboard: (id) => {
        set((state) => {
          const dashboards = state.dashboards.filter((board) => board.id !== id);
          return {
            dashboards,
            activeDashboardId: state.activeDashboardId === id ? dashboards[0]?.id ?? null : state.activeDashboardId,
          };
        });
      },

      setActiveDashboard: (id) => set({ activeDashboardId: id }),

      addCard: (dashboardId, card) => {
        set((state) => ({
          dashboards: state.dashboards.map((board) => {
            if (board.id !== dashboardId || board.cards.length >= 8) return board;
            return {
              ...board,
              shareToken: null,
              cards: [...board.cards, { id: nid("card"), title: card.title.slice(0, 80), spec: card.spec }],
            };
          }),
        }));
      },

      removeCard: (dashboardId, cardId) => {
        set((state) => ({
          dashboards: state.dashboards.map((board) =>
            board.id === dashboardId
              ? { ...board, shareToken: null, cards: board.cards.filter((card) => card.id !== cardId) }
              : board
          ),
        }));
      },

      importShared: (token) => {
        const board = decodeBoard(token);
        if (!board) return null;
        const existing = get().dashboards.find((item) => item.shareToken === token);
        if (existing) {
          set({ activeDashboardId: existing.id });
          return existing.id;
        }
        const imported = materialize(board, token);
        set((state) => ({ dashboards: [imported, ...state.dashboards], activeDashboardId: imported.id }));
        return imported.id;
      },

      rememberShare: (dashboardId, token) => {
        set((state) => ({
          dashboards: state.dashboards.map((board) => (board.id === dashboardId ? { ...board, shareToken: token } : board)),
        }));
      },
    }),
    {
      name: "kismet-analytics",
      version: 1,
      partialize: (state) => ({
        segments: state.segments,
        metrics: state.metrics,
        dashboards: state.dashboards,
        activeDashboardId: state.activeDashboardId,
      }),
    }
  )
);

const CHART_KINDS = new Set<ExploreSpec["kind"]>(["line", "area", "bar", "metric", "table", "funnel"]);
const MEASURES = new Set<ExploreSpec["measure"]>(["uniques", "totals", "revenue", "aov", "frequency"]);
const BREAKDOWNS = new Set<ExploreSpec["breakdown"]>(["product", "payment"]);

function recordOf(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function textOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function filterFrom(value: unknown): SegmentFilter {
  const filter = recordOf(value) ?? {};
  return {
    product: textOrNull(filter.product),
    payment: textOrNull(filter.payment),
    minOrders: typeof filter.minOrders === "number" ? filter.minOrders : 1,
    customerId: textOrNull(filter.customerId),
    city: textOrNull(filter.city),
    state: textOrNull(filter.state),
  };
}

function stepFrom(value: unknown): { kind: "any" | "product"; product?: string }[] {
  const row = recordOf(value);
  if (row?.kind === "product") {
    return [{ kind: "product", product: typeof row.product === "string" ? row.product : undefined }];
  }
  if (row?.kind === "any") return [{ kind: "any" }];
  return [];
}

function specFrom(value: unknown): ExploreSpec | null {
  const spec = recordOf(value);
  if (!spec || !CHART_KINDS.has(spec.kind as ExploreSpec["kind"]) || !MEASURES.has(spec.measure as ExploreSpec["measure"])) {
    return null;
  }
  const events = Array.isArray(spec.events) ? spec.events.filter((item) => typeof item === "string") : [];
  const steps = Array.isArray(spec.steps) ? spec.steps.flatMap(stepFrom) : [];
  return {
    kind: spec.kind as ExploreSpec["kind"],
    measure: spec.measure as ExploreSpec["measure"],
    events,
    lastDays: typeof spec.lastDays === "number" ? spec.lastDays : null,
    breakdown: BREAKDOWNS.has(spec.breakdown as ExploreSpec["breakdown"]) ? (spec.breakdown as ExploreSpec["breakdown"]) : "product",
    steps,
    withinDays: typeof spec.withinDays === "number" ? spec.withinDays : null,
    segment: spec.segment == null ? null : filterFrom(spec.segment),
  };
}

function segmentsFrom(value: unknown): SavedSegment[] | null {
  if (!Array.isArray(value)) return null;
  const segments: SavedSegment[] = [];
  for (const item of value) {
    const row = recordOf(item);
    if (!row || typeof row.id !== "string" || typeof row.name !== "string") continue;
    segments.push({
      id: row.id,
      name: row.name,
      description: typeof row.description === "string" ? row.description : "",
      filter: filterFrom(row.filter),
    });
  }
  return segments;
}

function metricsFrom(value: unknown): SavedMetric[] | null {
  if (!Array.isArray(value)) return null;
  const metrics: SavedMetric[] = [];
  for (const item of value) {
    const row = recordOf(item);
    if (!row || typeof row.id !== "string" || typeof row.name !== "string") continue;
    if (!MEASURES.has(row.measure as ExploreSpec["measure"]) || !CHART_KINDS.has(row.kind as ExploreSpec["kind"])) continue;
    const events = Array.isArray(row.events) ? row.events.filter((event) => typeof event === "string") : [];
    metrics.push({
      id: row.id,
      name: row.name,
      description: typeof row.description === "string" ? row.description : "",
      measure: row.measure as ExploreSpec["measure"],
      events,
      segmentId: textOrNull(row.segmentId),
      filter: row.filter == null ? null : filterFrom(row.filter),
      kind: row.kind as ExploreSpec["kind"],
    });
  }
  return metrics;
}

function dashboardsFrom(value: unknown): SavedDashboard[] | null {
  if (!Array.isArray(value)) return null;
  const dashboards: SavedDashboard[] = [];
  for (const item of value) {
    const row = recordOf(item);
    if (!row || typeof row.id !== "string" || typeof row.name !== "string" || !Array.isArray(row.cards)) continue;
    const cards = row.cards.flatMap((card) => {
      const entry = recordOf(card);
      const spec = entry ? specFrom(entry.spec) : null;
      if (!entry || typeof entry.id !== "string" || typeof entry.title !== "string" || !spec) return [];
      return [{ id: entry.id, title: entry.title, spec }];
    });
    dashboards.push({
      id: row.id,
      name: row.name,
      shareToken: textOrNull(row.shareToken),
      cards,
    });
  }
  return dashboards;
}

export function readAnalyticsSync(): Pick<AnalyticsLibraryState, "segments" | "metrics" | "dashboards" | "activeDashboardId"> {
  const { segments, metrics, dashboards, activeDashboardId } = useAnalyticsLibrary.getState();
  return { segments, metrics, dashboards, activeDashboardId };
}

export function replaceAnalytics(data: unknown): void {
  const record = recordOf(data);
  if (!record) return;
  const segments = segmentsFrom(record.segments);
  const metrics = metricsFrom(record.metrics);
  const dashboards = dashboardsFrom(record.dashboards);
  if (!segments || !metrics || !dashboards) return;
  const active = record.activeDashboardId;
  useAnalyticsLibrary.setState({
    segments,
    metrics,
    dashboards,
    activeDashboardId: typeof active === "string" || active === null ? active : null,
  });
}

export function resetAnalytics(): void {
  useAnalyticsLibrary.setState({ segments: [], metrics: [], dashboards: [], activeDashboardId: null });
}

export function analyticsIsEmpty(data: { segments: unknown[]; metrics: unknown[]; dashboards: unknown[] }): boolean {
  return data.segments.length === 0 && data.metrics.length === 0 && data.dashboards.length === 0;
}

function materialize(board: ShareBoard, token: string): SavedDashboard {
  return {
    id: nid("board"),
    name: board.name,
    shareToken: token,
    cards: board.cards.map((card) => ({ id: nid("card"), title: card.title, spec: card.spec })),
  };
}
