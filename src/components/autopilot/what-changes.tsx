"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  experimentQueryKeys,
  useExperimentChanges,
  useExperimentSnapshot,
  useExperimentSummary,
  type ExperimentChanges as Changes,
  type ExperimentSnapshot as SnapshotResponse,
} from "@/components/autopilot/experiment-queries";
import { captionLines, type CaptionLine } from "@/lib/autopilot/caption";
import type { ChangeSummary } from "@/lib/autopilot/change-summary";
import { addedTextFromPatch, normalizePreviewCondition, textDifference } from "@/lib/autopilot/preview-diff";
import { snapshotStageLabel, type SnapshotStage } from "@/lib/autopilot/snapshot-stage-core";
import type { Experiment } from "@/lib/autopilot/types";

function previewHref(origin: string, page: string, flag: string, arm: "control" | "treatment", embed: boolean) {
  const url = new URL(page || "/", `${origin}/`);
  url.searchParams.set("kismet_preview", `${flag}:${arm}`);
  if (embed) url.searchParams.set("kismet_embed", "1");
  return url.toString();
}

export function WhatChanges({ experiment }: { experiment: Experiment }) {
  const summaryQuery = useExperimentSummary(experiment);
  const changesQuery = useExperimentChanges(experiment);
  const summary = summaryQuery.data;
  const changes = changesQuery.data;
  const reason = summaryQuery.error ?? changesQuery.error;
  const error = reason instanceof Error ? reason.message || (changesQuery.error ? "Could not load the preview." : "Could not load the change summary.") : reason ? "Could not load what changes." : "";

  if (summary?.summary?.kind === "behavior") return null;

  return (
    <section className="text-[#374151]">
      {error ? <p className="text-sm text-[#b42318]">{error}</p> : !summary || !changes ? (
        <LoadingBlock className="min-h-40" label="Loading what changes…" />
      ) : summary.pending || !summary.summary ? (
        <p className="text-sm text-[#6b7280]">The change is still being built.</p>
      ) : (
        <div className="animate-in fade-in duration-150"><SummaryContent experiment={experiment} summary={summary.summary} changes={changes} siteUrl={summary.siteUrl ?? changes.siteUrl ?? null} /></div>
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
  const addedText = useMemo(() => {
    const files = changes.source === "pull" ? changes.pull?.files : changes.files;
    return addedTextFromPatch((files ?? []).flatMap((file) => file.patch ? [file.patch] : []));
  }, [changes]);
  if (summary.kind !== "ui") return null;
  return (
    <VisualPreview
      experiment={experiment}
      changes={changes}
      siteUrl={siteUrl}
      when={summary.when}
      where={place}
      before={summary.before}
      after={summary.after}
      addedText={addedText}
    />
  );
}

export function VersionCaption({ before, after }: { before: string; after: string }) {
  const [version, setVersion] = useState<"control" | "treatment">("treatment");
  return (
    <div>
      <VersionToggle showing={version} onChange={setVersion} />
      <CaptionList version={version} before={before} after={after} />
    </div>
  );
}

function CaptionList({ version, before, after }: { version: "control" | "treatment"; before: string; after: string }) {
  const lines = captionLines(version === "control" ? before : after);
  if (!lines.length) return null;
  return (
    <ul className="mt-2 space-y-1 text-xs leading-5 text-[#4b5563]">
      {lines.map((line) => (
        <li key={line.text} className="flex gap-2">
          <span className="text-[#c4c8cf]" aria-hidden="true">•</span>
          <span><CaptionText line={line} /></span>
        </li>
      ))}
    </ul>
  );
}

function CaptionText({ line }: { line: CaptionLine }) {
  const marks = [...line.marks].sort((a, b) => b.length - a.length);
  const nodes: ReactNode[] = [];
  let rest = line.text;
  while (rest) {
    let hit: { index: number; mark: string } | null = null;
    for (const mark of marks) {
      const index = rest.toLowerCase().indexOf(mark.toLowerCase());
      if (index >= 0 && (hit === null || index < hit.index)) hit = { index, mark: rest.slice(index, index + mark.length) };
    }
    if (!hit) {
      nodes.push(rest);
      break;
    }
    if (hit.index > 0) nodes.push(rest.slice(0, hit.index));
    nodes.push(<strong key={nodes.length} className="font-semibold text-[#111827]">{hit.mark}</strong>);
    rest = rest.slice(hit.index + hit.mark.length);
  }
  return <>{nodes}</>;
}

function VersionToggle({ showing, onChange, extra }: {
  showing: "control" | "treatment";
  onChange: (version: "control" | "treatment") => void;
  extra?: ReactNode;
}) {
  const option = (value: "control" | "treatment", label: string) => (
    <button
      type="button"
      aria-pressed={showing === value}
      onClick={() => onChange(value)}
      className={`rounded px-2.5 py-1 ${showing === value ? "bg-white font-medium text-[#111827] shadow-sm" : "text-[#6b7280] hover:text-[#374151]"}`}
    >
      {label}
    </button>
  );
  return (
    <div className="flex items-center justify-between text-xs">
      <div className="inline-flex rounded-md bg-[#f1f3f5] p-0.5" role="group" aria-label="Which version to show">
        {option("control", "Current")}
        {option("treatment", "New version")}
      </div>
      {extra}
    </div>
  );
}

function VisualPreview({ experiment, changes, siteUrl, when, where, before, after, addedText }: {
  experiment: Experiment;
  changes: Changes;
  siteUrl: string | null;
  when: string;
  where: string;
  before: string;
  after: string;
  addedText: string[];
}) {
  const queryClient = useQueryClient();
  const snapshotQuery = useExperimentSnapshot(experiment);
  const snapshot = snapshotQuery.data ?? null;
  const refetchSnapshot = snapshotQuery.refetch;
  const [snapshotMessage, setSnapshotMessage] = useState("");
  const snapshotLoadMessage = snapshotQuery.error instanceof Error
    ? snapshotQuery.error.message || "Could not load the sample preview."
    : snapshotQuery.error ? "Could not load the sample preview." : "";
  const startAttempted = useRef(false);
  const ownOrigin = changes.ownRepo && typeof window !== "undefined" ? window.location.origin : null;
  const liveOrigin = ownOrigin ?? siteUrl;
  const isLive = ["running", "awaiting_rollout", "rolling_out", "rolled_out", "stopped"].includes(experiment.status)
    || changes.pull?.state === "merged";
  const hasSource = changes.source === "pull" || changes.source === "branch";
  const shouldAutoRender = Boolean(when.trim()) || !isLive;

  const startRender = async () => {
    setSnapshotMessage("");
    const started = await fetch(`/api/autopilot/experiments/${experiment.id}/snapshot`, { method: "POST" });
    if (!started.ok) {
      setSnapshotMessage((await started.text()) || "Could not start the sample preview.");
      return;
    }
    queryClient.setQueryData(experimentQueryKeys.snapshot(experiment), (await started.json()) as SnapshotResponse);
  };

  useEffect(() => {
    if (!snapshot) return;
    let timer: number | undefined;
    const advance = async () => {
      if (snapshot.status === "none" && hasSource && shouldAutoRender && !startAttempted.current) {
        startAttempted.current = true;
        const started = await fetch(`/api/autopilot/experiments/${experiment.id}/snapshot`, { method: "POST" });
        if (!started.ok) {
          setSnapshotMessage((await started.text()) || "Could not start the sample preview.");
          return;
        }
        queryClient.setQueryData(experimentQueryKeys.snapshot(experiment), (await started.json()) as SnapshotResponse);
      } else if (snapshot.status === "rendering") {
        timer = window.setTimeout(() => { void refetchSnapshot(); }, 10_000);
      }
    };
    advance().catch((reason: unknown) => {
      setSnapshotMessage(reason instanceof Error ? reason.message : "Could not load the sample preview.");
    });
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [experiment, hasSource, queryClient, refetchSnapshot, shouldAutoRender, snapshot]);

  if (snapshotQuery.isPending) return <LoadingBlock className="mt-4 min-h-72" label="Loading sample preview…" />;

  return (
    <div className="mt-4">
      {when && <p className="mb-2 text-xs text-[#6b7280]">The new version only appears {normalizePreviewCondition(when)}.</p>}
      {where && <p className="mb-2 text-xs text-[#6b7280]">{where}</p>}
      <SnapshotChoice
        experiment={experiment}
        changes={changes}
        liveOrigin={liveOrigin}
        isLive={isLive}
        when={when}
        before={before}
        after={after}
        addedText={addedText}
        snapshot={snapshot}
      />
      {snapshot?.status === "none" && hasSource && !shouldAutoRender && (
        <button
          type="button"
          className="mt-2 text-xs text-brand hover:underline"
          onClick={() => {
            startAttempted.current = true;
            startRender().catch((reason: unknown) => {
              setSnapshotMessage(reason instanceof Error ? reason.message : "Could not start the sample preview.");
            });
          }}
        >
          Render a sample
        </button>
      )}
      {snapshot?.status === "rendering" && (
        <SnapshotProgress stage={snapshot.stage ?? "setting_up"} elapsedMinutes={snapshot.elapsedMinutes ?? 0} />
      )}
      {(snapshot?.status === "failed" || snapshotMessage || snapshotLoadMessage) && (
        <p className="mt-2 text-xs text-[#6b7280]">{snapshotMessage || snapshotLoadMessage || snapshot?.error || "The sample preview could not be rendered."}</p>
      )}
    </div>
  );
}

function SnapshotProgress({ stage, elapsedMinutes }: { stage: SnapshotStage; elapsedMinutes: number }) {
  const stages: SnapshotStage[] = ["setting_up", "rendering_current", "rendering_new", "checking", "ready"];
  const currentIndex = stages.indexOf(stage);
  return (
    <div className="mt-2 flex items-center gap-1 overflow-x-auto whitespace-nowrap text-xs text-[#6b7280]" role="status">
      {stages.map((item, index) => (
        <span key={item} className="contents">
          {index > 0 && <span className="text-[#c4c8cf]">→</span>}
          <span className={index < currentIndex ? "text-[#17663a]" : index === currentIndex ? "font-medium text-[#111827]" : "text-[#9aa0a8]"}>
            {index < currentIndex ? "✓ " : ""}{snapshotStageLabel(item)}
          </span>
        </span>
      ))}
      <span className="ml-1 text-[#9aa0a8]">· {elapsedMinutes} min</span>
    </div>
  );
}

function SnapshotChoice({ experiment, changes, liveOrigin, isLive, when, before, after, addedText, snapshot }: {
  experiment: Experiment;
  changes: Changes;
  liveOrigin: string | null;
  isLive: boolean;
  when: string;
  before: string;
  after: string;
  addedText: string[];
  snapshot: SnapshotResponse | null;
}) {
  const ready = snapshot?.status === "ready" && Boolean(snapshot.controlHtml && snapshot.treatmentHtml);
  const [shownAs, setShownAs] = useState<"sample" | "account">(() => ready && (Boolean(when.trim()) || !isLive) ? "sample" : "account");
  const chosen = useRef(false);
  const live = (showCaption: boolean) => (
    <PreviewBody experiment={experiment} changes={changes} liveOrigin={liveOrigin} isLive={isLive} when={when} before={before} after={after} addedText={addedText} showCaption={showCaption} />
  );
  if (!ready) return live(true);
  // A change that only shows in some states (an empty list, a first visit) usually looks identical on
  // the person's own account, so the sample is the only useful comparison there.
  const offerAccount = isLive && !when.trim();
  const showSample = shownAs === "sample" || !offerAccount;
  const scenario = snapshot.scenario || "Sample data";
  return (
    <div>
      {offerAccount ? (
        <div className="mb-2 flex items-center gap-2 text-xs text-[#6b7280]">
          <span className="shrink-0">Shown with</span>
          <div className="inline-flex shrink-0 rounded-md bg-[#f1f3f5] p-0.5" role="group" aria-label="Which data to show">
            <button
              type="button"
              aria-pressed={shownAs === "sample"}
              onClick={() => { chosen.current = true; setShownAs("sample"); }}
              className={`whitespace-nowrap rounded px-2.5 py-1 ${shownAs === "sample" ? "bg-white font-medium text-[#111827] shadow-sm" : "hover:text-[#374151]"}`}
            >
              Sample data
            </button>
            <button
              type="button"
              aria-pressed={shownAs === "account"}
              onClick={() => { chosen.current = true; setShownAs("account"); }}
              className={`whitespace-nowrap rounded px-2.5 py-1 ${shownAs === "account" ? "bg-white font-medium text-[#111827] shadow-sm" : "hover:text-[#374151]"}`}
            >
              Your account
            </button>
          </div>
        </div>
      ) : null}
      {showSample ? (
        <>
          <PreviewSwitcher control={snapshot.controlHtml!} treatment={snapshot.treatmentHtml!} when={when} before={before} after={after} addedText={[]} sample />
          <p className="mt-2 text-[11px] text-[#9aa0a8]">Sample data: {scenario} · rendered by Kismet&apos;s coding agent</p>
          {!isLive && <div className="mt-3">{live(false)}</div>}
        </>
      ) : live(true)}
    </div>
  );
}

function LoadingBlock({ className, label }: { className: string; label: string }) {
  return (
    <div className={`${className} animate-pulse rounded-md border border-[#e6e8ec] bg-[#f8f9fa] p-3`} role="status">
      <span className="sr-only">{label}</span>
      <div className="h-3 w-2/3 rounded bg-[#e6e8ec]" />
      <div className="mt-3 h-3 w-1/2 rounded bg-[#eceef1]" />
      <div className="mt-6 h-24 rounded bg-[#eceef1]" />
    </div>
  );
}

function PreviewBody({ experiment, changes, liveOrigin, isLive, when, before, after, addedText, showCaption }: {
  experiment: Experiment;
  changes: Changes;
  liveOrigin: string | null;
  isLive: boolean;
  when: string;
  before: string;
  after: string;
  addedText: string[];
  showCaption: boolean;
}) {
  if (!liveOrigin) return (
    <p className="rounded border border-[#e1e4e8] bg-[#f8f9fa] p-3 text-sm text-[#6b7280]">
      <Link href="/experiments/install" className="text-brand hover:underline">Add your site&apos;s URL on the install page</Link> to see both versions here.
    </p>
  );
  // `page` falls back to an area name like "Experiments" when Kismet could not name a route; loading
  // that as a URL only shows the site's 404 page.
  if (!experiment.page?.trim().startsWith("/")) return (
    <p className="rounded border border-[#e1e4e8] bg-[#f8f9fa] p-3 text-sm text-[#6b7280]">
      Kismet doesn&apos;t know which page this changes, so there&apos;s no live preview. See the code change below.
    </p>
  );
  const control = previewHref(liveOrigin, experiment.page, experiment.flag, "control", isLive);
  const treatmentOrigin = isLive ? liveOrigin : changes.previewUrl;
  // Kismet's own preview builds have no sign-in (Clerk is configured for production only), so the link
  // would only show "Sign-in is not configured". Other sites' preview builds are fine to open.
  const treatment = treatmentOrigin && !changes.ownRepo ? previewHref(treatmentOrigin, experiment.page, experiment.flag, "treatment", isLive) : null;
  if (!isLive) return (
    <div>
      <div className="flex flex-wrap items-center gap-3 rounded border border-[#e1e4e8] bg-[#f8f9fa] p-3 text-sm">
        {treatment && <a href={treatment} target="_blank" rel="noreferrer" className="text-brand hover:underline">Open new version (preview build) ↗</a>}
        <a href={control} target="_blank" rel="noreferrer" className="text-brand hover:underline">Open current version ↗</a>
        <span className="w-full text-xs text-[#6b7280]">{treatment ? "Preview builds can ask you to sign in." : changes.ownRepo ? "Kismet's preview builds can't sign in, so use the sample render above." : "The preview build is not available yet."}</span>
      </div>
      {showCaption && <div className="mt-3"><VersionCaption before={before} after={after} /></div>}
    </div>
  );
  if (!treatment) return showCaption ? <VersionCaption before={before} after={after} /> : null;
  return <PreviewSwitcher control={control} treatment={treatment} when={when} before={before} after={after} addedText={addedText} />;
}

const FRAME_WIDTH = 1280;
const FRAME_HEIGHT = 760;

/**
 * One large frame with a Current / New version switch. Both pages stay loaded so flipping is
 * instant, which makes the difference easy to spot; side by side they shrank to unreadable.
 */
type FrameText = { element: HTMLElement; text: string };

function frameTextBlocks(document: Document): FrameText[] {
  const ignored = new Set(["SCRIPT", "STYLE", "NOSCRIPT"]);
  const elements = [document.body, ...document.body.querySelectorAll<HTMLElement>("*")];
  return elements.flatMap((element) => {
    if (ignored.has(element.tagName) || element.getAttribute("aria-hidden") === "true") return [];
    if (document.defaultView?.getComputedStyle(element).display === "none") return [];
    const text = Array.from(element.childNodes)
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent ?? "")
      .join(" ")
      .trim()
      .replace(/\s+/g, " ");
    return text ? [{ element, text }] : [];
  });
}

function highlightTreatment(document: Document, blocks: FrameText[], texts: string[]) {
  const remaining = new Map<string, number>();
  for (const text of texts) remaining.set(text, (remaining.get(text) ?? 0) + 1);
  for (const block of blocks) {
    const count = remaining.get(block.text) ?? 0;
    if (count > 0) {
      block.element.setAttribute("data-kismet-new", "");
      remaining.set(block.text, count - 1);
    }
  }
  const style = document.createElement("style");
  style.textContent = "[data-kismet-new]{outline:2px solid #f59e0b;outline-offset:2px;border-radius:2px;background:rgba(245,158,11,.08)}";
  document.head.appendChild(style);
}

function PreviewSwitcher({ control, treatment, when, before, after, addedText, sample = false }: {
  control: string;
  treatment: string;
  when: string;
  before: string;
  after: string;
  addedText: string[];
  sample?: boolean;
}) {
  const [showing, setShowing] = useState<"control" | "treatment">("treatment");
  const box = useRef<HTMLDivElement>(null);
  const controlFrame = useRef<HTMLIFrameElement>(null);
  const treatmentFrame = useRef<HTMLIFrameElement>(null);
  const [loads, setLoads] = useState({ control: 0, treatment: 0 });
  const [comparison, setComparison] = useState<{ onlyInTreatment: string[]; onlyInControl: string[] } | null>(null);
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
  useEffect(() => {
    if (!loads.control || !loads.treatment) return;
    const timer = window.setTimeout(() => {
      try {
        const controlDocument = controlFrame.current?.contentDocument;
        const treatmentDocument = treatmentFrame.current?.contentDocument;
        if (!controlDocument?.body || !treatmentDocument?.body) return;
        const controlBlocks = frameTextBlocks(controlDocument);
        const treatmentBlocks = frameTextBlocks(treatmentDocument);
        const result = textDifference(
          controlBlocks.map(({ text }) => text),
          treatmentBlocks.map(({ text }) => text),
        );
        if (result.onlyInTreatment.length) highlightTreatment(treatmentDocument, treatmentBlocks, result.onlyInTreatment);
        setComparison(result);
      } catch {
        // Cross-origin frames cannot be inspected. The preview still works without comparison notes.
      }
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [loads]);
  const src = showing === "control" ? control : treatment;
  const fullPage = useMemo(() => {
    if (sample) return null;
    const url = new URL(src);
    url.searchParams.delete("kismet_embed");
    return url.toString();
  }, [sample, src]);
  const hasNewText = Boolean(comparison?.onlyInTreatment.length);
  // A sample render is the comparison itself; a layout-only change has identical text but still looks
  // different, so never hide the sample frames.
  const pagesMatch = !sample && comparison !== null
    && comparison.onlyInTreatment.length === 0
    && comparison.onlyInControl.length === 0;
  return (
    <div>
      <div className="mb-2">
        <VersionToggle
          showing={showing}
          onChange={setShowing}
          extra={fullPage && !pagesMatch ? <a href={fullPage} target="_blank" rel="noreferrer" className="text-brand hover:underline">Open full page ↗</a> : null}
        />
      </div>
      {hasNewText && (
        <p className="mb-2 rounded border border-[#f59e0b] bg-[#fffbeb] px-3 py-2 text-xs text-[#92400e]">
          {showing === "treatment" ? "Highlighted in the new version: what’s new" : "Switch to New version to see what’s highlighted"}
        </p>
      )}
      {pagesMatch && (
        <div className="mb-2 rounded border border-[#f59e0b] bg-[#fffbeb] p-3 text-xs text-[#78350f]">
          <p className="font-medium text-[#92400e]">
            You won&apos;t see this change on your account{when ? ` because it only appears ${normalizePreviewCondition(when)}` : " right now"}.
          </p>
          {addedText.length ? (
            <div className="mt-2 border-t border-[#fcd34d] pt-2">
              <p className="font-medium">What the new version adds</p>
              <ul className="mt-1 space-y-1">
                {addedText.map((text) => <li key={text}>&ldquo;{text}&rdquo;</li>)}
              </ul>
            </div>
          ) : (
            <p className="mt-1">The difference isn&apos;t visible on this page right now; see the code change below.</p>
          )}
        </div>
      )}
      {/* Both frames stay mounted so the comparison can run; once they match there is nothing to show. */}
      <div ref={box} className={`relative overflow-hidden rounded border border-[#e1e4e8] bg-white${pagesMatch ? " hidden" : ""}`} style={{ aspectRatio: `${FRAME_WIDTH} / ${FRAME_HEIGHT}` }}>
        {([["control", control], ["treatment", treatment]] as const).map(([value, url]) => (
          <iframe
            key={value}
            title={value === "control" ? "Current version" : "New version"}
            {...(sample ? { srcDoc: url, sandbox: "allow-same-origin" } : { src: url })}
            ref={value === "control" ? controlFrame : treatmentFrame}
            onLoad={() => {
              setComparison(null);
              setLoads((current) => ({ ...current, [value]: current[value] + 1 }));
            }}
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
      <CaptionList version={showing} before={before} after={after} />
    </div>
  );
}
