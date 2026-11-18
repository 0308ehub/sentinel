"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { ChangeSummary } from "@/lib/autopilot/change-summary";
import type { Experiment } from "@/lib/autopilot/types";

type Changes = {
  source: "none" | "draft" | "branch" | "pull";
  previewUrl?: string | null;
  siteUrl?: string | null;
  ownRepo?: boolean;
  pull?: { state: "open" | "closed" | "merged" };
};

type SummaryResponse = { summary?: ChangeSummary; pending?: boolean; siteUrl?: string | null; error?: string };

function previewHref(origin: string, page: string, flag: string, arm: "control" | "treatment", embed: boolean) {
  const url = new URL(page || "/", `${origin}/`);
  url.searchParams.set("kismet_preview", `${flag}:${arm}`);
  if (embed) url.searchParams.set("kismet_embed", "1");
  return url.toString();
}

export function WhatChanges({ experiment }: { experiment: Experiment }) {
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [changes, setChanges] = useState<Changes | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch(`/api/autopilot/experiments/${experiment.id}/summary`, { cache: "no-store", signal: controller.signal }),
      fetch(`/api/autopilot/experiments/${experiment.id}/changes`, { cache: "no-store", signal: controller.signal }),
    ]).then(async ([summaryResponse, changesResponse]) => {
      const summaryBody = (await summaryResponse.json().catch(() => ({}))) as SummaryResponse;
      const changesBody = (await changesResponse.json().catch(() => ({}))) as Changes & { error?: string };
      if (!summaryResponse.ok) throw new Error(summaryBody.error || "Could not load the change summary.");
      if (!changesResponse.ok) throw new Error(changesBody.error || "Could not load the preview.");
      setSummary(summaryBody);
      setChanges(changesBody);
    }).catch((reason: unknown) => {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      setError(reason instanceof Error ? reason.message : "Could not load what changes.");
    });
    return () => controller.abort();
  }, [experiment.id]);

  return (
    <section className="border-b border-[#e6e8ec] px-4 py-4 text-[#374151]">
      <h2 className="text-sm font-medium text-[#111827]">What changes</h2>
      {error ? <p className="mt-3 text-sm text-[#b42318]">{error}</p> : !summary || !changes ? (
        <p className="mt-3 text-sm text-[#6b7280]">Loading what changes…</p>
      ) : summary.pending || !summary.summary ? (
        <p className="mt-3 text-sm text-[#6b7280]">The change is still being built.</p>
      ) : (
        <SummaryContent experiment={experiment} summary={summary.summary} changes={changes} siteUrl={summary.siteUrl ?? changes.siteUrl ?? null} />
      )}
    </section>
  );
}

function SummaryContent({ experiment, summary, changes, siteUrl }: {
  experiment: Experiment;
  summary: ChangeSummary;
  changes: Changes;
  siteUrl: string | null;
}) {
  const place = [summary.where ? `On ${summary.where}` : "", summary.when].filter(Boolean).join(" · ");
  return (
    <div className="mt-3">
      <div className="grid gap-3 md:grid-cols-2">
        <SummaryCard label="Before" text={summary.before} />
        <SummaryCard label="After" text={summary.after} />
      </div>
      {place && <p className="mt-2 text-xs text-[#6b7280]">{place}</p>}
      {summary.kind === "ui" && (
        <VisualPreview experiment={experiment} changes={changes} siteUrl={siteUrl} when={summary.when} />
      )}
    </div>
  );
}

