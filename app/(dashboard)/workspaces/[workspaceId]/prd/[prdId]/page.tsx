import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { WorkspaceNav } from "@/components/nav/workspace-nav";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { ChevronLeft, Ticket } from "lucide-react";
import { PRDActions } from "./prd-actions";

export default async function PRDDetailPage({
  params,
}: {
  params: Promise<{ workspaceId: string; prdId: string }>;
}) {
  const { workspaceId, prdId } = await params;

  try {
    await requireWorkspaceAccess(workspaceId);
  } catch {
    redirect("/sign-in");
  }

  const prd = await prisma.pRD.findFirst({
    where: { id: prdId, workspaceId },
    include: {
      opportunity: { select: { id: true, title: true, totalScore: true } },
      tickets: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          title: true,
          priority: true,
          ticketType: true,
          estimate: true,
        },
      },
    },
  });

  if (!prd) {
    notFound();
  }

  const priorityColors: Record<string, string> = {
    CRITICAL: "bg-red-100 text-red-700",
    HIGH: "bg-orange-100 text-orange-700",
    MEDIUM: "bg-amber-100 text-amber-700",
    LOW: "bg-gray-100 text-gray-600",
  };

  return (
    <div>
      <WorkspaceNav workspaceId={workspaceId} />

      <div className="p-8 max-w-5xl">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-6">
          <Link
            href={`/workspaces/${workspaceId}/prd`}
            className="flex items-center gap-1 text-sm text-gray-400 hover:text-violet-600 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            PRDs
          </Link>
          <span className="text-gray-300">/</span>
          <span className="text-sm text-gray-700 font-medium truncate max-w-xs">
            {prd.title}
          </span>
        </div>

        <div className="flex items-start justify-between gap-6 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{prd.title}</h1>
            <div className="flex items-center gap-3 flex-wrap">
              {prd.opportunity && (
                <Link
                  href={`/workspaces/${workspaceId}/opportunities/${prd.opportunity.id}`}
                  className="flex items-center gap-1.5 text-xs text-violet-600 font-medium hover:underline"
                >
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-violet-500" />
                  {prd.opportunity.title}
                  <Badge className="ml-1 text-xs bg-violet-100 text-violet-700 border-violet-200">
                    {prd.opportunity.totalScore.toFixed(0)}
                  </Badge>
                </Link>
              )}
              <span className="text-xs text-gray-400">
                Created {formatDate(prd.createdAt)}
              </span>
              {prd.tickets.length > 0 && (
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <Ticket className="h-3.5 w-3.5" />
                  {prd.tickets.length} ticket{prd.tickets.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>

          <PRDActions prd={{ id: prd.id, content: prd.content, title: prd.title }} workspaceId={workspaceId} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* PRD content */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="border-b px-5 py-3 bg-gray-50 flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-gray-200" />
                  <div className="w-3 h-3 rounded-full bg-gray-200" />
                  <div className="w-3 h-3 rounded-full bg-gray-200" />
                </div>
                <span className="text-xs text-gray-400 font-mono ml-2">{prd.title}.md</span>
              </div>
              <pre className="px-6 py-6 text-sm text-gray-800 font-mono leading-relaxed whitespace-pre-wrap break-words overflow-auto max-h-[calc(100vh-280px)]">
                {prd.content}
              </pre>
            </div>
          </div>

          {/* Right panel: tickets + edit */}
          <div className="space-y-6">
            {/* Engineering tickets */}
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide flex items-center gap-2">
                <Ticket className="h-3.5 w-3.5 text-violet-600" />
                Engineering Tickets
              </h2>
              {prd.tickets.length === 0 ? (
                <div className="bg-white rounded-xl border border-dashed p-6 text-center">
                  <p className="text-xs text-gray-400 mb-3">
                    No tickets generated yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {prd.tickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      className="bg-white rounded-lg border px-3 py-2.5"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-xs font-medium text-gray-800 leading-snug">
                          {ticket.title}
                        </p>
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${priorityColors[ticket.priority] ?? "bg-gray-100 text-gray-600"}`}
                        >
                          {ticket.priority}
                        </span>
                      </div>
                      {(ticket.ticketType || ticket.estimate) && (
                        <div className="flex gap-2">
                          {ticket.ticketType && (
                            <span className="text-xs text-gray-400">{ticket.ticketType}</span>
                          )}
                          {ticket.estimate && (
                            <span className="text-xs text-gray-400">· {ticket.estimate}</span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
