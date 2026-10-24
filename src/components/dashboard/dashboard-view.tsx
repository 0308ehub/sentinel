"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { useGraphHydrated, useGraphStore } from "@/lib/graph/graph-store";
import { getPerson } from "@/lib/data/seed";
import { CURRENT_USER } from "@/lib/settings";
import { RelativeTime } from "@/components/shared/relative-time";
import { useAnalyticsLibrary } from "@/stores/analytics-store";
import { useNotificationStore } from "@/stores/notification-store";
import { useQueryEditorStore } from "@/stores/query-editor-store";
import type { GraphNode, NodeStatus, NodeType, Priority } from "@/types/graph";

const OPEN: NodeStatus[] = ["DRAFT", "ACTIVE", "IN_PROGRESS", "AT_RISK", "STALE"];
const RUNNING: NodeStatus[] = ["ACTIVE", "IN_PROGRESS", "AT_RISK"];

export function DashboardView() {
  const graphReady = useGraphHydrated();
  const libraryReady = usePersistReady(useAnalyticsLibrary);
  const notesReady = usePersistReady(useNotificationStore);
  const notebooksReady = usePersistReady(useQueryEditorStore);
  const nodes = useGraphStore((state) => state.nodes);
  const activities = useGraphStore((state) => state.activities);
  const dashboards = useAnalyticsLibrary((state) => state.dashboards);
  const metrics = useAnalyticsLibrary((state) => state.metrics);
  const setActiveDashboard = useAnalyticsLibrary((state) => state.setActiveDashboard);
  const notifications = useNotificationStore((state) => state.items);
  const markAsRead = useNotificationStore((state) => state.markAsRead);
  const notebooks = useQueryEditorStore((state) => state.savedNotebooks);

  const tickets = nodes
    .filter((node) => isTicket(node) && node.ownerId === CURRENT_USER.id && OPEN.includes(node.status))
    .sort(byUpdated);
  const experiments = nodes
    .filter((node) => node.type === "EXPERIMENT" && OPEN.includes(node.status))
    .sort(byUpdated);
  const running = experiments.filter((node) => RUNNING.includes(node.status)).length;
  const unread = notifications.filter((item) => !item.read);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl px-8 py-8">
        <h1 className="text-2xl font-medium">Dashboard</h1>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          Tickets on you, experiments that are running, and the analytics saved in this workspace.
        </p>

        <div className="mt-8 grid items-start gap-x-12 gap-y-10 md:grid-cols-[minmax(0,1.45fr)_minmax(240px,0.75fr)]">
          <div className="space-y-10">
            <Section
              title="Assigned to you"
              meta={graphReady ? `${tickets.length} open` : ""}
              href="/board"
              hrefLabel="Board"
            >
              {!graphReady ? null : tickets.length === 0 ? (
                <Empty>Nothing is assigned to you.</Empty>
              ) : (
                tickets.map((node) => (
                  <Row
                    key={node.id}
                    href={workHref(node)}
                    title={node.title}
                    detail={[kindOf(node), columnLabel(node.status), node.priority ? priorityLabel(node.priority) : ""]
                      .filter(Boolean)
                      .join(" · ")}
                    aside={<RelativeTime date={node.updatedAt} />}
                  />
                ))
              )}
            </Section>

            <Section
              title="Experiments"
              meta={graphReady ? `${running} running` : ""}
              href="/experiments"
              hrefLabel="All experiments"
            >
              {!graphReady ? null : experiments.length === 0 ? (
                <Empty>No open experiments.</Empty>
              ) : (
                experiments.map((node) => (
                  <Row
                    key={node.id}
                    href={`/experiments/${node.id}`}
                    title={node.title}
                    detail={[columnLabel(node.status), text(node.metadata.metric)].filter(Boolean).join(" · ")}
                    aside={<RelativeTime date={node.updatedAt} />}
                  />
                ))
              )}
            </Section>

            <Section title="Team activity" meta={graphReady ? `${activities.length}` : ""}>
              {!graphReady ? null : activities.length === 0 ? (
                <Empty>No activity yet. It shows up when someone files work or drafts an experiment.</Empty>
              ) : (
                activities.slice(0, 8).map((item) => {
                  const person = getPerson(item.actorId);
                  const href = item.nodeId ? hrefForType(item.nodeId, item.nodeType) : undefined;
                  return (
                    <Row
                      key={item.id}
                      href={href}
                      title={item.title}
                      detail={[person?.name, item.description ? clip(item.description) : ""].filter(Boolean).join(" · ")}
                      aside={<RelativeTime date={item.timestamp} />}
                    />
                  );
                })
              )}
            </Section>
          </div>

          <div className="space-y-10">
            <Section title="Analytics library" href="/analytics" hrefLabel="Open">
              {!libraryReady || !notebooksReady ? null : (
                <>
                  <p className="px-1 pt-3 text-xs text-muted-foreground">
                    Boards you saved, and boards opened from a shared link.
                  </p>
                  {dashboards.length === 0 && metrics.length === 0 && notebooks.length === 0 ? (
                    <Empty>The library is empty.</Empty>
                  ) : (
                    <>
                      {dashboards.map((board) => (
                        <Row
                          key={board.id}
                          href="/analytics"
                          onClick={() => setActiveDashboard(board.id)}
                          title={board.name}
                          detail={`Board · ${board.cards.length} ${board.cards.length === 1 ? "chart" : "charts"}${board.shareToken ? " · shared link" : ""}`}
                        />
                      ))}
                      {metrics.map((metric) => (
                        <Row
                          key={metric.id}
                          href="/analytics?tab=definitions"
                          title={metric.name}
                          detail="Metric"
                        />
                      ))}
                      {notebooks.map((notebook) => (
                        <Row
                          key={notebook.id}
                          href={`/analytics?tab=query&notebook=${notebook.id}`}
                          title={notebook.name}
                          detail="Notebook"
                        />
                      ))}
                    </>
                  )}
                </>
              )}
            </Section>

            <Section
              title="From Kismet"
              meta={notesReady ? `${unread.length} unread` : ""}
            >
              {!notesReady ? null : notifications.length === 0 ? (
                <Empty>No notifications yet.</Empty>
              ) : (
                notifications.slice(0, 6).map((item) => (
                  <Row
                    key={item.id}
                    href={item.nodeId ? `/graph?node=${item.nodeId}` : undefined}
                    onClick={() => {
                      if (!item.read) markAsRead(item.id);
                    }}
                    title={item.title}
                    detail={item.description}
                    aside={item.read ? <span>Read</span> : <span className="text-foreground">New</span>}
                  />
                ))
              )}
            </Section>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  meta,
  href,
  hrefLabel,
  children,
}: {
  title: string;
  meta?: string;
  href?: string;
  hrefLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-baseline justify-between gap-3 border-b border-border pb-2">
        <h2 className="text-sm font-medium">{title}</h2>
        <div className="flex items-baseline gap-3 text-xs text-muted-foreground">
          {meta ? <span>{meta}</span> : null}
          {href && hrefLabel ? (
            <Link href={href} className="text-brand hover:underline">
              {hrefLabel}
            </Link>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function Row({
  href,
  title,
  detail,
  aside,
  onClick,
}: {
  href?: string;
  title: string;
  detail?: string;
  aside?: React.ReactNode;
  onClick?: () => void;
}) {
  const className = "flex items-baseline justify-between gap-4 px-1 py-3 text-left hover:bg-muted/50";
  const body = (
    <>
      <span className="min-w-0">
        <span className="block truncate text-sm">{title}</span>
        {detail ? <span className="mt-0.5 block truncate text-xs text-muted-foreground">{detail}</span> : null}
      </span>
      {aside ? <span className="shrink-0 text-xs text-muted-foreground">{aside}</span> : null}
    </>
  );
  if (!href) {
    return (
      <button type="button" onClick={onClick} className={`${className} w-full`}>
        {body}
      </button>
    );
  }
  return (
    <Link href={href} onClick={onClick} className={className}>
      {body}
    </Link>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-1 py-3 text-sm text-muted-foreground">{children}</p>;
}

function isTicket(node: GraphNode): boolean {
  return node.type === "FEATURE" || node.type === "ENGINEERING_TASK";
}

function workHref(node: GraphNode): string {
  return hrefForType(node.id, node.type) ?? "/board";
}

function hrefForType(id: string, type?: NodeType): string | undefined {
  if (type === "EXPERIMENT") return `/experiments/${id}`;
  if (type === "FEATURE") return `/features/${id}`;
  if (type === "ENGINEERING_TASK") return `/board/${id}`;
  if (type) return `/graph?node=${id}`;
  return undefined;
}

function kindOf(node: GraphNode): string {
  if (node.metadata.kind === "bug") return "Bug";
  if (node.type === "ENGINEERING_TASK") return "Task";
  return "Feature";
}

function columnLabel(status: NodeStatus): string {
  if (status === "DRAFT") return "Backlog";
  if (status === "ACTIVE") return "To do";
  if (status === "IN_PROGRESS" || status === "AT_RISK") return "In progress";
  if (status === "COMPLETED") return "Done";
  if (status === "STALE") return "Stale";
  return "Archived";
}

function priorityLabel(priority: Priority): string {
  if (priority === "CRITICAL") return "Critical";
  if (priority === "HIGH") return "High";
  if (priority === "MEDIUM") return "Medium";
  return "Low";
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function clip(value: string, max = 96): string {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function byUpdated(a: GraphNode, b: GraphNode): number {
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}

function usePersistReady(store: {
  persist: {
    hasHydrated: () => boolean;
    onFinishHydration: (callback: () => void) => () => void;
  };
}): boolean {
  return useSyncExternalStore(
    (onChange) => store.persist.onFinishHydration(onChange),
    () => store.persist.hasHydrated(),
    () => false
  );
}
