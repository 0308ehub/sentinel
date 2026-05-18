import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { redirect } from "next/navigation";
import { WorkspaceNav } from "@/components/nav/workspace-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { InsightType } from "@prisma/client";
import { SynthesizeButton } from "./synthesize-button";
import { cn } from "@/lib/utils";
import { Lightbulb, AlertTriangle, Users, Workflow, Swords, Quote } from "lucide-react";

export default async function InsightsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;

  try {
    await requireWorkspaceAccess(workspaceId);
  } catch {
    redirect("/sign-in");
  }

  const [insights, painPoints] = await Promise.all([
    prisma.insight.findMany({
      where: { workspaceId },
      orderBy: { confidence: "desc" },
    }),
    prisma.painPoint.findMany({
      where: { workspaceId, status: "ACTIVE" },
      orderBy: [{ severity: "desc" }, { urgency: "desc" }],
    }),
  ]);

  const byType = (types: InsightType[]) =>
    insights.filter((i) => types.includes(i.type));

  const painPointInsights = byType(["PAIN_POINT", "USABILITY_ISSUE", "BUG_REPORT"]);
  const featureRequests = byType(["FEATURE_REQUEST"]);
  const segments = byType(["USER_SEGMENT"]);
  const workflowIssues = byType(["WORKFLOW_ISSUE"]);
  const competitors = byType(["COMPETITIVE_MENTION"]);
  const quotes = byType(["CHURN_REASON", "PRICING_FEEDBACK", "OBJECTION"]);

  function severityBadgeClass(score: number) {
    if (score >= 8) return "bg-red-100 text-red-700 border-red-200";
    if (score >= 5) return "bg-orange-100 text-orange-700 border-orange-200";
    return "bg-yellow-100 text-yellow-700 border-yellow-200";
  }

  function confidenceBar(confidence: number) {
    const pct = Math.round(confidence * 100);
    const color =
      pct >= 75 ? "bg-emerald-500" : pct >= 50 ? "bg-violet-500" : "bg-gray-300";
    return { pct, color };
  }

  return (
    <div>
      <WorkspaceNav workspaceId={workspaceId} />

      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Insights</h1>
            <p className="text-sm text-gray-500 mt-1">
              {insights.length} insights synthesized from your evidence
            </p>
          </div>
          <SynthesizeButton workspaceId={workspaceId} />
        </div>

        <Tabs defaultValue="pain-points">
          <TabsList variant="line" className="mb-6 border-b border-gray-200 rounded-none w-full justify-start gap-0 h-auto pb-0">
            <TabsTrigger value="pain-points" className="rounded-none px-4 py-2.5 text-sm">
              <AlertTriangle className="h-3.5 w-3.5" />
              Pain Points
              <span className="ml-1.5 text-xs bg-gray-100 text-gray-600 rounded-full px-1.5 py-0.5 font-medium">
                {painPoints.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="features" className="rounded-none px-4 py-2.5 text-sm">
              <Lightbulb className="h-3.5 w-3.5" />
              Feature Requests
              <span className="ml-1.5 text-xs bg-gray-100 text-gray-600 rounded-full px-1.5 py-0.5 font-medium">
                {featureRequests.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="segments" className="rounded-none px-4 py-2.5 text-sm">
              <Users className="h-3.5 w-3.5" />
              Segments
              <span className="ml-1.5 text-xs bg-gray-100 text-gray-600 rounded-full px-1.5 py-0.5 font-medium">
                {segments.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="workflow" className="rounded-none px-4 py-2.5 text-sm">
              <Workflow className="h-3.5 w-3.5" />
              Workflow Issues
              <span className="ml-1.5 text-xs bg-gray-100 text-gray-600 rounded-full px-1.5 py-0.5 font-medium">
                {workflowIssues.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="competitors" className="rounded-none px-4 py-2.5 text-sm">
              <Swords className="h-3.5 w-3.5" />
              Competitors
              <span className="ml-1.5 text-xs bg-gray-100 text-gray-600 rounded-full px-1.5 py-0.5 font-medium">
                {competitors.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="quotes" className="rounded-none px-4 py-2.5 text-sm">
              <Quote className="h-3.5 w-3.5" />
              Quotes &amp; Signals
              <span className="ml-1.5 text-xs bg-gray-100 text-gray-600 rounded-full px-1.5 py-0.5 font-medium">
                {quotes.length}
              </span>
            </TabsTrigger>
          </TabsList>

          {/* Pain Points Tab — shows structured PainPoint records */}
          <TabsContent value="pain-points">
            {painPoints.length === 0 ? (
              <EmptyState message="No pain points extracted yet. Synthesize your workspace to extract insights." />
            ) : (
              <div className="space-y-4">
                {painPoints.map((pp) => (
                  <Card key={pp.id} className="bg-white">
                    <CardHeader className="pb-0">
                      <div className="flex items-start justify-between gap-4">
                        <CardTitle className="text-base text-gray-900">{pp.title}</CardTitle>
                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={cn(
                              "text-xs font-semibold px-2.5 py-1 rounded-full border",
                              severityBadgeClass(pp.severity)
                            )}
                          >
                            Severity {pp.severity}/10
                          </span>
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-violet-100 text-violet-700 border border-violet-200">
                            Urgency {pp.urgency}/10
                          </span>
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                            Freq {pp.frequency}/10
                          </span>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-3">
                      <p className="text-sm text-gray-600 leading-relaxed mb-3">{pp.description}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        {pp.affectedSegments.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {pp.affectedSegments.map((seg) => (
                              <Badge key={seg} variant="secondary" className="text-xs">
                                {seg}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {pp.evidenceIds.length > 0 && (
                          <span className="text-xs text-gray-400 ml-auto">
                            {pp.evidenceIds.length} evidence{pp.evidenceIds.length !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Feature Requests */}
          <TabsContent value="features">
            <InsightGrid insights={featureRequests} confidenceBar={confidenceBar} />
          </TabsContent>

          {/* Segments */}
          <TabsContent value="segments">
            <InsightGrid insights={segments} confidenceBar={confidenceBar} />
          </TabsContent>

          {/* Workflow Issues */}
          <TabsContent value="workflow">
            <InsightGrid insights={workflowIssues} confidenceBar={confidenceBar} />
          </TabsContent>

          {/* Competitors */}
          <TabsContent value="competitors">
            <InsightGrid insights={competitors} confidenceBar={confidenceBar} />
          </TabsContent>

          {/* Quotes & Signals */}
          <TabsContent value="quotes">
            {quotes.length === 0 ? (
              <EmptyState message="No signals extracted yet. Synthesize your workspace to surface churn reasons, pricing feedback, and objections." />
            ) : (
              <div className="space-y-4">
                {quotes.map((insight) => {
                  const { pct, color } = confidenceBar(insight.confidence);
                  return (
                    <Card key={insight.id} className="bg-white border-l-4 border-l-violet-400">
                      <CardHeader className="pb-0">
                        <div className="flex items-start justify-between gap-4">
                          <CardTitle className="text-base text-gray-900">{insight.title}</CardTitle>
                          <Badge variant="outline" className="text-xs shrink-0">
                            {insight.type.replace(/_/g, " ")}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-3">
                        <p className="text-sm text-gray-600 leading-relaxed mb-4 italic">
                          &ldquo;{insight.description}&rdquo;
                        </p>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={cn("h-full rounded-full transition-all", color)}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 font-medium shrink-0">
                            {pct}% confidence
                          </span>
                          {insight.evidenceIds.length > 0 && (
                            <span className="text-xs text-gray-400">
                              {insight.evidenceIds.length} sources
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function InsightGrid({
  insights,
  confidenceBar,
}: {
  insights: {
    id: string;
    title: string;
    description: string;
    confidence: number;
    evidenceIds: string[];
    type: InsightType;
    metadata: unknown;
  }[];
  confidenceBar: (c: number) => { pct: number; color: string };
}) {
  if (insights.length === 0) {
    return (
      <EmptyState message="No insights in this category yet. Synthesize your workspace to extract insights from uploaded documents." />
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {insights.map((insight) => {
        const { pct, color } = confidenceBar(insight.confidence);
        const meta = insight.metadata as Record<string, unknown> | null;
        const affectedSegments = Array.isArray(meta?.affectedSegments)
          ? (meta.affectedSegments as string[])
          : [];

        return (
          <Card key={insight.id} className="bg-white flex flex-col">
            <CardHeader className="pb-0">
              <div className="flex items-start justify-between gap-3">
                <CardTitle className="text-sm text-gray-900 leading-snug">{insight.title}</CardTitle>
                <Badge
                  className={cn(
                    "text-xs shrink-0 font-semibold",
                    pct >= 75
                      ? "bg-emerald-100 text-emerald-700"
                      : pct >= 50
                        ? "bg-violet-100 text-violet-700"
                        : "bg-gray-100 text-gray-600"
                  )}
                >
                  {pct}%
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-3 flex flex-col flex-1">
              <p className="text-sm text-gray-600 leading-relaxed mb-4 flex-1">{insight.description}</p>

              {/* Confidence bar */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-400">Confidence</span>
                  <span className="text-xs text-gray-500 font-medium">{pct}%</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", color)}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {affectedSegments.map((seg: string) => (
                  <Badge key={seg} variant="secondary" className="text-xs">
                    {seg}
                  </Badge>
                ))}
                {insight.evidenceIds.length > 0 && (
                  <span className="text-xs text-gray-400 ml-auto">
                    {insight.evidenceIds.length} evidence{insight.evidenceIds.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="bg-white rounded-xl border border-dashed p-16 text-center">
      <Lightbulb className="h-10 w-10 text-gray-200 mx-auto mb-3" />
      <p className="text-sm text-gray-500 max-w-sm mx-auto">{message}</p>
    </div>
  );
}
