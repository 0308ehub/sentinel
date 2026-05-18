import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkspaceNav } from "@/components/nav/workspace-nav";
import { ArrowLeft, Target, FileText, Ticket } from "lucide-react";
import { formatDate, scoreToColor } from "@/lib/utils";
import { GeneratePRDButton } from "@/components/opportunity/generate-prd-button";

export default async function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ workspaceId: string; opportunityId: string }>;
}) {
  const { workspaceId, opportunityId } = await params;

  try {
    await requireWorkspaceAccess(workspaceId);
  } catch {
    redirect("/sign-in");
  }

  const opportunity = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
    include: {
      painPoint: true,
      prds: { select: { id: true, title: true, createdAt: true } },
      tickets: { select: { id: true, title: true, priority: true, ticketType: true } },
    },
  });

  if (!opportunity || opportunity.workspaceId !== workspaceId) notFound();

  const scores = [
    { label: "Impact", value: opportunity.impactScore, description: "Business/user value" },
    { label: "Confidence", value: opportunity.confidenceScore, description: "Evidence strength" },
    { label: "Urgency", value: opportunity.urgencyScore, description: "Time sensitivity" },
    { label: "Effort", value: opportunity.effortScore, description: "Implementation difficulty", invert: true },
    { label: "Risk", value: opportunity.riskScore, description: "Execution risk", invert: true },
  ];

  const statusColors: Record<string, string> = {
    PROPOSED: "bg-gray-100 text-gray-600",
    ACCEPTED: "bg-green-100 text-green-700",
    REJECTED: "bg-red-100 text-red-700",
    IN_PROGRESS: "bg-blue-100 text-blue-700",
    SHIPPED: "bg-emerald-100 text-emerald-700",
  };

  const priorityColors: Record<string, string> = {
    LOW: "text-gray-500",
    MEDIUM: "text-yellow-600",
    HIGH: "text-orange-600",
    CRITICAL: "text-red-600",
  };

  return (
    <div>
      <WorkspaceNav workspaceId={workspaceId} />
      <div className="p-8 max-w-4xl">
        <Link href={`/workspaces/${workspaceId}/opportunities`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6">
          <ArrowLeft className="h-4 w-4" /> Opportunities
        </Link>

        <div className="flex items-start justify-between mb-6 gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-gray-900">{opportunity.title}</h1>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[opportunity.status]}`}>
                {opportunity.status}
              </span>
            </div>
            <p className="text-gray-500 text-sm">{opportunity.description}</p>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className={`text-3xl font-bold ${scoreToColor(opportunity.totalScore)}`}>
              {opportunity.totalScore.toFixed(0)}
            </div>
            <p className="text-xs text-gray-400">Total Score</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Problem & Solution */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-gray-700">Problem Statement</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-700 leading-relaxed">{opportunity.problemStatement}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-gray-700">Proposed Solution</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-700 leading-relaxed">
                {opportunity.proposedSolution ?? "No solution proposed yet."}
              </p>
            </CardContent>
          </Card>

          {/* Target Segments */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-gray-700">Target Segments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {opportunity.targetSegments.map((seg) => (
                  <Badge key={seg} variant="secondary" className="text-violet-700 bg-violet-50">{seg}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Scores */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-gray-700">Score Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {scores.map(({ label, value, description, invert }) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="text-xs font-medium text-gray-500 w-20">{label}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${invert ? (value <= 2 ? "bg-green-500" : value <= 3 ? "bg-yellow-500" : "bg-red-500") : (value >= 4 ? "bg-green-500" : value >= 3 ? "bg-yellow-500" : "bg-red-500")}`}
                      style={{ width: `${(value / 5) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-gray-700 w-8">{value}/5</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 mb-8">
          <GeneratePRDButton workspaceId={workspaceId} opportunityId={opportunityId} />
        </div>

        {/* Existing PRDs */}
        {opportunity.prds.length > 0 && (
          <section className="mb-8">
            <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4 text-violet-600" /> Generated PRDs
            </h2>
            <div className="space-y-2">
              {opportunity.prds.map((prd) => (
                <Link key={prd.id} href={`/workspaces/${workspaceId}/prd/${prd.id}`}>
                  <div className="flex items-center justify-between bg-white rounded-lg border px-4 py-3 hover:border-violet-200 transition-colors">
                    <p className="text-sm font-medium text-gray-800">{prd.title}</p>
                    <span className="text-xs text-gray-400">{formatDate(prd.createdAt)}</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Existing Tickets */}
        {opportunity.tickets.length > 0 && (
          <section>
            <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <Ticket className="h-4 w-4 text-violet-600" /> Engineering Tickets
            </h2>
            <div className="space-y-2">
              {opportunity.tickets.map((ticket) => (
                <div key={ticket.id} className="flex items-center justify-between bg-white rounded-lg border px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{ticket.title}</p>
                    <p className="text-xs text-gray-400">{ticket.ticketType}</p>
                  </div>
                  <Badge variant="outline" className={`text-xs ${priorityColors[ticket.priority]}`}>
                    {ticket.priority}
                  </Badge>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
