import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { WorkspaceNav } from "@/components/nav/workspace-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GenerateOpportunitiesButton } from "./generate-button";
import { Button } from "@/components/ui/button";
import { FileText, ExternalLink, Target } from "lucide-react";
import { cn } from "@/lib/utils";

type SortKey = "totalScore" | "impactScore" | "urgencyScore";

export default async function OpportunitiesPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{ sort?: string }>;
}) {
  const { workspaceId } = await params;
  const { sort } = await searchParams;

  try {
    await requireWorkspaceAccess(workspaceId);
  } catch {
    redirect("/sign-in");
  }

  const sortKey: SortKey =
    sort === "impact"
      ? "impactScore"
      : sort === "urgency"
        ? "urgencyScore"
        : "totalScore";

  const opportunities = await prisma.opportunity.findMany({
    where: { workspaceId },
    orderBy: { [sortKey]: "desc" },
  });

  function scoreColor(score: number) {
    if (score >= 80) return "text-emerald-700 bg-emerald-50 border-emerald-200";
    if (score >= 60) return "text-amber-700 bg-amber-50 border-amber-200";
    return "text-red-700 bg-red-50 border-red-200";
  }

  function miniScoreColor(score: number) {
    if (score >= 80) return "text-emerald-600";
    if (score >= 60) return "text-amber-600";
    return "text-red-500";
  }

  const sortLinks: { label: string; key: string }[] = [
    { label: "Total Score", key: "total" },
    { label: "Impact", key: "impact" },
    { label: "Urgency", key: "urgency" },
  ];

  const activeSort = sort ?? "total";

  return (
    <div>
      <WorkspaceNav workspaceId={workspaceId} />

      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Opportunities</h1>
            <p className="text-sm text-gray-500 mt-1">
              {opportunities.length} ranked opportunities
            </p>
          </div>
          <GenerateOpportunitiesButton workspaceId={workspaceId} />
        </div>

        {/* Sort controls */}
        <div className="flex items-center gap-2 mb-6">
          <span className="text-xs font-medium text-gray-500 mr-1">Sort by:</span>
          {sortLinks.map(({ label, key }) => (
            <Link
              key={key}
              href={`/workspaces/${workspaceId}/opportunities?sort=${key}`}
            >
              <button
                className={cn(
                  "text-xs px-3 py-1.5 rounded-full border font-medium transition-colors",
                  activeSort === key
                    ? "bg-violet-600 text-white border-violet-600"
                    : "bg-white text-gray-600 border-gray-200 hover:border-violet-300 hover:text-violet-700"
                )}
              >
                {label}
              </button>
            </Link>
          ))}
        </div>

        {opportunities.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed p-16 text-center">
            <Target className="h-12 w-12 text-gray-200 mx-auto mb-4" />
            <h3 className="font-semibold text-gray-900 mb-2">No opportunities yet</h3>
            <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
              Generate opportunities from your synthesized pain points and insights.
            </p>
            <GenerateOpportunitiesButton workspaceId={workspaceId} />
          </div>
        ) : (
          <div className="space-y-4">
            {opportunities.map((opp, index) => (
              <Card key={opp.id} className="bg-white hover:shadow-sm transition-shadow">
                <CardHeader className="pb-0">
                  <div className="flex items-start gap-4">
                    {/* Rank indicator */}
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-violet-50 border border-violet-100 text-violet-600 font-bold text-sm shrink-0 mt-0.5">
                      {index + 1}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <CardTitle className="text-base text-gray-900 mb-1">
                            {opp.title}
                          </CardTitle>
                          <p className="text-sm text-gray-500 leading-relaxed">
                            {opp.description}
                          </p>
                        </div>

                        {/* Total score — large, color-coded */}
                        <div
                          className={cn(
                            "flex flex-col items-center justify-center min-w-[72px] rounded-xl border-2 px-3 py-2 shrink-0",
                            scoreColor(opp.totalScore)
                          )}
                        >
                          <span className="text-2xl font-bold leading-none">
                            {opp.totalScore.toFixed(0)}
                          </span>
                          <span className="text-xs font-medium mt-0.5 opacity-70">score</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-4 pl-16">
                  {/* Problem statement */}
                  <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2.5 mb-4 line-clamp-2 leading-relaxed border border-gray-100">
                    <span className="font-medium text-gray-700">Problem: </span>
                    {opp.problemStatement}
                  </p>

                  {/* Score breakdown */}
                  <div className="flex items-center gap-4 mb-4 flex-wrap">
                    {[
                      { label: "Impact", value: opp.impactScore },
                      { label: "Confidence", value: opp.confidenceScore },
                      { label: "Urgency", value: opp.urgencyScore },
                      { label: "Effort", value: opp.effortScore, inverse: true },
                      { label: "Risk", value: opp.riskScore, inverse: true },
                    ].map(({ label, value, inverse }) => {
                      const displayScore = inverse ? 100 - value : value;
                      return (
                        <div key={label} className="flex flex-col items-center">
                          <span className={cn("text-sm font-bold", miniScoreColor(displayScore))}>
                            {value.toFixed(0)}
                          </span>
                          <span className="text-xs text-gray-400">{label}</span>
                        </div>
                      );
                    })}

                    {/* Status badge */}
                    <div className="ml-auto">
                      <Badge variant="outline" className="text-xs capitalize">
                        {opp.status.toLowerCase().replace(/_/g, " ")}
                      </Badge>
                    </div>
                  </div>

                  {/* Target segments */}
                  {opp.targetSegments.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {opp.targetSegments.map((seg) => (
                        <Badge key={seg} variant="secondary" className="text-xs">
                          {seg}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* CTA buttons */}
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/workspaces/${workspaceId}/prd?opportunityId=${opp.id}`}
                    >
                      <Button
                        size="sm"
                        className="gap-1.5 bg-violet-600 hover:bg-violet-700 text-white"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        Generate PRD
                      </Button>
                    </Link>
                    <Link
                      href={`/workspaces/${workspaceId}/opportunities/${opp.id}`}
                    >
                      <Button size="sm" variant="outline" className="gap-1.5">
                        <ExternalLink className="h-3.5 w-3.5" />
                        View Detail
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
