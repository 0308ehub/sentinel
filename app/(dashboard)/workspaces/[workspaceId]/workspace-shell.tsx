"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { WorkspaceNav } from "@/components/nav/workspace-nav";
import { AgentPanel, AgentPanelToggle } from "./agent-panel";
import { WorkspaceProvider } from "./workspace-context";
import { WorkspaceJobsProvider } from "./workspace-jobs-context";

const MIN_WIDTH = 240;
const MAX_WIDTH = 640;
const DEFAULT_WIDTH = 380;

export function WorkspaceShell({
  workspaceId,
  children,
}: {
  workspaceId: string;
  children: React.ReactNode;
}) {
  const [panelOpen, setPanelOpen] = useState(true);
  const [panelWidth, setPanelWidth] = useState(DEFAULT_WIDTH);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(DEFAULT_WIDTH);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = true;
      startX.current = e.clientX;
      startWidth.current = panelWidth;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [panelWidth]
  );

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = startX.current - e.clientX;
      const next = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidth.current + delta));
      setPanelWidth(next);
    };
    const onMouseUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  return (
    <WorkspaceJobsProvider>
    <WorkspaceProvider>
      <div className="flex flex-col h-full overflow-hidden bg-background">
        <WorkspaceNav workspaceId={workspaceId} />
        <div className="flex flex-1 overflow-hidden">
          {/* Main canvas */}
          <main className="flex-1 overflow-auto min-w-0">{children}</main>

          {panelOpen ? (
            <>
              {/* Resize handle */}
              <div
                onMouseDown={onMouseDown}
                className="w-1 shrink-0 cursor-col-resize bg-border hover:bg-indigo-400 active:bg-indigo-500 transition-colors"
              />
              {/* Agent panel */}
              <div
                className="shrink-0 flex flex-col overflow-hidden border-l border-border bg-card"
                style={{ width: panelWidth }}
              >
                <AgentPanel workspaceId={workspaceId} onClose={() => setPanelOpen(false)} />
              </div>
            </>
          ) : (
            /* Collapsed toggle strip */
            <AgentPanelToggle onClick={() => setPanelOpen(true)} />
          )}
        </div>
      </div>
    </WorkspaceProvider>
    </WorkspaceJobsProvider>
  );
}
