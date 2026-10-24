"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CellOutput, CellType, NotebookCell } from "@/lib/analytics/query-engine";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Loader2,
  Play,
  Trash2,
} from "lucide-react";
import { useState } from "react";

function renderMarkdown(source: string): string {
  const escaped = source
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped
    .replace(/^### (.+)$/gm, '<h3 class="text-sm font-semibold mt-3 mb-1">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-sm font-semibold mt-3 mb-1">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-base font-semibold mt-2 mb-1">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, '<code class="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">$1</code>')
    .replace(/\n\n/g, "</p><p class=\"text-xs text-muted-foreground leading-relaxed mb-2\">")
    .replace(/\n/g, "<br/>");
}

function CellOutputView({ output }: { output: CellOutput }) {
  if (output.kind === "error") {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive font-mono whitespace-pre-wrap">
        {output.message}
      </div>
    );
  }

  if (output.kind === "text") {
    return (
      <pre className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs font-mono whitespace-pre-wrap text-foreground">
        {output.text}
        {output.durationMs != null && (
          <span className="block mt-2 text-[10px] text-muted-foreground font-sans">
            {output.durationMs}ms
          </span>
        )}
      </pre>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="border border-border rounded-lg overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              {output.columns.map((col) => (
                <th key={col} className="text-left font-medium px-3 py-2 font-mono">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {output.rows.map((row, i) => (
              <tr key={i} className="border-b border-border hover:bg-muted/30">
                {output.columns.map((col) => (
                  <td key={col} className="px-3 py-2 font-mono">
                    {row[col] === null ? (
                      <span className="text-muted-foreground italic">null</span>
                    ) : (
                      String(row[col])
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-muted-foreground">
        {output.rowCount} rows · {output.durationMs}ms
      </p>
    </div>
  );
}

const TYPE_LABEL: Record<CellType, string> = {
  markdown: "Markdown",
  sql: "SQL",
  python: "Python",
};

interface NotebookCellProps {
  cell: NotebookCell;
  index: number;
  total: number;
  active: boolean;
  running: boolean;
  loadingPython?: boolean;
  onFocus: () => void;
  onChange: (source: string) => void;
  onRun: () => void;
  onDelete: () => void;
  onMove: (direction: "up" | "down") => void;
}

export function NotebookCellView({
  cell,
  index,
  total,
  active,
  running,
  loadingPython,
  onFocus,
  onChange,
  onRun,
  onDelete,
  onMove,
}: NotebookCellProps) {
  const [preview, setPreview] = useState(cell.type === "markdown");

  return (
    <div
      className={cn(
        "rounded-lg border bg-card transition-colors",
        active ? "border-foreground/40 shadow-sm" : "border-border"
      )}
      onClick={onFocus}
    >
      <div className="flex items-center gap-2 border-b border-border px-3 py-1.5 bg-muted/20">
        <span className="text-[10px] text-muted-foreground font-mono w-6">
          [{index + 1}]
        </span>
        <Badge variant="outline" className="text-[10px]">
          {TYPE_LABEL[cell.type]}
        </Badge>
        {cell.type === "markdown" && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-6 px-1.5 text-[10px]"
            onClick={(e) => {
              e.stopPropagation();
              setPreview((p) => !p);
            }}
          >
            {preview ? (
              <>
                <ChevronDown className="h-3 w-3 mr-0.5" />
                Edit
              </>
            ) : (
              <>
                <ChevronRight className="h-3 w-3 mr-0.5" />
                Preview
              </>
            )}
          </Button>
        )}
        <div className="ml-auto flex items-center gap-0.5">
          {(cell.type === "sql" || cell.type === "python") && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[10px]"
              disabled={running || !cell.source.trim()}
              onClick={(e) => {
                e.stopPropagation();
                onRun();
              }}
            >
              {running || loadingPython ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Play className="h-3 w-3 mr-1" />
              )}
              {loadingPython ? "Loading Python…" : "Run"}
            </Button>
          )}
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            disabled={index === 0}
            onClick={(e) => {
              e.stopPropagation();
              onMove("up");
            }}
          >
            <ArrowUp className="h-3 w-3" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            disabled={index >= total - 1}
            onClick={(e) => {
              e.stopPropagation();
              onMove("down");
            }}
          >
            <ArrowDown className="h-3 w-3" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-6 w-6 text-muted-foreground hover:text-destructive"
            disabled={total <= 1}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <div className="p-3 space-y-3">
        {cell.type === "markdown" && preview ? (
          <div
            className="prose-sm min-h-[48px]"
            dangerouslySetInnerHTML={{
              __html: `<p class="text-xs text-muted-foreground leading-relaxed mb-2">${renderMarkdown(cell.source)}</p>`,
            }}
          />
        ) : (
          <div
            className={cn(
              "rounded-md border border-border p-3 font-mono text-xs",
              cell.type === "markdown"
                ? "bg-background text-foreground"
                : "bg-[#1e1e1e] text-[#d4d4d4]"
            )}
          >
            <textarea
              value={cell.source}
              onChange={(e) => onChange(e.target.value)}
              onFocus={onFocus}
              className="w-full bg-transparent outline-none resize-none min-h-[88px] leading-relaxed"
              spellCheck={cell.type === "markdown"}
              placeholder={
                cell.type === "sql"
                  ? "-- Write SQL…"
                  : cell.type === "python"
                    ? "# Python — `df` is the last SQL result"
                    : "Write markdown…"
              }
            />
          </div>
        )}

        {cell.output && <CellOutputView output={cell.output} />}
      </div>
    </div>
  );
}
