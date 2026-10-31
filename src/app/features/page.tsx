"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Circle, CircleDot, Plus } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { SendToJira } from "@/components/features/send-to-jira";
import { PersonAvatar } from "@/components/shared/person-avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { saveFeatureDraft, type FeatureDraft } from "@/lib/features/save-draft";
import { graphStore } from "@/lib/graph/graph-store";
import { CURRENT_USER } from "@/lib/settings";
import { useGraphStore } from "@/lib/graph/graph-store";
import { useUIStore } from "@/stores/ui-store";
import type { GraphNode, NodeStatus, Priority } from "@/types/graph";

const PRIORITIES = new Set<Priority>(["CRITICAL", "HIGH", "MEDIUM", "LOW"]);

export default function FeaturesPage() {
  const router = useRouter();
  const nodes = useGraphStore((s) => s.nodes);
  const productId = useUIStore((s) => s.activeProductId);
  const features = nodes.filter((node) => node.type === "FEATURE");
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState<FeatureDraft[]>([]);
  const [suggesting, setSuggesting] = useState(true);
  const [suggestError, setSuggestError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setSuggesting(true);
      try {
        const res = await fetch("/api/features/recommendations");
        const body = (await res.json()) as { recommendations?: FeatureDraft[]; error?: string };
        if (cancelled) return;
        setSuggestions((body.recommendations ?? []).map(normalizeDraft));
        setSuggestError(res.ok ? "" : body.error || "Suggestions could not be loaded.");
      } catch {
        if (!cancelled) setSuggestError("Suggestions could not be loaded.");
      } finally {
        if (!cancelled) setSuggesting(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function create() {
    const text = prompt.trim();
    if (!text || creating) return;
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/features/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text }),
      });
      const body = (await res.json()) as FeatureDraft & { error?: string };
      if (!res.ok || !body.title) {
        setError(body.error || "Could not write the feature.");
        return;
      }
      const featureId = saveFeatureDraft(normalizeDraft(body), productId);
      setOpen(false);
      setPrompt("");
      router.push(`/features/${featureId}`);
    } catch {
      setError("Could not write the feature.");
    } finally {
      setCreating(false);
    }
  }

  function addSuggestion(draft: FeatureDraft) {
    const featureId = saveFeatureDraft(draft, productId);
    setSuggestions((current) => current.filter((item) => item.title !== draft.title));
    router.push(`/features/${featureId}`);
  }

  const todo = features.filter((feature) => columnFor(feature.status) === "todo");
  const progress = features.filter((feature) => columnFor(feature.status) === "progress");
  const done = features.filter((feature) => columnFor(feature.status) === "done");

  return (
    <AppShell>
      <div className="flex h-full flex-col bg-muted">
        <div className="flex items-center px-5 py-3">
          <h1 className="text-sm font-medium">Features</h1>
        </div>
        <div className="flex min-h-0 flex-1 gap-5 overflow-x-auto px-4 pb-4">
          <Column label="Suggested" count={suggestions.length} mark="suggested">
            {suggesting && <p className="px-1 text-[11px] text-muted-foreground">Reading Slack, Jira, and Databricks…</p>}
            {suggestError && <p className="px-1 text-[11px] text-muted-foreground">{suggestError}</p>}
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.title}
                type="button"
                onClick={() => addSuggestion(suggestion)}
                className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-left hover:border-foreground/20"
              >
                <span className="flex items-center justify-between text-[11px] text-muted-foreground">
                  Suggestion
                  <Plus className="h-3 w-3" />
                </span>
                <p className="mt-1 line-clamp-3 text-[13px] font-medium leading-snug">{suggestion.title}</p>
              </button>
            ))}
          </Column>
          <Column label="To do" count={todo.length} mark="todo" onAdd={() => setOpen(true)}>
            {todo.map((feature) => (
              <FeatureCard key={feature.id} feature={feature} />
            ))}
          </Column>
          <Column label="In progress" count={progress.length} mark="progress">
            {progress.map((feature) => (
              <FeatureCard key={feature.id} feature={feature} />
            ))}
          </Column>
          <Column label="Done" count={done.length} mark="done">
            {done.map((feature) => (
              <FeatureCard key={feature.id} feature={feature} />
            ))}
          </Column>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <h2 className="text-sm font-semibold">New feature</h2>
          <p className="text-xs text-muted-foreground">Write it the way you would say it. Kismet turns it into a feature, a problem, a PRD, a goal, and a metric.</p>
          <Textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="PMs should be able to see which sample tables are actually used before a review."
            rows={5}
          />
          {error && <p className="text-xs text-muted-foreground">{error}</p>}
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => {
                const result = graphStore.getState().proposeFeature({
                  title: "Untitled PRD",
                  description: "",
                  prdText: "",
                  ownerId: CURRENT_USER.id,
                  priority: "MEDIUM",
                  primaryRepo: "",
                  primaryRepoUrl: "",
                  additionalRepos: [],
                  scaffold: { customerProblem: false, prd: true, goal: false, metric: false },
                  productId,
                });
                router.push(`/features/${result.featureId}`);
              }}
            >
              Start a blank PRD
            </button>
            <Button size="sm" onClick={create} disabled={creating || !prompt.trim()}>
              {creating ? "Writing…" : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function columnFor(status: NodeStatus): "todo" | "progress" | "done" {
  if (status === "COMPLETED" || status === "ARCHIVED") return "done";
  if (status === "IN_PROGRESS" || status === "AT_RISK" || status === "ACTIVE") return "progress";
  return "todo";
}

function Column({
  label,
  count,
  mark,
  onAdd,
  children,
}: {
  label: string;
  count: number;
  mark: "suggested" | "todo" | "progress" | "done";
  onAdd?: () => void;
  children: ReactNode;
}) {
  return (
    <section className="flex w-72 shrink-0 flex-col">
      <header className="mb-2 flex items-center gap-2 px-1">
        <ColumnMark mark={mark} />
        <h2 className="text-[13px] font-medium" suppressHydrationWarning>
          {label}
        </h2>
        <span className="text-xs text-muted-foreground" suppressHydrationWarning>
          {count}
        </span>
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            aria-label={`Add to ${label}`}
            className="ml-auto rounded p-1 text-muted-foreground hover:bg-card hover:text-foreground"
            suppressHydrationWarning
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">{children}</div>
    </section>
  );
}

function ColumnMark({ mark }: { mark: "suggested" | "todo" | "progress" | "done" }) {
  if (mark === "progress") return <CircleDot className="h-3.5 w-3.5 text-[#e8a317]" />;
  if (mark === "done") return <Check className="h-3.5 w-3.5 text-[#3d9a50]" />;
  return <Circle className="h-3.5 w-3.5 text-muted-foreground" />;
}

function FeatureCard({ feature }: { feature: GraphNode }) {
  const jiraKey = typeof feature.metadata.jiraKey === "string" ? feature.metadata.jiraKey : "";
  const jiraUrl = typeof feature.metadata.jiraUrl === "string" ? feature.metadata.jiraUrl : "";
  const priority = PRIORITIES.has(feature.priority as Priority) ? (feature.priority as Priority) : undefined;
  return (
    <article className="rounded-lg border border-border bg-card px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        {jiraUrl ? (
          <a href={jiraUrl} target="_blank" rel="noreferrer" className="truncate text-[11px] text-muted-foreground hover:text-[#3d9a50]">
            {cardId(feature.id, jiraKey)}
          </a>
        ) : (
          <span className="truncate text-[11px] text-muted-foreground">{cardId(feature.id, jiraKey)}</span>
        )}
        {feature.ownerId && <PersonAvatar personId={feature.ownerId} />}
      </div>
      <Link href={`/features/${feature.id}`} className="mt-1 block line-clamp-3 text-[13px] font-medium leading-snug hover:underline">
        {feature.title}
      </Link>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <Signal priority={priority} />
        {priority && <Pill dot={PRIORITY_DOT[priority]}>{priorityLabel(priority)}</Pill>}
        {feature.status === "AT_RISK" && <Pill dot="#e5484d">Risk</Pill>}
        {feature.tags
          .filter((tag) => tag !== "proposed")
          .slice(0, 2)
          .map((tag) => (
            <Pill key={tag} dot="#8d939c">
              {tag}
            </Pill>
          ))}
        {!jiraKey && (
          <SendToJira
            compact
            featureId={feature.id}
            title={feature.title}
            description={[feature.description, feature.summary].filter(Boolean).join("\n\n")}
          />
        )}
      </div>
    </article>
  );
}

