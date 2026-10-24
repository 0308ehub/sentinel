"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExperimentLab } from "@/components/experiments/experiment-lab";
import { ShipPullRequest } from "@/components/experiments/ship-pull-request";
import { READOUT_LABEL, type ReadoutState } from "@/lib/experiments/allocation";
import { SendToJira } from "@/components/features/send-to-jira";
import { PersonAvatar } from "@/components/shared/person-avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { graphStore, useGraphStore } from "@/lib/graph/graph-store";
import { formatRelativeTime } from "@/lib/utils";
import type { GraphNode, NodeStatus, Priority } from "@/types/graph";

const PRIORITY_LABEL: Record<Priority, string> = {
  CRITICAL: "Critical",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

export function WorkDetail({
  nodeId,
  backHref,
  backLabel,
}: {
  nodeId: string;
  backHref: string;
  backLabel: string;
}) {
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const timeline = useGraphStore((s) => s.timeline);
  const products = useGraphStore((s) => s.explorerTree.products);
  const [ready, setReady] = useState(false);
  const [title, setTitle] = useState("");
  const [lede, setLede] = useState("");
  const [body, setBody] = useState("");
  useEffect(() => setReady(true), []);
  const node = nodes.find((item) => item.id === nodeId);

  const connected = edges
    .filter((edge) => node && (edge.sourceId === node.id || edge.targetId === node.id))
    .map((edge) => {
      const otherId = edge.sourceId === node?.id ? edge.targetId : edge.sourceId;
      return nodes.find((item) => item.id === otherId);
    })
    .filter((item): item is GraphNode => Boolean(item && item.type !== "PRODUCT"));

  useEffect(() => {
    if (!node) return;
    const prd = connected.find((item) => item.type === "PRD");
    const repro = text(node.metadata.repro);
    const description = node.description ?? "";
    const long = repro || prd?.description || "";
    setTitle(node.title);
    setLede(!repro && description && description !== long ? description : "");
    setBody(long || description);
    // Reload the draft only when opening a different item.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node?.id]);

  if (!ready) return <div className="h-full bg-background" />;

  if (!node) {
    return (
      <EmptyState
        title="Nothing here yet"
        description="This item is not on the graph in this browser."
        action={{ label: backLabel, onClick: () => (window.location.href = backHref) }}
      />
    );
  }

  const prd = connected.find((item) => item.type === "PRD");
  const bug = node.metadata.kind === "bug" || node.type === "ENGINEERING_TASK";
  const kind = node.type === "EXPERIMENT" ? "Experiment" : bug ? "Bug" : node.status === "DRAFT" && !text(node.metadata.jiraKey) ? "Idea" : "Feature";
  const statusText = bug && node.status === "DRAFT" ? "Backlog" : statusLabel(node.status);
  const identifier = text(node.metadata.jiraKey) || shortId(node);
  const productName = products.find((item) => item.id === node.productId)?.name;
  const resources = resourceRows(node, connected);
  const labels = [kind, ...node.tags.filter((tag) => tag !== "proposed" && tag !== "experiment" && tag !== "bug")];
  const activity = timeline
    .filter((event) => event.nodeId === node.id)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  function saveTitle() {
    const next = title.trim();
    if (next && next !== node?.title) graphStore.getState().updateWorkDoc(nodeId, { title: next });
  }

  function saveLede() {
    if (!node || lede === (node.description ?? "")) return;
    graphStore.getState().updateWorkDoc(nodeId, { body: lede });
  }

  function saveBody() {
    if (!node) return;
    const target = !bug && prd ? prd.id : nodeId;
    const current = bug ? text(node.metadata.repro) || node.description || "" : prd?.description || node.description || "";
    if (body !== current) graphStore.getState().updateWorkDoc(target, { body });
  }

  return (
    <div className="h-full overflow-y-auto bg-background">
      <article className={`mx-auto px-8 py-10 ${node.type === "EXPERIMENT" ? "max-w-5xl" : "max-w-3xl"}`}>
        <p className="text-xs text-muted-foreground">
          <Link href={backHref} className="hover:text-foreground">
            {backLabel}
          </Link>
          <span className="px-1.5">/</span>
          <span>{identifier}</span>
        </p>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={saveTitle}
          aria-label="Title"
          className="mt-6 w-full bg-transparent text-3xl font-semibold tracking-tight outline-none"
        />
        <textarea
          value={lede}
          onChange={(event) => setLede(event.target.value)}
          onBlur={saveLede}
          rows={2}
          placeholder="What this is"
          aria-label="Summary"
          className="mt-3 w-full resize-none bg-transparent text-base leading-relaxed text-muted-foreground outline-none"
        />

        <div className="mt-8 space-y-3 text-sm">
          <Row label="Properties">
            <Chip>
              <Dot status={node.status} />
              {statusText}
            </Chip>
            <Chip>{node.priority ? PRIORITY_LABEL[node.priority] : "No priority"}</Chip>
            {node.ownerId ? <PersonAvatar personId={node.ownerId} showName /> : <Chip>No owner</Chip>}
            <Chip>{filedOn(node.createdAt)}</Chip>
            <Chip>{identifier}</Chip>
            {text(node.metadata.platform) && <Chip>{text(node.metadata.platform)}</Chip>}
            {node.type === "EXPERIMENT" && isReadout(node.metadata.readoutState) && <Chip>{READOUT_LABEL[node.metadata.readoutState]}</Chip>}
          </Row>
          {productName && (
            <Row label="Product">
              <Chip>{productName}</Chip>
            </Row>
          )}
          <Row label="Labels">
            {labels.map((label) => (
              <Chip key={label}>{label}</Chip>
            ))}
          </Row>
          <Row label="Resources">
            {resources.map((item) =>
              item.href ? (
                <a key={item.label} href={item.href} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                  {item.label}
                </a>
              ) : (
                <span key={item.label}>{item.label}</span>
              ),
            )}
            {text(node.metadata.jiraKey) && text(node.metadata.jiraUrl) ? (
              <a href={text(node.metadata.jiraUrl)} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                {text(node.metadata.jiraKey)}
              </a>
            ) : (
              node.type === "FEATURE" && (
                <SendToJira featureId={node.id} title={node.title} description={node.description ?? node.title} />
              )
            )}
            {node.type === "EXPERIMENT" && <ShipPullRequest node={node} />}
            <Link href={`/graph?node=${node.id}`} className="text-muted-foreground hover:text-foreground">
              Graph
            </Link>
          </Row>
        </div>

        {node.type === "EXPERIMENT" && <ExperimentLab node={node} />}

        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onBlur={saveBody}
          aria-label="Document"
          placeholder="Write the notes, requirements, or repro steps."
          className="mt-10 min-h-64 w-full resize-none bg-transparent text-sm leading-7 outline-none"
        />

        {node.type === "EXPERIMENT" && <ExperimentNotes node={node} />}

        <section className="mt-12 border-t border-border pt-6">
          <h2 className="text-xs text-muted-foreground">Activity</h2>
          <div className="mt-3 space-y-3">
            {activity.length === 0 ? (
              <p className="text-sm text-muted-foreground">Filed {formatRelativeTime(node.createdAt)}</p>
            ) : (
              activity.map((event) => (
                <p key={event.id} className="text-sm">
                  {event.title}
                  {event.description ? <span className="text-muted-foreground"> · {event.description}</span> : null}
                  <span className="text-muted-foreground"> · {formatRelativeTime(event.timestamp)}</span>
                </p>
              ))
            )}
          </div>
        </section>
      </article>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[96px_1fr] items-center gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-xs">{children}</span>;
}

function Dot({ status }: { status: NodeStatus }) {
  const color = status === "COMPLETED" ? "bg-emerald-500" : status === "IN_PROGRESS" || status === "AT_RISK" ? "bg-amber-500" : "bg-muted-foreground";
  return <span className={`h-1.5 w-1.5 rounded-full ${color}`} />;
}

function ExperimentNotes({ node }: { node: GraphNode }) {
  const rows = [
    ["Metric", text(node.metadata.metric)],
    ["Control", text(node.metadata.control)],
    ["Treatment", text(node.metadata.treatment)],
    ["Guardrail", text(node.metadata.guardrail)],
  ].filter(([, value]) => value);
  if (rows.length === 0) return null;
  return (
    <dl className="mt-8 grid gap-3 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt className="text-[11px] text-muted-foreground">{label}</dt>
          <dd className="mt-0.5 text-sm">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function resourceRows(node: GraphNode, connected: GraphNode[]) {
  const rows: { label: string; href?: string }[] = [];
  const why = text(node.metadata.why);
  if (why) rows.push({ label: clip(why, 80) });
  for (const item of connected) {
    if (item.type === "PRD") rows.push({ label: "PRD" });
    if (item.type === "GOAL") rows.push({ label: "Goal" });
    if (item.type === "METRIC") rows.push({ label: "Metric" });
    if (item.type === "CUSTOMER_PROBLEM") rows.push({ label: "Problem" });
    if (item.type === "SLACK_THREAD") rows.push({ label: "Slack" });
  }
  return rows;
}

function statusLabel(status: NodeStatus): string {
  if (status === "IN_PROGRESS") return "In progress";
  if (status === "AT_RISK") return "At risk";
  if (status === "COMPLETED") return "Done";
  if (status === "ACTIVE") return "Active";
  if (status === "ARCHIVED") return "Archived";
  if (status === "STALE") return "Stale";
  if (status === "DRAFT") return "Draft";
  return "To do";
}

function shortId(node: GraphNode): string {
  const tail = node.id.split("-").pop() ?? node.id;
  const prefix = node.type === "EXPERIMENT" ? "EXP" : node.metadata.kind === "bug" ? "BUG" : "FEA";
  return `${prefix}-${tail.slice(-4).toUpperCase()}`;
}

function isReadout(value: unknown): value is ReadoutState {
  return value === "hold" || value === "collecting" || value === "significant" || value === "no_difference" || value === "mismatch";
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function clip(value: string, max = 180): string {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function filedOn(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const month = date.toLocaleString("en", { month: "short" });
  return `${month} ${date.getDate()}, '${String(date.getFullYear()).slice(-2)}`;
}
