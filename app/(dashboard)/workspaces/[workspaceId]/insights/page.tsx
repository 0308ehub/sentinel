import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { redirect } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { InsightType } from "@prisma/client";
import { SynthesizeButton } from "./synthesize-button";
import { PainPointsTabContent } from "./pain-points-tab-content";
import { PainPointsCountBadge } from "./pain-points-count-badge";
import { InsightCard } from "./insight-card";
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

  const featureRequests = byType(["FEATURE_REQUEST"]);
  const segments = byType(["USER_SEGMENT"]);
  const workflowIssues = byType(["WORKFLOW_ISSUE"]);
  const competitors = byType(["COMPETITIVE_MENTION"]);
  const quotes = byType(["CHURN_REASON", "PRICING_FEEDBACK", "OBJECTION"]);

  return (
    <div>
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
              <PainPointsCountBadge initialCount={painPoints.length} />
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

          {/* Pain Points Tab */}
          <TabsContent value="pain-points">
            <PainPointsTabContent initialPainPoints={painPoints} workspaceId={workspaceId} />
          </TabsContent>

          {/* Feature Requests */}
          <TabsContent value="features">
            <InsightGrid insights={featureRequests} workspaceId={workspaceId} />
          </TabsContent>

          {/* Segments */}
          <TabsContent value="segments">
            <InsightGrid insights={segments} workspaceId={workspaceId} />
          </TabsContent>

          {/* Workflow Issues */}
          <TabsContent value="workflow">
            <InsightGrid insights={workflowIssues} workspaceId={workspaceId} />
          </TabsContent>

          {/* Competitors */}
          <TabsContent value="competitors">
            <InsightGrid insights={competitors} workspaceId={workspaceId} />
          </TabsContent>

          {/* Quotes & Signals */}
          <TabsContent value="quotes">
            {quotes.length === 0 ? (
              <EmptyState message="No signals extracted yet. Synthesize your workspace to surface churn reasons, pricing feedback, and objections." />
            ) : (
              <div className="space-y-4">
                {quotes.map((insight) => (
                  <InsightCard key={insight.id} insight={insight} workspaceId={workspaceId} />
                ))}
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
  workspaceId,
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
  workspaceId: string;
}) {
  if (insights.length === 0) {
    return (
      <EmptyState message="No insights in this category yet. Synthesize your workspace to extract insights from uploaded documents." />
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {insights.map((insight) => (
        <InsightCard key={insight.id} insight={insight} workspaceId={workspaceId} />
      ))}
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
