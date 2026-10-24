"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { graphStore, useGraphStore } from "@/lib/graph/graph-store";
import { CURRENT_USER } from "@/lib/settings";
import { useUIStore } from "@/stores/ui-store";

interface ExperimentDraft {
  title: string;
  hypothesis: string;
  metric: string;
  control: string;
  treatment: string;
  guardrail: string;
}

export default function ExperimentsPage() {
  const nodes = useGraphStore((s) => s.nodes);
  const productId = useUIStore((s) => s.activeProductId);
  const experiments = nodes.filter((node) => node.type === "EXPERIMENT");
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function create() {
    const text = prompt.trim();
    if (!text || creating) return;
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/experiments/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text }),
      });
      const body = (await res.json()) as ExperimentDraft & { error?: string };
      if (!res.ok || !body.title) {
        setError(body.error || "Could not draft the experiment.");
        return;
      }
      graphStore.getState().saveExperiment({
        title: body.title,
        hypothesis: body.hypothesis,
        metric: body.metric,
        control: body.control,
        treatment: body.treatment,
        guardrail: body.guardrail,
        ownerId: CURRENT_USER.id,
        productId,
      });
      setOpen(false);
      setPrompt("");
    } catch {
      setError("Could not draft the experiment.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <AppShell>
      <div className="h-full overflow-y-auto p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Experiments</h1>
            <p className="text-xs text-muted-foreground">
              Describe a change. Kismet writes the hypothesis, the metric, and the two variants. Ship puts it on the active Jira sprint.
            </p>
          </div>
          <Button size="sm" onClick={() => setOpen(true)} aria-label="Create experiment">
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-6 max-w-2xl">
          {experiments.length === 0 ? (
            <EmptyState
              title="No experiments yet"
              description="Write the change you want to try. Kismet drafts the experiment and files it on the graph."
              action={{ label: "Create experiment", onClick: () => setOpen(true) }}
            />
          ) : (
            <div className="space-y-2">
              {experiments.map((experiment) => (
                <ExperimentCard key={experiment.id} id={experiment.id} />
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <h2 className="text-sm font-semibold">New experiment</h2>
          <p className="text-xs text-muted-foreground">
            Say the change and who it is for. Kismet fills in the hypothesis, primary metric, control, treatment, and guardrail.
          </p>
          <Textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Show repeat buyers their last order on the menu and see if they order again sooner."
            rows={5}
          />
          {error && <p className="text-xs text-muted-foreground">{error}</p>}
          <div className="flex justify-end">
            <Button size="sm" onClick={create} disabled={creating || !prompt.trim()}>
              {creating ? "Writing…" : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function ExperimentCard({ id }: { id: string }) {
  const nodes = useGraphStore((s) => s.nodes);
  const experiment = nodes.find((node) => node.id === id);
  const [pending, setPending] = useState(false);
  const [note, setNote] = useState("");
  if (!experiment) return null;
  const metric = text(experiment.metadata.metric);
  const control = text(experiment.metadata.control);
  const treatment = text(experiment.metadata.treatment);
  const guardrail = text(experiment.metadata.guardrail);
  const jiraKey = text(experiment.metadata.jiraKey);
  const jiraUrl = text(experiment.metadata.jiraUrl);
  const sprint = text(experiment.metadata.jiraSprint);

  async function ship() {
    if (!experiment || pending) return;
    setPending(true);
    setNote("");
    try {
      const res = await fetch("/api/jira/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: experiment.title,
          description: [
            experiment.description,
            metric && `Primary metric: ${metric}`,
            control && `Control: ${control}`,
            treatment && `Treatment: ${treatment}`,
            guardrail && `Guardrail: ${guardrail}`,
          ]
            .filter(Boolean)
            .join("\n\n"),
        }),
      });
      const body = (await res.json()) as { key?: string; url?: string; sprint?: string; hint?: string; error?: string };
      if (!res.ok || !body.key || !body.url) {
        setNote(body.hint || body.error || "Jira did not create the issue.");
        return;
      }
      graphStore.getState().shipExperiment(experiment.id, { key: body.key, url: body.url, sprint: body.sprint });
      setNote(body.sprint ? `${body.key} is on ${body.sprint}.` : `${body.key} is in the backlog.`);
    } catch {
      setNote("Jira could not be reached.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-md border border-border px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link href={`/experiments/${experiment.id}`} className="text-sm font-medium hover:underline">
            {experiment.title}
          </Link>
          {experiment.description && <p className="mt-1 text-xs text-muted-foreground">{experiment.description}</p>}
          {text(experiment.metadata.readoutSummary) && (
            <p className="mt-1 text-xs text-muted-foreground">{text(experiment.metadata.readoutSummary)}</p>
          )}
        </div>
        <StatusBadge status={experiment.status} />
      </div>
      <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
        <Field label="Metric" value={metric} />
        <Field label="Guardrail" value={guardrail} />
        <Field label="Control" value={control} />
        <Field label="Treatment" value={treatment} />
      </dl>
      <div className="mt-3 flex items-center gap-2">
        {jiraKey && jiraUrl ? (
          <a href={jiraUrl} className="text-xs text-brand" target="_blank" rel="noreferrer">
            {jiraKey}
            {sprint ? ` · ${sprint}` : ""}
          </a>
        ) : (
          <Button variant="outline" size="sm" onClick={ship} disabled={pending}>
            {pending ? "Sending…" : "Ship to Jira"}
          </Button>
        )}
        {note && <span className="text-[11px] text-muted-foreground">{note}</span>}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}