function Pill({ dot, children }: { dot: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border px-1.5 py-0.5 text-[10px] text-foreground">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: dot }} />
      {children}
    </span>
  );
}

function Signal({ priority }: { priority?: Priority }) {
  const level = priority === "CRITICAL" || priority === "HIGH" ? 3 : priority === "MEDIUM" ? 2 : 1;
  const color = priority === "CRITICAL" ? "#e5484d" : priority === "HIGH" ? "#f76808" : "#8d939c";
  return (
    <span className="inline-flex items-end gap-px" aria-hidden>
      {[1, 2, 3].map((bar) => (
        <span
          key={bar}
          className="w-[3px] rounded-[1px]"
          style={{ height: 3 + bar * 3, background: bar <= level ? color : "#e6e8ec" }}
        />
      ))}
    </span>
  );
}

const PRIORITY_DOT: Record<Priority, string> = {
  CRITICAL: "#e5484d",
  HIGH: "#f76808",
  MEDIUM: "#e8a317",
  LOW: "#8d939c",
};

function priorityLabel(priority: Priority): string {
  if (priority === "CRITICAL") return "Critical";
  if (priority === "HIGH") return "High";
  if (priority === "MEDIUM") return "Medium";
  return "Low";
}

function cardId(id: string, jiraKey: string): string {
  if (jiraKey) return jiraKey;
  const tail = id.split("-").pop() ?? id;
  return `FEA-${tail.slice(-4).toUpperCase()}`;
}

function normalizeDraft(draft: Partial<FeatureDraft>): FeatureDraft {
  return {
    title: draft.title?.trim() || "Untitled feature",
    description: draft.description?.trim() || "",
    problem: draft.problem?.trim() || "",
    priority: PRIORITIES.has(draft.priority as Priority) ? (draft.priority as Priority) : "MEDIUM",
    prd: draft.prd?.trim() || "",
    goal: draft.goal?.trim() || "",
    metric: draft.metric?.trim() || "",
    why: draft.why?.trim() || "",
  };
}
