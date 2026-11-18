"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BUILDERS, BUILDER_NAME, type Builder } from "@/lib/autopilot/builders";
import type { WorkflowState } from "@/lib/github/client";

interface BuilderStatus {
  builder: Builder;
  repo: string | null;
  cursorConnected: boolean;
  workflow: WorkflowState | null;
  workflowPath: string;
  workflowYaml: string;
}

const DESCRIPTION: Record<Builder, string> = {
  kismet: "Runs on Kismet. Nothing else to set up.",
  cursor: "A Cursor cloud agent, on your Cursor account.",
  "claude-code": "Claude Code in GitHub Actions, on your repository.",
};

const WORKFLOW_TEXT: Record<WorkflowState, string> = {
  ready: "The workflow is in place. Kismet starts Claude Code there for each experiment.",
  missing: "Kismet has not found the workflow on the default branch yet.",
  disabled: "The workflow is there but turned off. Turn it on under the repository's Actions tab.",
  forbidden: "The GitHub token cannot read Actions. Give it Actions read and write access, then check again.",
};

/** Chooses which coding agent writes experiment changes, and shows what that agent still needs. */
export function CodingAgentSection({ repo }: { repo: string }) {
  const [status, setStatus] = useState<BuilderStatus | null>(null);
  const [hint, setHint] = useState("");
  const [key, setKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/autopilot/builder", { cache: "no-store" })
      .then(async (res) => {
        const body = (await res.json()) as BuilderStatus & { error?: string };
        if (cancelled) return;
        if (!res.ok) setHint(body.error ?? "Could not load the coding agent setting.");
        else setStatus(body);
      })
      .catch(() => {
        if (!cancelled) setHint("Could not load the coding agent setting.");
      });
    return () => {
      cancelled = true;
    };
  }, [refresh, repo]);

  async function post(path: string, body?: unknown): Promise<boolean> {
    setSaving(true);
    setHint("");
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const result = (await res.json()) as { error?: string };
      if (!res.ok) {
        setHint(result.error ?? "Could not save.");
        return false;
      }
      setRefresh((value) => value + 1);
      return true;
    } catch {
      setHint("Could not save.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function choose(builder: Builder) {
    if (!status || builder === status.builder) return;
    const previous = status;
    setStatus({ ...status, builder, workflow: null });
    if (!(await post("/api/autopilot/builder", { builder }))) setStatus(previous);
  }

  async function saveKey() {
    if (await post("/api/cursor/connect", { key })) setKey("");
  }

  async function copy() {
    if (!status) return;
    await navigator.clipboard.writeText(status.workflowYaml);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  if (!status) {
    return hint ? <p className="mt-6 text-xs text-destructive">{hint}</p> : null;
  }

  return (
    <section className="mt-6 max-w-lg space-y-3">
      <div>
        <h2 className="text-sm font-medium">Who writes the code</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Kismet designs each experiment and opens its pull request. Choose the coding agent that writes the change.
        </p>
      </div>
      <div className="divide-y divide-border rounded-xl border border-border">
        {BUILDERS.map((builder) => (
          <label key={builder} className="flex cursor-pointer items-start gap-3 px-3 py-2 text-sm">
            <input
              type="radio"
              name="coding-agent"
              className="mt-1"
              checked={status.builder === builder}
              disabled={saving}
              onChange={() => void choose(builder)}
            />
            <span>
              {BUILDER_NAME[builder]}
              <span className="block text-xs text-muted-foreground">{DESCRIPTION[builder]}</span>
            </span>
          </label>
        ))}
      </div>
      {hint && <p className="text-xs text-destructive">{hint}</p>}

      {status.builder === "cursor" &&
        (status.cursorConnected ? (
          <div className="flex items-center gap-3">
            <p className="text-sm">Cursor API key saved.</p>
            <Button
              className="ml-auto"
              variant="outline"
              size="sm"
              disabled={saving}
              onClick={() => void post("/api/cursor/disconnect")}
            >
              Remove key
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="cursor-key">Cursor API key</Label>
              <Input id="cursor-key" type="password" value={key} onChange={(event) => setKey(event.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground">
              Create a key in the{" "}
              <a
                className="text-[#0571d3] hover:underline"
                href="https://cursor.com/dashboard/integrations"
                target="_blank"
                rel="noreferrer"
              >
                Cursor dashboard
              </a>
              . Cursor also needs access to this repository on GitHub.
            </p>
            <Button size="sm" disabled={saving || !key.trim()} onClick={() => void saveKey()}>
              {saving ? "Saving…" : "Save key"}
            </Button>
          </div>
        ))}

      {status.builder === "claude-code" && (
        <div className="space-y-3">
          <p className="text-sm">
            {!status.repo
              ? "Choose a repository above first."
              : status.workflow
                ? WORKFLOW_TEXT[status.workflow]
                : "Kismet could not check the workflow."}
          </p>
          {status.workflow !== "ready" && (
            <>
              <ol className="list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
                <li>
                  Add this file to {status.repo ?? "the repository"} at {status.workflowPath}, on the default branch.
                </li>
                <li>Add the repository secret ANTHROPIC_API_KEY under Settings → Secrets and variables → Actions.</li>
                <li>Give the GitHub token Kismet uses Actions read and write access.</li>
              </ol>
              <pre className="max-h-64 overflow-auto rounded-md border border-border bg-muted/50 p-3 text-xs">
                <code>{status.workflowYaml}</code>
              </pre>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => void copy()}>
                  {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy file"}
                </Button>
                <Button size="sm" variant="outline" disabled={saving} onClick={() => setRefresh((value) => value + 1)}>
                  Check again
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
