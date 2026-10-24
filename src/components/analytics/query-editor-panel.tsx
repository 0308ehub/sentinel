"use client";

import { useMemo, useState } from "react";
import { useQueryEditorStore } from "@/stores/query-editor-store";
import {
  generateQueryFromPrompt,
  type CellType,
  type QueryResultRow,
} from "@/lib/analytics/query-engine";
import { runPythonCell } from "@/lib/analytics/pyodide-runtime";
import { NotebookCellView } from "@/components/analytics/notebook-cell";
import { SaveQueryDialog } from "@/components/analytics/save-query-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Play,
  Save,
  Sparkles,
  Plus,
  X,
  Loader2,
  CheckCircle2,
  FileText,
  Database,
  Code2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { nodes } from "@/lib/data/seed";

const FEATURE_OPTIONS = nodes
  .filter((n) => n.type === "FEATURE")
  .map((n) => ({ id: n.id, title: n.title }));

export function QueryEditorPanel() {
  const {
    tabs,
    activeTabId,
    savedNotebooks,
    activeCellId,
    lastRunSuccessful,
    createTab,
    closeTab,
    setActiveTab,
    setActiveCell,
    updateCellSource,
    setCellOutput,
    addCell,
    removeCell,
    moveCell,
    setLinkedNode,
    openSavedNotebook,
    saveNotebook,
    setLastRunSuccessful,
  } = useQueryEditorStore();

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];

  const [aiPrompt, setAiPrompt] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [runningCellId, setRunningCellId] = useState<string | null>(null);
  const [loadingPython, setLoadingPython] = useState(false);
  const [runningAll, setRunningAll] = useState(false);

  const lastSqlRows = useMemo((): QueryResultRow[] | null => {
    if (!activeTab) return null;
    for (let i = activeTab.cells.length - 1; i >= 0; i--) {
      const cell = activeTab.cells[i];
      if (cell.type === "sql" && cell.output?.kind === "table") {
        return cell.output.rows;
      }
    }
    return null;
  }, [activeTab]);

  const runSqlCell = async (cellId: string, source: string) => {
    setRunningCellId(cellId);
    const started = Date.now();
    try {
      const res = await fetch("/api/databricks/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statement: source }),
      });
      const body = (await res.json()) as {
        columns?: string[];
        rows?: QueryResultRow[];
        rowCount?: number;
        durationMs?: number;
        hint?: string;
        error?: string;
      };
      if (!res.ok) {
        setCellOutput(activeTab.id, cellId, {
          kind: "error",
          message: body.hint ?? body.error ?? "The query failed.",
        });
        setLastRunSuccessful(false);
        return [];
      }
      setCellOutput(activeTab.id, cellId, {
        kind: "table",
        columns: body.columns ?? [],
        rows: body.rows ?? [],
        rowCount: body.rowCount ?? 0,
        durationMs: body.durationMs ?? Date.now() - started,
      });
      setLastRunSuccessful(true);
      return body.rows ?? [];
    } catch {
      setCellOutput(activeTab.id, cellId, {
        kind: "error",
        message: "Could not reach Databricks.",
      });
      setLastRunSuccessful(false);
      return [];
    } finally {
      setRunningCellId(null);
    }
  };

  const runPython = async (cellId: string, source: string, rows: QueryResultRow[] | null) => {
    setRunningCellId(cellId);
    setLoadingPython(true);
    const output = await runPythonCell(source, rows);
    setLoadingPython(false);
    setCellOutput(activeTab.id, cellId, output);
    setLastRunSuccessful(output.kind !== "error");
    setRunningCellId(null);
  };

  const runCell = async (cellId: string) => {
    if (!activeTab) return;
    const cell = activeTab.cells.find((c) => c.id === cellId);
    if (!cell || !cell.source.trim()) return;

    if (cell.type === "sql") {
      await runSqlCell(cellId, cell.source);
    } else if (cell.type === "python") {
      await runPython(cellId, cell.source, lastSqlRows);
    }
  };

  const runAll = async () => {
    if (!activeTab) return;
    setRunningAll(true);
    let rows: QueryResultRow[] | null = null;
    for (const cell of activeTab.cells) {
      if (!cell.source.trim()) continue;
      if (cell.type === "sql") {
        rows = await runSqlCell(cell.id, cell.source);
      } else if (cell.type === "python") {
        await runPython(cell.id, cell.source, rows);
      }
    }
    setRunningAll(false);
  };

  const askAI = async () => {
    if (!aiPrompt.trim() || !activeTab) return;
    setAiGenerating(true);
    setAiExplanation(null);
    await new Promise((r) => setTimeout(r, 700 + Math.random() * 500));
    const generated = generateQueryFromPrompt(aiPrompt);

    const active = activeTab.cells.find((c) => c.id === activeCellId);
    if (active?.type === "sql") {
      updateCellSource(activeTab.id, active.id, generated.sql);
    } else {
      const existingSql = activeTab.cells.find((c) => c.type === "sql");
      if (existingSql) {
        updateCellSource(activeTab.id, existingSql.id, generated.sql);
        setActiveCell(existingSql.id);
      } else {
        addCell(activeTab.id, "sql");
        // Source applied on next tick via fresh cell default — replace after add
        const state = useQueryEditorStore.getState();
        const tab = state.tabs.find((t) => t.id === activeTab.id);
        const newest = tab?.cells[tab.cells.length - 1];
        if (newest?.type === "sql") {
          updateCellSource(activeTab.id, newest.id, generated.sql);
        }
      }
    }

    if (activeTab.savedNotebookId) {
      saveNotebook(activeTab.id, activeTab.name);
    } else {
      saveNotebook(activeTab.id, generated.name || activeTab.name);
    }
    setAiExplanation(generated.explanation);
    setAiPrompt("");
    setAiGenerating(false);
  };

  const handleSave = (name: string) => {
    if (!activeTab) return;
    saveNotebook(activeTab.id, name);
  };

  const addCellOfType = (type: CellType) => {
    if (!activeTab) return;
    addCell(activeTab.id, type, activeCellId ?? undefined);
  };

  if (!activeTab) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        No notebook open
      </div>
    );
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="w-56 border-r border-border flex flex-col bg-muted/20 shrink-0">
        <div className="p-3 border-b border-border flex items-center justify-between">
          <span className="text-xs font-medium">Saved notebooks</span>
          <Badge variant="secondary" className="text-[10px]">
            {savedNotebooks.length}
          </Badge>
        </div>
        <ScrollArea className="flex-1 p-2">
          <div className="space-y-1">
            {savedNotebooks.map((nb) => {
              const openTab = tabs.find((t) => t.savedNotebookId === nb.id);
              const preview =
                nb.cells.find((c) => c.type === "markdown")?.source ??
                nb.cells.find((c) => c.type === "sql")?.source ??
                "";
              return (
                <button
                  key={nb.id}
                  onClick={() => openSavedNotebook(nb.id)}
                  className={cn(
                    "w-full text-left rounded-md px-2.5 py-2 text-xs hover:bg-muted transition-colors",
                    openTab?.id === activeTabId && "bg-accent text-accent-foreground"
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    {nb.source === "ai" && (
                      <Sparkles className="h-3 w-3 text-foreground shrink-0" />
                    )}
                    <span className="font-medium truncate">{nb.name}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">
                    {preview.replace(/^#+\s*/gm, "").slice(0, 80)}
                  </span>
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    {(["markdown", "sql", "python"] as CellType[]).map((t) => {
                      const count = nb.cells.filter((c) => c.type === t).length;
                      if (!count) return null;
                      return (
                        <Badge key={t} variant="outline" className="text-[9px] px-1 py-0">
                          {count} {t === "markdown" ? "md" : t}
                        </Badge>
                      );
                    })}
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <div className="flex items-center border-b border-border bg-muted/20 shrink-0 overflow-x-auto">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-xs border-r border-border cursor-pointer shrink-0 group",
                tab.id === activeTabId
                  ? "bg-background text-foreground"
                  : "text-muted-foreground hover:bg-muted/50"
              )}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.isDirty && (
                <span
                  className="h-1.5 w-1.5 rounded-full bg-foreground shrink-0"
                  title="Unsaved changes"
                />
              )}
              {tab.aiGenerated && !tab.isDirty && (
                <Sparkles className="h-3 w-3 text-foreground shrink-0" />
              )}
              <span className="max-w-[140px] truncate">{tab.name}</span>
              {tabs.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 hover:bg-muted rounded p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
          <button
            onClick={() => createTab()}
            className="px-2.5 py-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 shrink-0"
            title="New notebook"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="border-b border-border px-4 py-2.5 bg-muted/10 shrink-0 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 mr-2">
            <span className="text-[10px] text-muted-foreground">Linked feature</span>
            <select
              className="h-7 rounded-md border border-border bg-background px-2 text-xs max-w-[200px]"
              value={activeTab.linkedNodeId ?? ""}
              onChange={(e) =>
                setLinkedNode(activeTab.id, e.target.value || undefined)
              }
            >
              <option value="">None</option>
              {FEATURE_OPTIONS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.title}
                </option>
              ))}
            </select>
          </div>
          <Button size="sm" variant="outline" onClick={runAll} disabled={runningAll}>
            {runningAll ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <Play className="h-3 w-3 mr-1" />
            )}
            Run all
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSaveDialogOpen(true)}
          >
            <Save className="h-3 w-3 mr-1" />
            {activeTab.savedNotebookId && !activeTab.isDirty ? "Saved" : "Save"}
          </Button>
          {activeTab.isDirty && (
            <span className="text-[10px] text-muted-foreground">Unsaved changes</span>
          )}
          {lastRunSuccessful && (
            <span className="text-[10px] text-muted-foreground ml-auto flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-success" />
              Last run ok
            </span>
          )}
        </div>

        <div className="border-b border-border px-4 py-3 bg-accent/20 shrink-0 space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-foreground shrink-0" />
            <span className="text-xs font-medium">Ask AI to write a SQL cell</span>
            <Badge variant="outline" className="text-[10px] ml-auto font-normal">
              Inserts / updates SQL in this notebook
            </Badge>
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              askAI();
            }}
          >
            <Input
              placeholder='e.g. "Which enterprise workspaces churned in the last 90 days?"'
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              className="h-8 text-xs flex-1 bg-background"
              disabled={aiGenerating}
            />
            <Button type="submit" size="sm" disabled={aiGenerating || !aiPrompt.trim()}>
              {aiGenerating ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Writing…
                </>
              ) : (
                "Generate"
              )}
            </Button>
          </form>
          {aiExplanation && (
            <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0 mt-0.5" />
              {aiExplanation} — SQL cell updated and notebook saved.
            </p>
          )}
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-3 max-w-4xl mx-auto w-full">
            {activeTab.cells.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <FileText className="h-8 w-8 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">Empty notebook</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Add a markdown, SQL, or Python cell to start building evidence.
                </p>
              </div>
            ) : (
              activeTab.cells.map((cell, index) => (
                <NotebookCellView
                  key={cell.id}
                  cell={cell}
                  index={index}
                  total={activeTab.cells.length}
                  active={activeCellId === cell.id}
                  running={runningCellId === cell.id || runningAll}
                  loadingPython={
                    loadingPython &&
                    runningCellId === cell.id &&
                    cell.type === "python"
                  }
                  onFocus={() => setActiveCell(cell.id)}
                  onChange={(source) =>
                    updateCellSource(activeTab.id, cell.id, source)
                  }
                  onRun={() => runCell(cell.id)}
                  onDelete={() => removeCell(activeTab.id, cell.id)}
                  onMove={(dir) => moveCell(activeTab.id, cell.id, dir)}
                />
              ))
            )}

            <div className="flex flex-wrap gap-2 pt-1 pb-8">
              <Button
                size="sm"
                variant="outline"
                onClick={() => addCellOfType("markdown")}
              >
                <FileText className="h-3 w-3 mr-1" />
                Markdown
              </Button>
              <Button size="sm" variant="outline" onClick={() => addCellOfType("sql")}>
                <Database className="h-3 w-3 mr-1" />
                SQL
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => addCellOfType("python")}
              >
                <Code2 className="h-3 w-3 mr-1" />
                Python
              </Button>
            </div>
          </div>
        </ScrollArea>
      </div>

      <SaveQueryDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        defaultName={activeTab.name}
        isUpdate={!!activeTab.savedNotebookId}
        onSave={handleSave}
      />
    </div>
  );
}
