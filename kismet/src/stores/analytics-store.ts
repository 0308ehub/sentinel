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

function materialize(board: ShareBoard, token: string): SavedDashboard {
  return {
    id: nid("board"),
    name: board.name,
    shareToken: token,
    cards: board.cards.map((card) => ({ id: nid("card"), title: card.title, spec: card.spec })),
  };
}
