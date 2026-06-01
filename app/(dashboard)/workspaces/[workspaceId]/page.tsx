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
} from "lucide-react";
import { WorkspaceNameEditor } from "./workspace-name-editor";
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
    COMPLETED: "bg-green-100 text-green-700",
    PENDING: "bg-yellow-100 text-yellow-700",
    FAILED: "bg-red-100 text-red-700",
    PARSING: "bg-blue-100 text-blue-700",
    CHUNKING: "bg-blue-100 text-blue-700",
    EMBEDDING: "bg-blue-100 text-blue-700",
    EXTRACTING: "bg-violet-100 text-violet-700",
  };

  return (
    <div className="h-full overflow-auto bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-5 border-b bg-white">
        <div>
          <WorkspaceNameEditor workspaceId={workspaceId} initialName={workspace.name} />
          {workspace.description && (
            <p className="text-gray-500 text-sm mt-0.5">{workspace.description}</p>
          )}
        </div>
        <div className="flex gap-3">
          <Link href={`/workspaces/${workspaceId}/documents/upload`}>
            <Button variant="outline" size="sm" className="gap-2">
              <Upload className="h-3.5 w-3.5" /> Upload Evidence
            </Button>
          </Link>
          <Link href={`/workspaces/${workspaceId}/chat`}>
            <Button size="sm" className="gap-2 bg-violet-600 hover:bg-violet-700 text-white">
              <MessageSquare className="h-3.5 w-3.5" /> Ask Sentinel
            </Button>
          </Link>
        </div>
      </div>

      <div className="p-8 space-y-8">
        {/* Autonomous suggestion banner */}
        {suggestion && (
          <div className="bg-white border border-violet-200 rounded-xl px-5 py-4 flex items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
                <suggestion.icon className="h-4 w-4 text-violet-600" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-violet-500 uppercase tracking-wide mb-0.5">Sentinel Suggests</p>
                <p className="text-sm font-medium text-gray-800">{suggestion.label}</p>
              </div>
            </div>
            <Link href={`/workspaces/${workspaceId}/${suggestion.href}`} className="shrink-0">
              <Button size="sm" className="gap-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs">
                {suggestion.action} <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Documents",    value: documentCount,           href: "documents",    color: "text-gray-700" },
            { label: "Pain Points",  value: activePainPointCount,    href: "insights",     color: "text-amber-600" },
            { label: "Opportunities",value: opportunities.length,    href: "opportunities",color: "text-blue-600" },
            { label: "In Sprint",    value: inSprintTickets.length,  href: "tickets",      color: "text-violet-600" },
            { label: "Done",         value: doneTickets.length,      href: "tickets",      color: "text-emerald-600" },
          ].map(({ label, value, href, color }) => (
            <Link key={label} href={`/workspaces/${workspaceId}/${href}`}>
              <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 hover:border-violet-200 transition-colors cursor-pointer">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">{label}</p>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* Sprint progress */}
        {tickets.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                <Kanban className="h-3.5 w-3.5" /> Sprint Progress
              </h2>
              <Link href={`/workspaces/${workspaceId}/tickets`} className="text-xs text-violet-600 hover:underline flex items-center gap-1">
                Board <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
              <div className="flex items-center gap-6 mb-3 flex-wrap">
                {[
                  { label: "Backlog", count: backlogTickets.length, color: "text-gray-500" },
                  { label: "Sprint",  count: inSprintTickets.length, color: "text-blue-600" },
                  { label: "In Progress", count: inProgressTickets.length, color: "text-violet-600" },
                  { label: "Review",  count: tickets.filter((t) => t.status === "IN_REVIEW").length, color: "text-amber-600" },
                  { label: "Done",    count: doneTickets.length, color: "text-emerald-600" },
                ].map(({ label, count, color }) => (
                  <div key={label} className="text-center">
                    <p className={`text-xl font-bold ${color}`}>{count}</p>
                    <p className="text-[10px] text-gray-400">{label}</p>
                  </div>
                ))}
              </div>
              {/* Progress bar */}
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden flex gap-0.5">
                {[
                  { count: backlogTickets.length, color: "bg-gray-300" },
                  { count: inSprintTickets.length, color: "bg-blue-400" },
                  { count: inProgressTickets.length, color: "bg-violet-500" },
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
              <p className="text-[11px] text-gray-400 mt-1.5">
                {tickets.length} total · {doneTickets.length} done ({Math.round((doneTickets.length / tickets.length) * 100)}%)
              </p>

              {/* Top in-progress */}
              {inProgressTickets.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
                  {inProgressTickets.slice(0, 3).map((t) => (
                    <div key={t.id} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0" />
                      <p className="text-xs text-gray-700 truncate">{t.title}</p>
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
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                <Target className="h-3.5 w-3.5" /> Top Opportunities
              </h2>
              <Link href={`/workspaces/${workspaceId}/opportunities`} className="text-xs text-violet-600 hover:underline flex items-center gap-1">
                View all <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="space-y-2">
              {opportunities.length === 0 ? (
                <div className="bg-white rounded-xl border border-dashed px-4 py-8 text-center">
                  <p className="text-sm text-gray-400">Synthesize your workspace to generate opportunities.</p>
                </div>
              ) : (
                opportunities.map((opp) => (
                  <Link key={opp.id} href={`/workspaces/${workspaceId}/opportunities/${opp.id}`}>
                    <div className="bg-white rounded-xl border px-4 py-3 hover:border-violet-200 transition-colors cursor-pointer">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-gray-800 truncate">{opp.title}</p>
                        <Badge className={`text-xs font-bold shrink-0 ${scoreToColor(opp.totalScore)} bg-transparent border`}>
                          {opp.totalScore.toFixed(0)}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-1">{opp.problemStatement}</p>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </section>

          {/* Recent evidence */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                <FileText className="h-3.5 w-3.5" /> Recent Evidence
                {pendingDocs.length > 0 && (
                  <span className="flex items-center gap-1 text-amber-500">
                    <AlertCircle className="h-3 w-3" />
                    {pendingDocs.length} processing
                  </span>
                )}
              </h2>
              <Link href={`/workspaces/${workspaceId}/documents`} className="text-xs text-violet-600 hover:underline flex items-center gap-1">
                View all <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="space-y-2">
              {recentDocs.length === 0 ? (
                <div className="bg-white rounded-xl border border-dashed px-4 py-8 text-center">
                  <p className="text-sm text-gray-400">No documents yet.</p>
                  <Link href={`/workspaces/${workspaceId}/documents/upload`}>
                    <Button variant="link" className="mt-2 text-violet-600 text-sm">Upload your first document</Button>
                  </Link>
                </div>
              ) : (
                recentDocs.map((doc) => (
                  <Link key={doc.id} href={`/workspaces/${workspaceId}/documents/${doc.id}`}>
                    <div className="bg-white rounded-xl border px-4 py-3 hover:border-violet-200 transition-colors cursor-pointer flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{doc.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{doc.sourceType.replace(/_/g, " ")} · {formatDate(doc.createdAt)}</p>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColors[doc.status] ?? "bg-gray-100 text-gray-600"}`}>
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
