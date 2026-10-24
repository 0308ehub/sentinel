"use client";

import { useEffect, useState } from "react";
import { Check, Link2, Loader2, Plus, Trash2 } from "lucide-react";
import { ChartCanvas } from "@/components/analytics/chart-canvas";
import { Button } from "@/components/ui/button";
import { encodeBoard, filterLabel } from "@/lib/analytics/library";
import type { ExploreResult, ExploreSpec } from "@/lib/analytics/explore-types";
import { useAnalyticsLibrary } from "@/stores/analytics-store";

export function DashboardsView({ onExplore }: { onExplore: () => void }) {
  const dashboards = useAnalyticsLibrary((state) => state.dashboards);
  const activeId = useAnalyticsLibrary((state) => state.activeDashboardId);
  const setActive = useAnalyticsLibrary((state) => state.setActiveDashboard);
  const createDashboard = useAnalyticsLibrary((state) => state.createDashboard);
  const renameDashboard = useAnalyticsLibrary((state) => state.renameDashboard);
  const deleteDashboard = useAnalyticsLibrary((state) => state.deleteDashboard);
  const removeCard = useAnalyticsLibrary((state) => state.removeCard);
  const rememberShare = useAnalyticsLibrary((state) => state.rememberShare);
  const board = dashboards.find((item) => item.id === activeId) ?? dashboards[0] ?? null;
  const [copied, setCopied] = useState(false);

  async function share() {
    if (!board || board.cards.length === 0) return;
    const token = encodeBoard({
      v: 1,
      name: board.name,
      cards: board.cards.map((card) => ({ title: card.title, spec: card.spec })),
    });
    if (token.length > 6000) return;
    const url = `${window.location.origin}/analytics?board=${token}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      return;
    }
    rememberShare(board.id, token);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="flex h-full min-h-0">
      <aside className="flex w-56 shrink-0 flex-col border-r border-border">
        <div className="flex items-center justify-between px-3 py-3">
          <p className="text-xs text-muted-foreground">Boards</p>
          <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => createDashboard()} aria-label="New board">
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {dashboards.length === 0 && <p className="px-2 text-xs text-muted-foreground">No boards yet.</p>}
          {dashboards.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActive(item.id)}
              className={`mb-1 w-full rounded-md px-2 py-1.5 text-left text-xs ${item.id === board?.id ? "bg-muted font-medium" : "hover:bg-muted/60"}`}
            >
              <span className="block truncate">{item.name}</span>
              <span className="text-[10px] text-muted-foreground">{item.cards.length} charts</span>
            </button>
          ))}
        </div>
      </aside>
      <div className="min-w-0 flex-1 overflow-y-auto px-6 py-5">
        {!board ? (
          <div className="mx-auto max-w-md pt-16 text-center">
            <h2 className="text-lg font-semibold">Share a board of charts</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Pin charts from Explore. A copied link opens the same board in another browser. The numbers still come from the warehouse.
            </p>
            <div className="mt-5 flex justify-center gap-2">
              <Button type="button" onClick={() => createDashboard()}>
                New board
              </Button>
              <Button type="button" variant="outline" onClick={onExplore}>
                Open Explore
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <input
                  value={board.name}
                  onChange={(event) => renameDashboard(board.id, event.target.value)}
                  aria-label="Board name"
                  className="w-full bg-transparent text-lg font-semibold outline-none"
                />
                <p className="text-[11px] text-muted-foreground">Saved in this browser. Share copies the chart definitions into a link.</p>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={onExplore}>
                  Add from Explore
                </Button>
                <Button type="button" size="sm" onClick={() => void share()} disabled={board.cards.length === 0}>
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
                  {copied ? "Copied" : "Copy link"}
                </Button>
                <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => deleteDashboard(board.id)} aria-label="Delete board">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            {board.cards.length === 0 ? (
              <p className="mt-10 text-sm text-muted-foreground">This board is empty. Build a chart in Explore and pin it.</p>
            ) : (
              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                {board.cards.map((card) => (
                  <article key={card.id} className="rounded-xl border border-border p-4">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-medium">{card.title}</h3>
                        <p className="text-[11px] text-muted-foreground">{filterLabel(card.spec.segment)}</p>
                      </div>
                      <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => removeCard(board.id, card.id)} aria-label="Remove chart">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <LiveCard spec={card.spec} />
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function LiveCard({ spec }: { spec: ExploreSpec }) {
  const [result, setResult] = useState<ExploreResult | null>(null);
  const [error, setError] = useState("");
  const key = JSON.stringify(spec);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/analytics/explore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: key,
    })
      .then(async (res) => {
        const body = (await res.json()) as ExploreResult & { hint?: string; error?: string };
        if (!res.ok) throw new Error(body.hint || body.error || "The chart query failed.");
        if (!cancelled) setResult(body);
      })
      .catch((reason: Error) => {
        if (!cancelled) setError(reason.message);
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  if (error) return <p className="text-xs text-destructive">{error}</p>;
  if (!result) {
    return (
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Running on Databricks…
      </p>
    );
  }
  return <ChartCanvas result={result} measure={spec.measure} compact />;
}
