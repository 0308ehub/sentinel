import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { redirect } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { InsightType } from "@prisma/client";
import { SynthesizeButton } from "./synthesize-button";
import { PainPointsTabContent } from "./pain-points-tab-content";
import { PainPointsCountBadge } from "./pain-points-count-badge";
import { InsightCountBadge } from "./insight-count-badge";
import { InsightTabContent } from "./insight-tab-content";
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
            <h1 className="text-2xl font-bold text-foreground">Insights</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {insights.length} insights synthesized from your evidence
            </p>
          </div>
          <SynthesizeButton workspaceId={workspaceId} />
        </div>

        <Tabs defaultValue="pain-points">
          <div className="mb-6 overflow-x-auto overflow-y-hidden border-b border-border -mx-8 px-8 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <TabsList variant="line" className="rounded-none min-w-max border-b-0 justify-start gap-0 h-auto pb-0">
              <TabsTrigger value="pain-points" className="rounded-none px-3 py-1.5 text-xs shrink-0">
                <AlertTriangle className="h-3 w-3" />
                Pain Points
                <PainPointsCountBadge initialCount={painPoints.length} />
              </TabsTrigger>
              <TabsTrigger value="features" className="rounded-none px-3 py-1.5 text-xs shrink-0">
                <Lightbulb className="h-3 w-3" />
                Feature Requests
                <InsightCountBadge initialCount={featureRequests.length} insightTypes={["FEATURE_REQUEST"]} />
              </TabsTrigger>
              <TabsTrigger value="segments" className="rounded-none px-3 py-1.5 text-xs shrink-0">
                <Users className="h-3 w-3" />
                Segments
                <InsightCountBadge initialCount={segments.length} insightTypes={["USER_SEGMENT"]} />
              </TabsTrigger>
              <TabsTrigger value="workflow" className="rounded-none px-3 py-1.5 text-xs shrink-0">
                <Workflow className="h-3 w-3" />
                Workflow Issues
                <InsightCountBadge initialCount={workflowIssues.length} insightTypes={["WORKFLOW_ISSUE"]} />
              </TabsTrigger>
              <TabsTrigger value="competitors" className="rounded-none px-3 py-1.5 text-xs shrink-0">
                <Swords className="h-3 w-3" />
                Competitors
                <InsightCountBadge initialCount={competitors.length} insightTypes={["COMPETITIVE_MENTION"]} />
              </TabsTrigger>
              <TabsTrigger value="quotes" className="rounded-none px-3 py-1.5 text-xs shrink-0">
                <Quote className="h-3 w-3" />
                Quotes &amp; Signals
                <InsightCountBadge initialCount={quotes.length} insightTypes={["CHURN_REASON", "PRICING_FEEDBACK", "OBJECTION"]} />
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="pain-points">
            <PainPointsTabContent initialPainPoints={painPoints} workspaceId={workspaceId} />
          </TabsContent>
          <TabsContent value="features">
            <InsightTabContent initialInsights={featureRequests} insightTypes={["FEATURE_REQUEST"]} workspaceId={workspaceId} layout="grid" />
          </TabsContent>
          <TabsContent value="segments">
            <InsightTabContent initialInsights={segments} insightTypes={["USER_SEGMENT"]} workspaceId={workspaceId} layout="grid" />
          </TabsContent>
          <TabsContent value="workflow">
            <InsightTabContent initialInsights={workflowIssues} insightTypes={["WORKFLOW_ISSUE"]} workspaceId={workspaceId} layout="grid" />
          </TabsContent>
          <TabsContent value="competitors">
            <InsightTabContent initialInsights={competitors} insightTypes={["COMPETITIVE_MENTION"]} workspaceId={workspaceId} layout="grid" />
          </TabsContent>
          <TabsContent value="quotes">
            <InsightTabContent
              initialInsights={quotes}
              insightTypes={["CHURN_REASON", "PRICING_FEEDBACK", "OBJECTION"]}
              workspaceId={workspaceId}
              layout="list"
              emptyMessage="No signals extracted yet. Synthesize your workspace to surface churn reasons, pricing feedback, and objections."
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
