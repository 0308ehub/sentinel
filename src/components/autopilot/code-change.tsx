"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { parsePatch } from "@/lib/autopilot/diff";
import type { Experiment } from "@/lib/autopilot/types";

type ChangeFile = {
  filename: string;
  status: string;
  additions?: number;
  deletions?: number;
  patch?: string;
};

type Changes =
  | { source: "none" }
  | { source: "draft"; files: ChangeFile[] }
  | { source: "branch"; branch: string; files: ChangeFile[] }
  | {
      source: "pull";
      checks: "pending" | "success" | "failure" | "none";
      pull: {
        title: string;
        state: "open" | "closed" | "merged";
        url: string;
        additions: number;
        deletions: number;
        changedFiles: number;
        files: ChangeFile[];
      };
    };

export function CodeChange({ experiment }: { experiment: Experiment }) {
  const [cleanup, setCleanup] = useState(false);
  const hasCleanup = Boolean(experiment.cleanup?.prNumber);
  return (
    <div className="px-4 py-4 text-[#374151]">
      {hasCleanup && (
        <div className="mb-4 inline-flex rounded border border-[#e6e8ec] p-0.5 text-xs">
          <SwitchButton active={!cleanup} onClick={() => setCleanup(false)}>Experiment change</SwitchButton>
          <SwitchButton active={cleanup} onClick={() => setCleanup(true)}>Cleanup change</SwitchButton>
        </div>
      )}
      <ChangeLoader key={cleanup ? "cleanup" : "experiment"} experimentId={experiment.id} cleanup={cleanup} />
    </div>
  );
}

function ChangeLoader({ experimentId, cleanup }: { experimentId: string; cleanup: boolean }) {
  const [changes, setChanges] = useState<Changes | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/autopilot/experiments/${experimentId}/changes${cleanup ? "?cleanup=1" : ""}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = (await response.json().catch(() => ({}))) as Changes & { error?: string };
        if (!response.ok) throw new Error(body.error || "Could not load the code change.");
        setChanges(body);
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(reason instanceof Error ? reason.message : "Could not load the code change.");
      });
    return () => controller.abort();
  }, [cleanup, experimentId]);
  if (error) return <p className="text-sm text-[#b42318]">{error}</p>;
  if (!changes) return <p className="text-sm text-[#6b7280]">Loading code change…</p>;
  return <ChangeContent changes={changes} />;
}

function SwitchButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`rounded px-2 py-1 ${active ? "bg-[#eef4ff] text-[#2563eb]" : "text-[#6b7280]"}`}>
      {children}
    </button>
  );
}

function ChangeContent({ changes }: { changes: Changes }) {
  if (changes.source === "none") return <p className="text-sm text-[#6b7280]">No code change is available yet.</p>;
  const files = changes.source === "pull" ? changes.pull.files : changes.files;
  return (
    <div>
      <ChangeHeader changes={changes} files={files} />
      <div className="mt-4 space-y-3">
        {files.map((file) => <FileDiff key={file.filename} file={file} initiallyOpen={files.length <= 5} pullUrl={changes.source === "pull" ? changes.pull.url : null} />)}
      </div>
    </div>
  );
}

