"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { ChangeSummary } from "@/lib/autopilot/change-summary";
import { addedTextFromPatch, normalizePreviewCondition, textDifference } from "@/lib/autopilot/preview-diff";
import type { Experiment } from "@/lib/autopilot/types";

type ChangeFile = { patch?: string };

type Changes = {
  source: "none" | "draft" | "branch" | "pull";
  previewUrl?: string | null;
  siteUrl?: string | null;
  ownRepo?: boolean;
  files?: ChangeFile[];
  pull?: { state: "open" | "closed" | "merged"; files?: ChangeFile[] };
};

type SummaryResponse = { summary?: ChangeSummary; pending?: boolean; siteUrl?: string | null; error?: string };
type SnapshotResponse = {
  status: "none" | "rendering" | "ready" | "failed";
  scenario?: string | null;
  error?: string | null;
  controlHtml?: string | null;
  treatmentHtml?: string | null;
};

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
    // Reload when the change itself moves on: a branch is pushed, a PR opens, or the draft is replaced.
  }, [experiment.id, experiment.branch, experiment.prNumber, experiment.draftPath, experiment.version]);

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
  const addedText = useMemo(() => {
    const files = changes.source === "pull" ? changes.pull?.files : changes.files;
    return addedTextFromPatch((files ?? []).flatMap((file) => file.patch ? [file.patch] : []));
  }, [changes]);
  return (
    <div className="mt-3">
      <div className="grid gap-3 md:grid-cols-2">
        <SummaryCard label="Before" text={summary.before} />
        <SummaryCard label="After" text={summary.after} />
      </div>
      {place && <p className="mt-2 text-xs text-[#6b7280]">{place}</p>}
      {summary.kind === "ui" && (
        <VisualPreview experiment={experiment} changes={changes} siteUrl={siteUrl} when={summary.when} addedText={addedText} />
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

function VisualPreview({ experiment, changes, siteUrl, when, addedText }: {
  experiment: Experiment;
  changes: Changes;
  siteUrl: string | null;
  when: string;
  addedText: string[];
}) {
  const [snapshot, setSnapshot] = useState<SnapshotResponse | null>(null);
  const [snapshotMessage, setSnapshotMessage] = useState("");
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
    setSnapshot((await started.json()) as SnapshotResponse);
  };

  useEffect(() => {
    let active = true;
    let timer: number | undefined;
    const load = async () => {
      const response = await fetch(`/api/autopilot/experiments/${experiment.id}/snapshot`, { cache: "no-store" });
      const body = (await response.json().catch(() => ({}))) as SnapshotResponse & { error?: string };
      if (!active) return;
      if (!response.ok) {
        setSnapshotMessage(body.error || "Could not load the sample preview.");
        return;
      }
      setSnapshot(body);
      if (body.status === "none" && hasSource && shouldAutoRender && !startAttempted.current) {
        startAttempted.current = true;
        const started = await fetch(`/api/autopilot/experiments/${experiment.id}/snapshot`, { method: "POST" });
        if (!active) return;
        if (!started.ok) {
          setSnapshotMessage((await started.text()) || "Could not start the sample preview.");
          return;
        }
        setSnapshot((await started.json()) as SnapshotResponse);
        timer = window.setTimeout(load, 10_000);
      } else if (body.status === "rendering") {
        timer = window.setTimeout(load, 10_000);
      }
    };
    load().catch((reason: unknown) => {
      if (active) setSnapshotMessage(reason instanceof Error ? reason.message : "Could not load the sample preview.");
    });
    return () => {
      active = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [experiment.id, hasSource, shouldAutoRender]);

  return (
    <div className="mt-4">
      {when && <p className="mb-2 text-xs text-[#6b7280]">The new version only appears {normalizePreviewCondition(when)}.</p>}
      <SnapshotChoice
        experiment={experiment}
        changes={changes}
        liveOrigin={liveOrigin}
        isLive={isLive}
        when={when}
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
        <p className="mt-2 text-xs text-[#6b7280]">Rendering both versions with sample data… (usually a few minutes)</p>
      )}
      {(snapshot?.status === "failed" || snapshotMessage) && (
        <p className="mt-2 text-xs text-[#6b7280]">{snapshotMessage || snapshot?.error || "The sample preview could not be rendered."}</p>
      )}
    </div>
  );
}

function SnapshotChoice({ experiment, changes, liveOrigin, isLive, when, addedText, snapshot }: {
  experiment: Experiment;
  changes: Changes;
  liveOrigin: string | null;
  isLive: boolean;
  when: string;
  addedText: string[];
  snapshot: SnapshotResponse | null;
}) {
  const ready = snapshot?.status === "ready" && Boolean(snapshot.controlHtml && snapshot.treatmentHtml);
  const [shownAs, setShownAs] = useState<"sample" | "account">("account");
  const chosen = useRef(false);
  useEffect(() => {
    if (!chosen.current && ready && (Boolean(when.trim()) || !isLive)) setShownAs("sample");
  }, [ready, when, isLive]);
  const live = (
    <PreviewBody experiment={experiment} changes={changes} liveOrigin={liveOrigin} isLive={isLive} when={when} addedText={addedText} />
  );
  if (!ready) return live;
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
          <PreviewSwitcher control={snapshot.controlHtml!} treatment={snapshot.treatmentHtml!} when={when} addedText={[]} sample />
          <p className="mt-2 text-xs text-[#6b7280]">Sample data: {scenario} · rendered by Kismet&apos;s coding agent</p>
          {!isLive && <div className="mt-3">{live}</div>}
        </>
      ) : live}
    </div>
  );
}

function PreviewBody({ experiment, changes, liveOrigin, isLive, when, addedText }: {
  experiment: Experiment;
  changes: Changes;
  liveOrigin: string | null;
  isLive: boolean;
  when: string;
  addedText: string[];
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
  const treatment = treatmentOrigin ? previewHref(treatmentOrigin, experiment.page, experiment.flag, "treatment", isLive) : null;
  if (!isLive) return (
    <div className="flex flex-wrap items-center gap-3 rounded border border-[#e1e4e8] bg-[#f8f9fa] p-3 text-sm">
      {treatment && <a href={treatment} target="_blank" rel="noreferrer" className="text-brand hover:underline">Open new version (preview build) ↗</a>}
      <a href={control} target="_blank" rel="noreferrer" className="text-brand hover:underline">Open current version ↗</a>
      <span className="w-full text-xs text-[#6b7280]">{treatment ? "Preview builds can ask you to sign in." : "The preview build is not available yet."}</span>
    </div>
  );
  if (!treatment) return null;
  return <PreviewSwitcher control={control} treatment={treatment} when={when} addedText={addedText} />;
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

function PreviewSwitcher({ control, treatment, when, addedText, sample = false }: {
  control: string;
  treatment: string;
  when: string;
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
  const hasNewText = Boolean(comparison?.onlyInTreatment.length);
  const pagesMatch = comparison !== null
    && comparison.onlyInTreatment.length === 0
    && comparison.onlyInControl.length === 0;
  return (
    <div>
      <div className={pagesMatch ? "hidden" : "mb-2 flex items-center justify-between text-xs"}>
        <div className="inline-flex rounded-md bg-[#f1f3f5] p-0.5" role="group" aria-label="Which version to show">
          {option("control", "Current")}
          {option("treatment", "New version")}
        </div>
        {fullPage && <a href={fullPage} target="_blank" rel="noreferrer" className="text-brand hover:underline">Open full page ↗</a>}
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
    </div>
  );
}
