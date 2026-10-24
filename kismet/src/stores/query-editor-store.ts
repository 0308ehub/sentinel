"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  cellsFingerprint,
  createCell,
  createEmptyNotebook,
  INITIAL_SAVED_NOTEBOOKS,
  isLegacySavedQuery,
  migrateSavedQueryToNotebook,
  notebookFromSaved,
  type CellOutput,
  type CellType,
  type NotebookCell,
  type NotebookDoc,
  type SavedNotebook,
} from "@/lib/analytics/query-engine";

interface NotebookEditorState {
  tabs: NotebookDoc[];
  activeTabId: string;
  savedNotebooks: SavedNotebook[];
  activeCellId: string | null;
  lastRunSuccessful: boolean;

  createTab: (sql?: string, name?: string) => string;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  setActiveCell: (cellId: string | null) => void;
  updateCellSource: (tabId: string, cellId: string, source: string) => void;
  setCellOutput: (tabId: string, cellId: string, output: CellOutput | undefined) => void;
  addCell: (tabId: string, type: CellType, afterCellId?: string) => string;
  removeCell: (tabId: string, cellId: string) => void;
  moveCell: (tabId: string, cellId: string, direction: "up" | "down") => void;
  setLinkedNode: (tabId: string, linkedNodeId: string | undefined) => void;
  openSavedNotebook: (savedId: string) => void;
  saveNotebook: (tabId: string, name: string) => SavedNotebook;
  saveQueryFromAI: (tabId: string, name: string, sql: string) => SavedNotebook;
  deleteSavedNotebook: (savedId: string) => void;
  setLastRunSuccessful: (success: boolean) => void;
}

function markDirty(tab: NotebookDoc, savedNotebooks: SavedNotebook[]): boolean {
  if (!tab.savedNotebookId) {
    return tab.cells.some((c) => c.source.trim().length > 0);
  }
  const saved = savedNotebooks.find((n) => n.id === tab.savedNotebookId);
  if (!saved) return true;
  return (
    cellsFingerprint(tab.cells) !== cellsFingerprint(saved.cells) ||
    tab.linkedNodeId !== saved.linkedNodeId ||
    tab.name !== saved.name
  );
}

function withDirty(tab: NotebookDoc, savedNotebooks: SavedNotebook[]): NotebookDoc {
  return { ...tab, isDirty: markDirty(tab, savedNotebooks) };
}

function initialTabs(): NotebookDoc[] {
  const first = INITIAL_SAVED_NOTEBOOKS[0];
  return [first ? notebookFromSaved(first) : createEmptyNotebook()];
}

function normalizePersistedNotebooks(raw: unknown): SavedNotebook[] {
  if (!Array.isArray(raw) || raw.length === 0) return INITIAL_SAVED_NOTEBOOKS;
  return raw.map((item) => {
    if (isLegacySavedQuery(item)) return migrateSavedQueryToNotebook(item);
    const nb = item as SavedNotebook;
    return {
      ...nb,
      cells: (nb.cells ?? []).map((c) => ({
        ...c,
        id: c.id || `cell-${Math.random().toString(36).slice(2)}`,
      })),
    };
  });
}

function buildInitialState() {
  const tabs = initialTabs();
  return {
    tabs,
    activeTabId: tabs[0].id,
    savedNotebooks: INITIAL_SAVED_NOTEBOOKS,
    activeCellId: tabs[0].cells[0]?.id ?? null,
    lastRunSuccessful: false,
  };
}

