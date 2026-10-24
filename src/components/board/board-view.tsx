"use client";

import { useState, type DragEvent, type FormEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { graphStore, useGraphStore } from "@/lib/graph/graph-store";
import { CURRENT_USER } from "@/lib/settings";
import { readPages } from "@/lib/work-context";
import { useUIStore } from "@/stores/ui-store";
import { cn } from "@/lib/utils";
import type { GraphNode, NodeStatus, Priority } from "@/types/graph";

const COLUMNS: { status: NodeStatus; label: string }[] = [
  { status: "DRAFT", label: "Backlog" },
  { status: "ACTIVE", label: "To do" },
  { status: "IN_PROGRESS", label: "In progress" },
  { status: "COMPLETED", label: "Done" },
];

const PLATFORMS = ["Web", "iOS", "Android", "Backend"];

export function BoardView() {
  const router = useRouter();
  const nodes = useGraphStore((state) => state.nodes);
  const productId = useUIStore((state) => state.activeProductId);
  const [dragging, setDragging] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);
  const work = nodes.filter((node) => node.type === "FEATURE" || node.type === "EXPERIMENT" || node.type === "ENGINEERING_TASK");

  function onDrop(status: NodeStatus) {
    if (!dragging) return;
    graphStore.getState().moveWork(dragging, status);
    setDragging(null);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-3 px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Board</h1>
          <p className="text-sm text-muted-foreground">Backlog through done. Drag a card, or press 1–4 while it is focused.</p>
        </div>
        <button
          type="button"
          onClick={() => setReporting(true)}
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-foreground px-3 text-sm text-background"
        >
          <Plus className="h-3.5 w-3.5" />
          Report a bug
        </button>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-4 gap-3 px-6 pb-6">
        {COLUMNS.map((column) => {
          const cards = work.filter((node) => columnFor(node.status) === column.status && node.status !== "ARCHIVED");
          return (
            <section
              key={column.status}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => onDrop(column.status)}
              className="flex min-h-0 flex-col rounded-xl bg-muted/50"
            >
              <header className="flex items-center justify-between px-3 py-2 text-xs text-muted-foreground">
                <span>{column.label}</span>
                <span>{cards.length}</span>
              </header>
              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
                {cards.map((node) => (
                  <Card key={node.id} node={node} onDrag={setDragging} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
      {reporting && (
        <ReportDialog
          onClose={() => setReporting(false)}
          onFiled={(id) => {
            setReporting(false);
            router.push(`/board/${id}`);
          }}
          productId={productId}
        />
      )}
    </div>
  );
}

function Card({ node, onDrag }: { node: GraphNode; onDrag: (id: string | null) => void }) {
  const href = node.type === "EXPERIMENT" ? `/experiments/${node.id}` : node.type === "FEATURE" ? `/features/${node.id}` : `/board/${node.id}`;

  function onKeyDown(event: KeyboardEvent<HTMLAnchorElement>) {
    const index = Number(event.key) - 1;
    const column = COLUMNS[index];
    if (!column) return;
    event.preventDefault();
    graphStore.getState().moveWork(node.id, column.status);
  }

  return (
    <Link
      href={href}
      draggable
      onDragStart={(event: DragEvent) => {
        event.dataTransfer.setData("text/plain", node.id);
        onDrag(node.id);
      }}
      onDragEnd={() => onDrag(null)}
      onKeyDown={onKeyDown}
      className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm hover:border-foreground/20"
    >
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{kindOf(node)}</p>
      <p className="mt-1 leading-snug">{node.title}</p>
      {node.priority && <p className={cn("mt-2 text-[10px]", priorityClass(node.priority))}>{node.priority}</p>}
    </Link>
  );
}

function ReportDialog({
  onClose,
  onFiled,
  productId,
}: {
  onClose: () => void;
  onFiled: (id: string) => void;
  productId: string;
}) {
  const [title, setTitle] = useState("");
  const [repro, setRepro] = useState("");
  const [platform, setPlatform] = useState("Web");
  const [note, setNote] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [error, setError] = useState("");

  async function draft() {
    const text = note.trim();
    if (!text || drafting) return;
    setDrafting(true);
    setError("");
    const latest = readPages()[0];
    const page = latest ? `${latest.path}\n${latest.title}\n${latest.text}` : "";
    try {
      const res = await fetch("/api/issues/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: text, page }),
      });
      const body = (await res.json()) as { title?: string; repro?: string; platform?: string; error?: string };
      if (!res.ok || !body.title) {
        setError(body.error || "Could not draft the bug.");
        return;
      }
      setTitle(body.title);
      setRepro(body.repro || text);
      if (body.platform && PLATFORMS.includes(body.platform)) setPlatform(body.platform);
    } catch {
      setError("Could not draft the bug.");
    } finally {
      setDrafting(false);
    }
  }

  function save(event: FormEvent) {
    event.preventDefault();
    const nextTitle = title.trim();
    if (!nextTitle) return;
    const latest = readPages()[0];
    const id = graphStore.getState().fileIssue({
      title: nextTitle,
      repro: repro.trim() || note.trim() || nextTitle,
      platform,
      page: latest?.path,
      ownerId: CURRENT_USER.id,
      productId,
    });
    onFiled(id);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 py-16">
      <form onSubmit={save} className="w-full max-w-lg rounded-xl border border-border bg-background p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Bug report</h2>
          <button type="button" onClick={onClose} className="text-sm text-muted-foreground">
            Close
          </button>
        </div>
        <label className="mt-4 block text-xs text-muted-foreground">
          Title
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground outline-none"
          />
        </label>
        <label className="mt-3 block text-xs text-muted-foreground">
          Platform
          <select
            value={platform}
            onChange={(event) => setPlatform(event.target.value)}
            className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground"
          >
            {PLATFORMS.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="mt-3 block text-xs text-muted-foreground">
          Repro steps
          <textarea
            value={repro}
            onChange={(event) => setRepro(event.target.value)}
            rows={5}
            className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm text-foreground outline-none"
          />
        </label>
        <div className="mt-4 border-t border-border pt-4">
          <p className="text-xs text-muted-foreground">Or describe it. Kismet drafts the report from that note and the page you were just on.</p>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            placeholder="The pickup screen spins and never finishes"
            className="mt-2 w-full rounded-md border border-border bg-background px-2 py-2 text-sm text-foreground outline-none"
          />
          <button type="button" onClick={() => void draft()} disabled={drafting || !note.trim()} className="mt-2 text-sm text-brand disabled:opacity-40">
            {drafting ? "Drafting…" : "Draft from this"}
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
        <button type="submit" disabled={!title.trim()} className="mt-4 h-8 rounded-md bg-foreground px-3 text-sm text-background disabled:opacity-40">
          File on the board
        </button>
      </form>
    </div>
  );
}

function columnFor(status: NodeStatus): NodeStatus {
  if (status === "IN_PROGRESS" || status === "AT_RISK") return "IN_PROGRESS";
  if (status === "COMPLETED") return "COMPLETED";
  if (status === "ACTIVE") return "ACTIVE";
  return "DRAFT";
}

function kindOf(node: GraphNode): string {
  if (node.metadata.kind === "bug" || node.type === "ENGINEERING_TASK") return "Bug";
  if (node.type === "EXPERIMENT") return "Experiment";
  return "Feature";
}

function priorityClass(priority: Priority): string {
  if (priority === "CRITICAL" || priority === "HIGH") return "text-destructive";
  return "text-muted-foreground";
}
