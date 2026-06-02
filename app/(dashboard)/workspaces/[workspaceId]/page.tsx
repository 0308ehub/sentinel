import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Lightbulb,
  Target,
  Upload,
  MessageSquare,
  ChevronRight,
  Kanban,
  Zap,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  Inbox,
  Search,
  Bot,
  RefreshCw,
} from "lucide-react";
import { DigestWidget } from "./digest-widget";
import { WorkspaceNameEditor } from "./workspace-name-editor";
import { PipelineBanner } from "./pipeline-banner";
import { formatDate, scoreToColor } from "@/lib/utils";

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;

  let workspace;
  try {
    ({ workspace } = await requireWorkspaceAccess(workspaceId));
  } catch {
    redirect("/sign-in");
  }

  const [
    documentCount,
    activePainPointCount,
    opportunities,
    tickets,
    recentDocs,
    pendingActionCount,
    lastDigestAction,
  ] = await Promise.all([
    prisma.document.count({ where: { workspaceId } }),
    prisma.painPoint.count({ where: { workspaceId, status: "ACTIVE" } }),
    prisma.opportunity.findMany({
      where: { workspaceId },
      orderBy: { totalScore: "desc" },
      take: 3,
    }),
    prisma.engineeringTicket.findMany({
      where: { workspaceId },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    }),
    prisma.document.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: 4,
      select: { id: true, title: true, status: true, sourceType: true, createdAt: true },
    }),
    prisma.sentinelAction.count({ where: { workspaceId, status: "PENDING_REVIEW" } }),
    prisma.sentinelAction.findFirst({
      where: { workspaceId, type: "GENERATE_DIGEST", status: "COMPLETED" },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const inProgressTickets = tickets.filter((t) => t.status === "IN_PROGRESS");
  const inSprintTickets = tickets.filter((t) => t.status === "IN_SPRINT");
  const doneTickets = tickets.filter((t) => t.status === "DONE");
  const backlogTickets = tickets.filter((t) => t.status === "BACKLOG");

  const topOpportunity = opportunities[0];
  const hasNoTickets = tickets.length === 0;
  const hasNoPainPoints = activePainPointCount === 0;
  const pendingDocs = recentDocs.filter((d) => ["PENDING", "EXTRACTING", "PARSING", "CHUNKING", "EMBEDDING"].includes(d.status));

  // Determine the #1 autonomous suggestion
  let suggestion: { label: string; action: string; href: string; icon: React.ElementType } | null = null;
  if (documentCount === 0) {
    suggestion = { label: "Upload your first evidence document to get started", action: "Upload Evidence", href: `documents/upload`, icon: Upload };
  } else if (hasNoPainPoints && documentCount > 0) {
    suggestion = { label: "Synthesize your workspace to extract pain points and opportunities", action: "Go to Insights", href: `insights`, icon: Lightbulb };
  } else if (opportunities.length === 0) {
    suggestion = { label: "Generate opportunities from your pain points", action: "View Insights", href: `insights`, icon: Target };
  } else if (hasNoTickets && topOpportunity) {
    suggestion = { label: `Generate engineering tickets for "${topOpportunity.title}"`, action: "View Opportunity", href: `opportunities/${topOpportunity.id}`, icon: Kanban };
  } else if (inSprintTickets.length > 0 && inProgressTickets.length === 0) {
    suggestion = { label: `${inSprintTickets.length} tickets are in the sprint but none are in progress — start one`, action: "View Tickets", href: `tickets`, icon: Zap };
  } else if (backlogTickets.length > 5 && inSprintTickets.length === 0) {
    suggestion = { label: `You have ${backlogTickets.length} tickets in backlog — move some to your sprint`, action: "Plan Sprint", href: `tickets`, icon: TrendingUp };
  }

  const statusColors: Record<string, string> = {
    COMPLETED: "bg-green-500/15 text-green-400 border border-green-500/20",
    PENDING: "bg-yellow-500/15 text-yellow-400 border border-yellow-500/20",
    FAILED: "bg-red-500/15 text-red-400 border border-red-500/20",
    PARSING: "bg-blue-500/15 text-blue-400 border border-blue-500/20",
    CHUNKING: "bg-blue-500/15 text-blue-400 border border-blue-500/20",
    EMBEDDING: "bg-blue-500/15 text-blue-400 border border-blue-500/20",
    EXTRACTING: "bg-indigo-500/15 text-indigo-400 border border-indigo-500/20",
  };

  return (
    <div className="h-full overflow-auto bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-border bg-card">
        <div>
          <WorkspaceNameEditor workspaceId={workspaceId} initialName={workspace.name} />
          {workspace.description && (
            <p className="text-muted-foreground text-sm mt-0.5">{workspace.description}</p>
          )}
        </div>
        <div className="flex gap-3">
          <Link href={`/workspaces/${workspaceId}/documents/upload`}>
            <Button variant="outline" size="sm" className="gap-2">
              <Upload className="h-3.5 w-3.5" /> Upload Evidence
            </Button>
          </Link>
          <Link href={`/workspaces/${workspaceId}/chat`}>
            <Button size="sm" className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
              <MessageSquare className="h-3.5 w-3.5" /> Ask Sentinel
            </Button>
          </Link>
        </div>
      </div>

      <div className="p-8 space-y-8">
        {/* Autonomous suggestion banner */}
        {suggestion && (
          <div className="bg-card border border-indigo-500/25 rounded-xl px-5 py-4 flex items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
                <suggestion.icon className="h-4 w-4 text-indigo-400" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-indigo-500 uppercase tracking-wide mb-0.5">Sentinel Suggests</p>
                <p className="text-sm font-medium text-foreground">{suggestion.label}</p>
              </div>
            </div>
            <Link href={`/workspaces/${workspaceId}/${suggestion.href}`} className="shrink-0">
              <Button size="sm" className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs">
                {suggestion.action} <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        )}

        {/* Pending actions banner */}
        {pendingActionCount > 0 && (
          <Link href={`/workspaces/${workspaceId}/inbox`}>
            <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl px-5 py-3 flex items-center justify-between gap-4 hover:border-amber-500/40 transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
                  <Inbox className="h-4 w-4 text-amber-400" />
                </div>
                <p className="text-sm font-medium text-amber-300">
                  {pendingActionCount} action{pendingActionCount !== 1 ? "s" : ""} waiting for your review in Sentinel Inbox
                </p>
              </div>
              <span className="text-xs font-semibold text-amber-400 flex items-center gap-1 shrink-0">
                Review <ChevronRight className="h-3 w-3" />
              </span>
            </div>
          </Link>
        )}

        {/* Autonomous pipeline banner */}
        <PipelineBanner workspaceId={workspaceId} />

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Documents",    value: documentCount,           href: "documents",    color: "text-foreground" },
            { label: "Pain Points",  value: activePainPointCount,    href: "insights",     color: "text-amber-600" },
            { label: "Opportunities",value: opportunities.length,    href: "opportunities",color: "text-blue-600" },
            { label: "In Sprint",    value: inSprintTickets.length,  href: "tickets",      color: "text-indigo-600" },
            { label: "Done",         value: doneTickets.length,      href: "tickets",      color: "text-emerald-600" },
          ].map(({ label, value, href, color }) => (
            <Link key={label} href={`/workspaces/${workspaceId}/${href}`}>
              <div className="bg-card rounded-xl border border-border px-4 py-3 hover:border-indigo-200 transition-colors cursor-pointer">
                <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide mb-1">{label}</p>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* Weekly Digest */}
        <DigestWidget workspaceId={workspaceId} lastDigestAction={lastDigestAction as never} />

        {/* Sprint progress */}
        {tickets.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Kanban className="h-3.5 w-3.5" /> Sprint Progress
              </h2>
              <Link href={`/workspaces/${workspaceId}/tickets`} className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
                Board <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="bg-card rounded-xl border border-border px-5 py-4">
              <div className="flex items-center gap-6 mb-3 flex-wrap">
                {[
                  { label: "Backlog", count: backlogTickets.length, color: "text-muted-foreground" },
                  { label: "Sprint",  count: inSprintTickets.length, color: "text-blue-600" },
                  { label: "In Progress", count: inProgressTickets.length, color: "text-indigo-600" },
                  { label: "Review",  count: tickets.filter((t) => t.status === "IN_REVIEW").length, color: "text-amber-600" },
                  { label: "Done",    count: doneTickets.length, color: "text-emerald-600" },
                ].map(({ label, count, color }) => (
                  <div key={label} className="text-center">
                    <p className={`text-xl font-bold ${color}`}>{count}</p>
                    <p className="text-[10px] text-muted-foreground/60">{label}</p>
                  </div>
                ))}
              </div>
              {/* Progress bar */}
              <div className="h-2 bg-muted rounded-full overflow-hidden flex gap-0.5">
                {[
                  { count: backlogTickets.length, color: "bg-muted-foreground/30" },
                  { count: inSprintTickets.length, color: "bg-blue-400" },
                  { count: inProgressTickets.length, color: "bg-indigo-500" },
                  { count: tickets.filter((t) => t.status === "IN_REVIEW").length, color: "bg-amber-400" },
                  { count: doneTickets.length, color: "bg-emerald-500" },
                ].map(({ count, color }, i) =>
                  count > 0 ? (
                    <div
                      key={i}
                      className={`h-full ${color} transition-all duration-500`}
                      style={{ width: `${(count / tickets.length) * 100}%` }}
                    />
                  ) : null
                )}
              </div>
              <p className="text-[11px] text-muted-foreground/60 mt-1.5">
                {tickets.length} total · {doneTickets.length} done ({Math.round((doneTickets.length / tickets.length) * 100)}%)
              </p>

              {/* Top in-progress */}
              {inProgressTickets.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border/50 space-y-1.5">
                  {inProgressTickets.slice(0, 3).map((t) => (
                    <div key={t.id} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                      <p className="text-xs text-foreground/80 truncate">{t.title}</p>
                      <Badge variant="outline" className="text-[10px] ml-auto shrink-0">{t.priority}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Top opportunities */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Target className="h-3.5 w-3.5" /> Top Opportunities
              </h2>
              <Link href={`/workspaces/${workspaceId}/opportunities`} className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
                View all <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="space-y-2">
              {opportunities.length === 0 ? (
                <div className="bg-card rounded-xl border border-dashed px-4 py-8 text-center">
                  <p className="text-sm text-muted-foreground/60">Synthesize your workspace to generate opportunities.</p>
                </div>
              ) : (
                opportunities.map((opp) => (
                  <Link key={opp.id} href={`/workspaces/${workspaceId}/opportunities/${opp.id}`}>
                    <div className="bg-card rounded-xl border border-border px-4 py-3 hover:border-indigo-200 transition-colors cursor-pointer">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-foreground truncate">{opp.title}</p>
                        <Badge className={`text-xs font-bold shrink-0 ${scoreToColor(opp.totalScore)} bg-transparent border`}>
                          {opp.totalScore.toFixed(0)}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{opp.problemStatement}</p>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </section>

          {/* Recent evidence */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <FileText className="h-3.5 w-3.5" /> Recent Evidence
                {pendingDocs.length > 0 && (
                  <span className="flex items-center gap-1 text-amber-500">
                    <AlertCircle className="h-3 w-3" />
                    {pendingDocs.length} processing
                  </span>
                )}
              </h2>
              <Link href={`/workspaces/${workspaceId}/documents`} className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
                View all <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="space-y-2">
              {recentDocs.length === 0 ? (
                <div className="bg-card rounded-xl border border-dashed px-4 py-8 text-center">
                  <p className="text-sm text-muted-foreground/60">No documents yet.</p>
                  <Link href={`/workspaces/${workspaceId}/documents/upload`}>
                    <Button variant="link" className="mt-2 text-indigo-600 text-sm">Upload your first document</Button>
                  </Link>
                </div>
              ) : (
                recentDocs.map((doc) => (
                  <Link key={doc.id} href={`/workspaces/${workspaceId}/documents/${doc.id}`}>
                    <div className="bg-card rounded-xl border border-border px-4 py-3 hover:border-indigo-200 transition-colors cursor-pointer flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{doc.title}</p>
                        <p className="text-xs text-muted-foreground/60 mt-0.5">{doc.sourceType.replace(/_/g, " ")} · {formatDate(doc.createdAt)}</p>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColors[doc.status] ?? "bg-muted text-muted-foreground"}`}>
                        {doc.status}
                      </span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
