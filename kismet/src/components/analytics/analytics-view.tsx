"use client";

import { useEffect, useState } from "react";
import { DataSourcesPanel } from "@/components/analytics/data-sources-panel";
import { QueryEditorPanel } from "@/components/analytics/query-editor-panel";
import { useQueryEditorStore } from "@/stores/query-editor-store";
import { ChartsView } from "@/components/analytics/charts-view";
import { DashboardsView } from "@/components/analytics/dashboards-view";
import { DefinitionsView } from "@/components/analytics/definitions-view";
import { ExploreView } from "@/components/analytics/explore-view";
import type { ExploreSpec } from "@/lib/analytics/explore-types";
import { useAnalyticsLibrary } from "@/stores/analytics-store";
import { FunnelsView } from "@/components/analytics/funnels-view";
import { ChartSpline, Database, Filter, LayoutDashboard, LineChart, Shapes, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";

type AnalyticsTab = "boards" | "funnels" | "explore" | "definitions" | "charts" | "query" | "sources";

export function AnalyticsView() {
  const [tab, setTab] = useState<AnalyticsTab>("boards");
  const [preset, setPreset] = useState<ExploreSpec | null>(null);
  const importShared = useAnalyticsLibrary((state) => state.importShared);
  const { createTab, saveQueryFromAI } = useQueryEditorStore();

  const openSavedNotebook = useQueryEditorStore((state) => state.openSavedNotebook);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("board");
    if (token && importShared(token)) {
      setTab("boards");
      return;
    }
    const notebook = params.get("notebook");
    if (notebook) {
      openSavedNotebook(notebook);
      setTab("query");
      return;
    }
    const requested = params.get("tab");
    if (
      requested === "boards" ||
      requested === "funnels" ||
      requested === "explore" ||
      requested === "definitions" ||
      requested === "charts" ||
      requested === "query" ||
      requested === "sources"
    ) {
      setTab(requested);
    }
  }, [importShared, openSavedNotebook]);

  const insertQueryFromAI = (sql: string, name?: string) => {
    const tabId = createTab(sql, name ?? "Imported from Data Sources");
    if (name) {
      saveQueryFromAI(tabId, name, sql);
    }
    setTab("query");
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4">
        <div className="flex min-w-0 items-center gap-4">
          <h1 className="py-3 text-sm font-semibold">Analytics</h1>
          <div className="flex gap-1 overflow-x-auto">
            <TabButton active={tab === "boards"} onClick={() => setTab("boards")} icon={LayoutDashboard} label="Boards" />
            <TabButton active={tab === "funnels"} onClick={() => setTab("funnels")} icon={Filter} label="Funnels" />
            <TabButton active={tab === "explore"} onClick={() => setTab("explore")} icon={ChartSpline} label="Explore" />
            <TabButton active={tab === "definitions"} onClick={() => setTab("definitions")} icon={Shapes} label="Definitions" />
            <TabButton
              active={tab === "charts"}
              onClick={() => setTab("charts")}
              icon={LineChart}
              label="Overview"
            />
            <TabButton
              active={tab === "query"}
              onClick={() => setTab("query")}
              icon={Terminal}
              label="Notebooks"
            />
            <TabButton
              active={tab === "sources"}
              onClick={() => setTab("sources")}
              icon={Database}
              label="Data Sources"
            />
          </div>
        </div>
      </div>

      {tab === "sources" ? (
        <div className="flex-1 overflow-hidden">
          <DataSourcesPanel onInsertQuery={insertQueryFromAI} />
        </div>
      ) : tab === "charts" ? (
        <ChartsView />
      ) : tab === "boards" ? (
        <div className="min-h-0 flex-1 overflow-hidden">
          <DashboardsView onExplore={() => setTab("explore")} />
        </div>
      ) : tab === "definitions" ? (
        <DefinitionsView
          onOpen={(spec) => {
            setPreset(spec);
            setTab("explore");
          }}
        />
      ) : tab === "funnels" ? (
        <div className="min-h-0 flex-1 overflow-hidden">
          <FunnelsView />
        </div>
      ) : tab === "explore" ? (
        <div className="min-h-0 flex-1 overflow-hidden">
          <ExploreView preset={preset} />
        </div>
      ) : (
        <QueryEditorPanel />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-3 py-3 text-xs border-b-2 transition-colors -mb-px",
        active
          ? "border-foreground text-foreground font-medium"
          : "border-transparent text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