function ChangeHeader({ changes, files }: { changes: Exclude<Changes, { source: "none" }>; files: ChangeFile[] }) {
  if (changes.source === "pull") {
    const pull = changes.pull;
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium text-[#111827]">{pull.title}</span>
        <a href={pull.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#2563eb] hover:underline">
          #{pull.url.split("/").at(-1)} <ExternalLink className="h-3 w-3" />
        </a>
        <Badge tone={pull.state === "open" ? "green" : pull.state === "merged" ? "purple" : "gray"}>{capitalize(pull.state)}</Badge>
        <Badge tone={changes.checks === "success" ? "green" : changes.checks === "failure" ? "red" : "gray"}>{checkLabel(changes.checks)}</Badge>
        <span className="text-xs text-[#6b7280]">+{pull.additions} −{pull.deletions} across {pull.changedFiles} {pull.changedFiles === 1 ? "file" : "files"}</span>
      </div>
    );
  }
  if (changes.source === "branch") return <p className="text-sm font-medium text-[#111827]">Branch <span className="font-mono">{changes.branch}</span> · not opened as a pull request yet</p>;
  const totals = fileTotals(files);
  return <p className="text-sm font-medium text-[#111827]">Draft change (not pushed) <span className="ml-2 text-xs font-normal text-[#6b7280]">+{totals.additions} −{totals.deletions}</span></p>;
}

function FileDiff({ file, initiallyOpen, pullUrl }: { file: ChangeFile; initiallyOpen: boolean; pullUrl: string | null }) {
  const [open, setOpen] = useState(initiallyOpen);
  const rows = file.patch ? parsePatch(file.patch) : [];
  const additions = file.additions ?? rows.filter((row) => row.kind === "add").length;
  const deletions = file.deletions ?? rows.filter((row) => row.kind === "del").length;
  return (
    <section className="overflow-hidden rounded border border-[#e1e4e8] bg-white">
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex w-full min-w-0 items-center gap-2 bg-[#f8f9fa] px-3 py-2 text-left text-xs">
        {open ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
        <span className="min-w-0 flex-1 truncate font-mono text-[#111827]">{file.filename}</span>
        <span className="text-[#6b7280]">{file.status}</span>
        <span className="text-[#1f9d55]">+{additions}</span>
        <span className="text-[#b42318]">−{deletions}</span>
      </button>
      {open && (file.patch ? (
        <div className="overflow-x-auto font-mono text-[12px] leading-5">
          <div className="min-w-max">
            {rows.map((row, index) => (
              <div key={`${row.kind}-${index}`} className={`flex ${row.kind === "add" ? "bg-[#eaf7ee]" : row.kind === "del" ? "bg-[#fcebea]" : row.kind === "hunk" ? "bg-[#eef4ff] text-[#596579]" : ""}`}>
                <span className="w-12 shrink-0 select-none border-r border-[#e6e8ec] px-2 text-right text-[#9aa0a8]">{row.oldLine ?? ""}</span>
                <span className="w-12 shrink-0 select-none border-r border-[#e6e8ec] px-2 text-right text-[#9aa0a8]">{row.newLine ?? ""}</span>
                <span className="whitespace-pre px-3">{row.kind === "add" ? "+" : row.kind === "del" ? "-" : row.kind === "context" ? " " : ""}{row.text}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="px-3 py-4 text-xs text-[#6b7280]">
          GitHub doesn&apos;t show this diff here. {pullUrl && <a href={pullUrl} target="_blank" rel="noreferrer" className="text-[#2563eb] hover:underline">View it on GitHub →</a>}
        </p>
      ))}
    </section>
  );
}

function Badge({ tone, children }: { tone: "green" | "red" | "purple" | "gray"; children: React.ReactNode }) {
  const colors = tone === "green" ? "border-[#b7dfc5] bg-[#eaf7ee] text-[#147a3f]" : tone === "red" ? "border-[#f2c1bd] bg-[#fcebea] text-[#b42318]" : tone === "purple" ? "border-[#d8c6ef] bg-[#f3edfb] text-[#6f42a6]" : "border-[#d9dde3] bg-[#f3f4f6] text-[#59616d]";
  return <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${colors}`}>{children}</span>;
}

function fileTotals(files: ChangeFile[]) {
  return files.reduce((totals, file) => {
    const rows = file.patch ? parsePatch(file.patch) : [];
    totals.additions += file.additions ?? rows.filter((row) => row.kind === "add").length;
    totals.deletions += file.deletions ?? rows.filter((row) => row.kind === "del").length;
    return totals;
  }, { additions: 0, deletions: 0 });
}

function capitalize(value: string) { return value[0].toUpperCase() + value.slice(1); }
function checkLabel(checks: "pending" | "success" | "failure" | "none") { return checks === "success" ? "Passing" : checks === "failure" ? "Failing" : checks === "pending" ? "Pending" : "No checks"; }
