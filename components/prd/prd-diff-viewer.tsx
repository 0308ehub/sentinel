"use client";

import { cn } from "@/lib/utils";
import type { DiffHunk, DiffState } from "@/lib/diff/prd-diff";
import { Button } from "@/components/ui/button";
import { Check, X, Zap, Save } from "lucide-react";

interface PRDDiffViewerProps {
  originalContent: string;
  diffState: DiffState;
  onAcceptHunk: (id: string) => void;
  onRejectHunk: (id: string) => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onSave: () => void;
  isSaving: boolean;
}

type ViewItem =
  | { kind: "context"; line: string; lineIndex: number }
  | { kind: "hunk"; hunk: DiffHunk; hunkNumber: number };

function buildViewItems(originalContent: string, hunks: DiffHunk[]): ViewItem[] {
  const originalLines = originalContent.split("\n");
  const sortedHunks = [...hunks].sort((a, b) => a.oldStart - b.oldStart);
  const items: ViewItem[] = [];
  let lineIndex = 0;
  let hunkCursor = 0;

  while (lineIndex < originalLines.length) {
    const nextHunk = sortedHunks[hunkCursor];
    if (nextHunk && lineIndex === nextHunk.oldStart) {
      items.push({ kind: "hunk", hunk: nextHunk, hunkNumber: hunkCursor + 1 });
      lineIndex += nextHunk.oldLines.length;
      hunkCursor++;
    } else {
      items.push({ kind: "context", line: originalLines[lineIndex], lineIndex });
      lineIndex++;
    }
  }

  // Pure-addition hunks that come after all original lines
  while (hunkCursor < sortedHunks.length) {
    items.push({
      kind: "hunk",
      hunk: sortedHunks[hunkCursor],
      hunkNumber: hunkCursor + 1,
    });
    hunkCursor++;
  }

  return items;
}

export function PRDDiffViewer({
  originalContent,
  diffState,
  onAcceptHunk,
  onRejectHunk,
  onAcceptAll,
  onRejectAll,
  onSave,
  isSaving,
}: PRDDiffViewerProps) {
  const pendingCount = diffState.hunks.filter((h) => h.status === "pending").length;
  const allResolved = diffState.hunks.every((h) => h.status !== "pending");
  const viewItems = buildViewItems(originalContent, diffState.hunks);

  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      {/* Floating bar */}
      <div
        className={cn(
          "border-b px-4 py-2.5 flex items-center justify-between",
          allResolved
            ? "bg-green-50 border-green-200"
            : "bg-indigo-50 border-indigo-200"
        )}
      >
        <div className="flex items-center gap-2">
          {allResolved ? (
            <Save className="h-3.5 w-3.5 text-green-600" />
          ) : (
            <Zap className="h-3.5 w-3.5 text-indigo-500" />
          )}
          <span
            className={cn(
              "text-xs font-medium",
              allResolved ? "text-green-700" : "text-indigo-700"
            )}
          >
            {allResolved
              ? "All changes resolved — save to apply"
              : `${pendingCount} change${pendingCount !== 1 ? "s" : ""} pending`}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {allResolved ? (
            <Button
              size="sm"
              onClick={onSave}
              disabled={isSaving}
              className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white"
            >
              {isSaving ? "Saving…" : "Save changes"}
            </Button>
          ) : (
            <>
              <button
                onClick={onAcceptAll}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
              >
                Accept all
              </button>
              <button
                onClick={onRejectAll}
                className="text-xs text-gray-500 hover:text-gray-700 font-medium transition-colors"
              >
                Reject all
              </button>
            </>
          )}
        </div>
      </div>

      {/* Line-by-line diff content */}
      <div className="px-6 py-4 text-sm font-mono leading-relaxed overflow-auto max-h-[calc(100vh-280px)]">
        {viewItems.map((item) => {
          if (item.kind === "context") {
            return (
              <div
                key={`ctx-${item.lineIndex}`}
                className="text-gray-800 whitespace-pre-wrap min-h-[1.5em]"
              >
                {item.line || " "}
              </div>
            );
          }

          const { hunk, hunkNumber } = item;

          if (hunk.status === "rejected") {
            // Rejected: the change is discarded, show nothing
            return null;
          }

          if (hunk.status === "accepted") {
            // Accepted: show new lines as normal content
            return (
              <div key={hunk.id}>
                {hunk.newLines.map((line, j) => (
                  <div
                    key={`${hunk.id}-new-${j}`}
                    className="text-gray-800 whitespace-pre-wrap min-h-[1.5em]"
                  >
                    {line || " "}
                  </div>
                ))}
              </div>
            );
          }

          // Pending: show full diff block with Accept/Reject
          return (
            <div key={hunk.id} className="my-2">
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="px-3 py-1 bg-gray-50 border-b border-gray-200">
                  <span className="text-[10px] text-gray-400 font-sans">
                    Hunk {hunkNumber} of {diffState.hunks.length}
                  </span>
                </div>

                {hunk.oldLines.map((line, j) => (
                  <div key={`${hunk.id}-old-${j}`} className="flex items-start bg-red-50">
                    <span className="w-5 shrink-0 text-center text-red-400 text-xs select-none py-0.5">
                      −
                    </span>
                    <span className="text-red-700 whitespace-pre-wrap flex-1 min-h-[1.5em] py-0.5 pr-2">
                      {line || " "}
                    </span>
                  </div>
                ))}

                {hunk.newLines.map((line, j) => (
                  <div key={`${hunk.id}-new-${j}`} className="flex items-start bg-green-50">
                    <span className="w-5 shrink-0 text-center text-green-400 text-xs select-none py-0.5">
                      +
                    </span>
                    <span className="text-green-700 whitespace-pre-wrap flex-1 min-h-[1.5em] py-0.5 pr-2">
                      {line || " "}
                    </span>
                  </div>
                ))}

                <div className="px-3 py-1.5 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-3">
                  <button
                    onClick={() => onAcceptHunk(hunk.id)}
                    className="flex items-center gap-1 text-xs text-green-700 hover:text-green-900 font-medium transition-colors"
                  >
                    <Check className="h-3 w-3" />
                    Accept
                  </button>
                  <button
                    onClick={() => onRejectHunk(hunk.id)}
                    className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800 font-medium transition-colors"
                  >
                    <X className="h-3 w-3" />
                    Reject
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