export const useQueryEditorStore = create<NotebookEditorState>()(
  persist(
    (set, get) => ({
      ...buildInitialState(),

      createTab: (sql = "", name) => {
        const tab = createEmptyNotebook(name);
        if (sql) {
          tab.cells = [createCell("sql", sql)];
          tab.isDirty = true;
        }
        set((s) => ({
          tabs: [...s.tabs, tab],
          activeTabId: tab.id,
          activeCellId: tab.cells[0]?.id ?? null,
        }));
        return tab.id;
      },

      closeTab: (tabId) => {
        const { tabs, activeTabId } = get();
        if (tabs.length <= 1) return;
        const idx = tabs.findIndex((t) => t.id === tabId);
        const next = tabs.filter((t) => t.id !== tabId);
        const newActive =
          activeTabId === tabId ? next[Math.max(0, idx - 1)].id : activeTabId;
        set({
          tabs: next,
          activeTabId: newActive,
          activeCellId: next.find((t) => t.id === newActive)?.cells[0]?.id ?? null,
        });
      },

      setActiveTab: (tabId) => {
        const tab = get().tabs.find((t) => t.id === tabId);
        set({
          activeTabId: tabId,
          activeCellId: tab?.cells[0]?.id ?? null,
        });
      },

      setActiveCell: (cellId) => set({ activeCellId: cellId }),

      updateCellSource: (tabId, cellId, source) =>
        set((s) => ({
          tabs: s.tabs.map((t) => {
            if (t.id !== tabId) return t;
            const cells = t.cells.map((c) =>
              c.id === cellId ? { ...c, source, output: undefined } : c
            );
            return withDirty({ ...t, cells }, s.savedNotebooks);
          }),
        })),

      setCellOutput: (tabId, cellId, output) =>
        set((s) => ({
          tabs: s.tabs.map((t) => {
            if (t.id !== tabId) return t;
            return {
              ...t,
              cells: t.cells.map((c) => (c.id === cellId ? { ...c, output } : c)),
            };
          }),
        })),

      addCell: (tabId, type, afterCellId) => {
        const cell = createCell(type);
        set((s) => ({
          tabs: s.tabs.map((t) => {
            if (t.id !== tabId) return t;
            const cells = [...t.cells];
            const idx = afterCellId
              ? cells.findIndex((c) => c.id === afterCellId)
              : cells.length - 1;
            cells.splice(idx + 1, 0, cell);
            return withDirty({ ...t, cells }, s.savedNotebooks);
          }),
          activeCellId: cell.id,
        }));
        return cell.id;
      },

      removeCell: (tabId, cellId) =>
        set((s) => {
          const tabs = s.tabs.map((t) => {
            if (t.id !== tabId) return t;
            if (t.cells.length <= 1) return t;
            const cells = t.cells.filter((c) => c.id !== cellId);
            return withDirty({ ...t, cells }, s.savedNotebooks);
          });
          const active = tabs.find((t) => t.id === tabId);
          return {
            tabs,
            activeCellId:
              s.activeCellId === cellId
                ? active?.cells[0]?.id ?? null
                : s.activeCellId,
          };
        }),

      moveCell: (tabId, cellId, direction) =>
        set((s) => ({
          tabs: s.tabs.map((t) => {
            if (t.id !== tabId) return t;
            const idx = t.cells.findIndex((c) => c.id === cellId);
            if (idx < 0) return t;
            const swapWith = direction === "up" ? idx - 1 : idx + 1;
            if (swapWith < 0 || swapWith >= t.cells.length) return t;
            const cells = [...t.cells];
            [cells[idx], cells[swapWith]] = [cells[swapWith], cells[idx]];
            return withDirty({ ...t, cells }, s.savedNotebooks);
          }),
        })),

      setLinkedNode: (tabId, linkedNodeId) =>
        set((s) => ({
          tabs: s.tabs.map((t) => {
            if (t.id !== tabId) return t;
            return withDirty({ ...t, linkedNodeId }, s.savedNotebooks);
          }),
        })),

      openSavedNotebook: (savedId) => {
        const { tabs, savedNotebooks } = get();
        const existing = tabs.find((t) => t.savedNotebookId === savedId);
        if (existing) {
          set({
            activeTabId: existing.id,
            activeCellId: existing.cells[0]?.id ?? null,
          });
          return;
        }
        const saved = savedNotebooks.find((n) => n.id === savedId);
        if (!saved) return;
        const tab = notebookFromSaved(saved);
        set((s) => ({
          tabs: [...s.tabs, tab],
          activeTabId: tab.id,
          activeCellId: tab.cells[0]?.id ?? null,
        }));
      },

      saveNotebook: (tabId, name) => {
        const { tabs, savedNotebooks } = get();
        const tab = tabs.find((t) => t.id === tabId);
        if (!tab) throw new Error("Notebook not found");

        const now = new Date().toISOString();
        const cellsForSave: NotebookCell[] = tab.cells.map(({ id, type, source }) => ({
          id,
          type,
          source,
        }));

        let saved: SavedNotebook;

        if (tab.savedNotebookId) {
          const prev = savedNotebooks.find((n) => n.id === tab.savedNotebookId)!;
          saved = {
            ...prev,
            name,
            cells: cellsForSave,
            linkedNodeId: tab.linkedNodeId,
            updatedAt: now,
            source: tab.aiGenerated ? "ai" : "manual",
          };
          set((s) => ({
            savedNotebooks: s.savedNotebooks.map((n) =>
              n.id === saved.id ? saved : n
            ),
            tabs: s.tabs.map((t) =>
              t.id === tabId
                ? {
                    ...t,
                    name,
                    savedNotebookId: saved.id,
                    isDirty: false,
                    aiGenerated: saved.source === "ai",
                  }
                : t
            ),
          }));
        } else {
          saved = {
            id: `nb-${Date.now()}`,
            name,
            cells: cellsForSave,
            linkedNodeId: tab.linkedNodeId,
            createdAt: now,
            updatedAt: now,
            source: tab.aiGenerated ? "ai" : "manual",
          };
          set((s) => ({
            savedNotebooks: [saved, ...s.savedNotebooks],
            tabs: s.tabs.map((t) =>
              t.id === tabId
                ? {
                    ...t,
                    name,
                    savedNotebookId: saved.id,
                    isDirty: false,
                    aiGenerated: saved.source === "ai",
                  }
                : t
            ),
          }));
        }

        return saved;
      },

      saveQueryFromAI: (tabId, name, sql) => {
        const now = new Date().toISOString();
        const mdCell = createCell(
          "markdown",
          `## AI-generated evidence\n\nPrompt turned into SQL for **${name}**.`
        );
        const sqlCell = createCell("sql", sql);
        const cells = [mdCell, sqlCell];
        const saved: SavedNotebook = {
          id: `nb-ai-${Date.now()}`,
          name,
          cells: cells.map(({ id, type, source }) => ({ id, type, source })),
          createdAt: now,
          updatedAt: now,
          source: "ai",
        };
        set((s) => ({
          savedNotebooks: [saved, ...s.savedNotebooks],
          tabs: s.tabs.map((t) =>
            t.id === tabId
              ? {
                  ...t,
                  name,
                  cells: cells.map((c) => ({ ...c })),
                  savedNotebookId: saved.id,
                  isDirty: false,
                  aiGenerated: true,
                }
              : t
          ),
          activeCellId: sqlCell.id,
        }));
        return saved;
      },

      deleteSavedNotebook: (savedId) =>
        set((s) => ({
          savedNotebooks: s.savedNotebooks.filter((n) => n.id !== savedId),
          tabs: s.tabs.map((t) =>
            t.savedNotebookId === savedId
              ? { ...t, savedNotebookId: undefined, isDirty: true }
              : t
          ),
        })),

      setLastRunSuccessful: (success) => set({ lastRunSuccessful: success }),
    }),
    {
      name: "kismet-notebooks-v2",
      partialize: (s) => ({
        savedNotebooks: s.savedNotebooks,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as {
          savedNotebooks?: unknown;
          savedQueries?: unknown;
        };
        const raw = p.savedNotebooks ?? p.savedQueries;
        const savedNotebooks = normalizePersistedNotebooks(raw);
        const tabs = [
          savedNotebooks[0] ? notebookFromSaved(savedNotebooks[0]) : createEmptyNotebook(),
        ];
        return {
          ...current,
          savedNotebooks,
          tabs,
          activeTabId: tabs[0].id,
          activeCellId: tabs[0].cells[0]?.id ?? null,
        };
      },
    }
  )
);