function SummaryCard({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded border border-[#e1e4e8] bg-[#f8f9fa] p-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-[#6b7280]">{label}</p>
      <p className="mt-1 text-sm leading-5 text-[#111827]">{text}</p>
    </div>
  );
}

function VisualPreview({ experiment, changes, siteUrl, when }: {
  experiment: Experiment;
  changes: Changes;
  siteUrl: string | null;
  when: string;
}) {
  const ownOrigin = changes.ownRepo && typeof window !== "undefined" ? window.location.origin : null;
  const liveOrigin = ownOrigin ?? siteUrl;
  const isLive = ["running", "awaiting_rollout", "rolled_out", "stopped"].includes(experiment.status)
    || changes.pull?.state === "merged";
  if (when) return (
    <div className="mt-4">
      <p className="mb-2 text-xs text-[#6b7280]">The new version only appears {when}.</p>
      <PreviewBody experiment={experiment} changes={changes} liveOrigin={liveOrigin} isLive={isLive} />
    </div>
  );
  return <div className="mt-4"><PreviewBody experiment={experiment} changes={changes} liveOrigin={liveOrigin} isLive={isLive} /></div>;
}

function PreviewBody({ experiment, changes, liveOrigin, isLive }: {
  experiment: Experiment;
  changes: Changes;
  liveOrigin: string | null;
  isLive: boolean;
}) {
  if (!liveOrigin) return (
    <p className="rounded border border-[#e1e4e8] bg-[#f8f9fa] p-3 text-sm text-[#6b7280]">
      <Link href="/experiments/install" className="text-[#2563eb] hover:underline">Add your site&apos;s URL on the install page</Link> to see both versions here.
    </p>
  );
  const control = previewHref(liveOrigin, experiment.page, experiment.flag, "control", isLive);
  const treatmentOrigin = isLive ? liveOrigin : changes.previewUrl;
  const treatment = treatmentOrigin ? previewHref(treatmentOrigin, experiment.page, experiment.flag, "treatment", isLive) : null;
  if (!isLive) return (
    <div className="flex flex-wrap items-center gap-3 rounded border border-[#e1e4e8] bg-[#f8f9fa] p-3 text-sm">
      {treatment && <a href={treatment} target="_blank" rel="noreferrer" className="text-[#2563eb] hover:underline">Open new version (preview build) ↗</a>}
      <a href={control} target="_blank" rel="noreferrer" className="text-[#2563eb] hover:underline">Open current version ↗</a>
      <span className="w-full text-xs text-[#6b7280]">{treatment ? "Preview builds can ask you to sign in." : "The preview build is not available yet."}</span>
    </div>
  );
  if (!treatment) return null;
  return <PreviewSwitcher control={control} treatment={treatment} />;
}

const FRAME_WIDTH = 1200;
const FRAME_HEIGHT = 760;

/**
 * One large frame with a Current / New version switch. Both pages stay loaded so flipping is
 * instant, which makes the difference easy to spot; side by side they shrank to unreadable.
 */
function PreviewSwitcher({ control, treatment }: { control: string; treatment: string }) {
  const [showing, setShowing] = useState<"control" | "treatment">("treatment");
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.6);
  useEffect(() => {
    const node = box.current;
    if (!node) return;
    const update = () => setScale(node.clientWidth / FRAME_WIDTH);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const src = showing === "control" ? control : treatment;
  const fullPage = useMemo(() => {
    const url = new URL(src);
    url.searchParams.delete("kismet_embed");
    return url.toString();
  }, [src]);
  const option = (value: "control" | "treatment", label: string) => (
    <button
      type="button"
      aria-pressed={showing === value}
      onClick={() => setShowing(value)}
      className={`rounded px-2.5 py-1 ${showing === value ? "bg-white font-medium text-[#111827] shadow-sm" : "text-[#6b7280] hover:text-[#374151]"}`}
    >
      {label}
    </button>
  );
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs">
        <div className="inline-flex rounded-md bg-[#f1f3f5] p-0.5" role="group" aria-label="Which version to show">
          {option("control", "Current")}
          {option("treatment", "New version")}
        </div>
        <a href={fullPage} target="_blank" rel="noreferrer" className="text-[#2563eb] hover:underline">Open full page ↗</a>
      </div>
      <div ref={box} className="relative overflow-hidden rounded border border-[#e1e4e8] bg-white" style={{ aspectRatio: `${FRAME_WIDTH} / ${FRAME_HEIGHT}` }}>
        {([["control", control], ["treatment", treatment]] as const).map(([value, url]) => (
          <iframe
            key={value}
            title={value === "control" ? "Current version" : "New version"}
            src={url}
            loading="lazy"
            aria-hidden={showing !== value}
            className="absolute left-0 top-0 border-0"
            style={{
              width: FRAME_WIDTH,
              height: FRAME_HEIGHT,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
              visibility: showing === value ? "visible" : "hidden",
            }}
          />
        ))}
      </div>
    </div>
  );
}
