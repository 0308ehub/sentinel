import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/helpers";

export type PipelineStepKey = "synthesize" | "opportunities" | "prd" | "tickets" | "summary";

export interface PipelineStatusStep {
  key: PipelineStepKey;
  needsRun: boolean;
  label: string;
  reason: string;
}

export interface PipelineStatusResponse {
  canRun: boolean;
  blockedReason: string | null;
  steps: PipelineStatusStep[];
  topOpportunityId: string | null;
  latestPrdId: string | null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params;
    await requireWorkspaceAccess(workspaceId);

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      completedDocCount,
      latestCompletedDoc,
      painPointAggregate,
      opportunityCount,
      topOpportunity,
      ticketCount,
      latestPRD,
      recentSummary,
    ] = await Promise.all([
      prisma.document.count({ where: { workspaceId, status: "COMPLETED" } }),
      prisma.document.findFirst({
        where: { workspaceId, status: "COMPLETED" },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      prisma.painPoint.aggregate({
        where: { workspaceId },
        _count: { id: true },
        _max: { createdAt: true },
      }),
      prisma.opportunity.count({ where: { workspaceId } }),
      prisma.opportunity.findFirst({
        where: { workspaceId },
        orderBy: { totalScore: "desc" },
        include: { prds: { select: { id: true }, take: 1 } },
      }),
      prisma.engineeringTicket.count({ where: { workspaceId } }),
      prisma.pRD.findFirst({
        where: { workspaceId },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      }),
      prisma.productEvent.findFirst({
        where: {
          workspaceId,
          event: "EXECUTIVE_SUMMARY",
          createdAt: { gte: sevenDaysAgo },
        },
        select: { id: true },
      }),
    ]);

    if (completedDocCount === 0) {
      return Response.json({
        canRun: false,
        blockedReason: "Upload documents first",
        steps: [],
        topOpportunityId: null,
        latestPrdId: null,
      } satisfies PipelineStatusResponse);
    }

    const painPointCount = painPointAggregate._count.id;
    const maxPainPointAt = painPointAggregate._max.createdAt;

    const synthesizeNeedsRun =
      painPointCount === 0 ||
      (latestCompletedDoc !== null &&
        maxPainPointAt !== null &&
        latestCompletedDoc.createdAt > maxPainPointAt);

    const opportunitiesNeedsRun =
      synthesizeNeedsRun || (painPointCount > 0 && opportunityCount === 0);

    const prdNeedsRun =
      topOpportunity !== null && topOpportunity.prds.length === 0;

    const ticketsNeedsRun = latestPRD !== null && ticketCount === 0;

    const summaryNeedsRun = recentSummary === null && opportunityCount > 0;

    const steps: PipelineStatusStep[] = [
      {
        key: "synthesize",
        needsRun: synthesizeNeedsRun,
        label: "Synthesize insights",
        reason: synthesizeNeedsRun
          ? painPointCount === 0
            ? "No insights yet"
            : "New documents since last run"
          : "Already up to date",
      },
      {
        key: "opportunities",
        needsRun: opportunitiesNeedsRun,
        label: "Generate opportunities",
        reason: opportunitiesNeedsRun
          ? opportunityCount === 0
            ? "No opportunities yet"
            : "Will run after synthesis"
          : "Already up to date",
      },
      {
        key: "prd",
        needsRun: prdNeedsRun,
        label: "Generate PRD",
        reason: prdNeedsRun
          ? "Top opportunity has no PRD"
          : topOpportunity === null
          ? "No opportunities yet"
          : "PRD already exists",
      },
      {
        key: "tickets",
        needsRun: ticketsNeedsRun,
        label: "Generate tickets",
        reason: ticketsNeedsRun
          ? "No tickets yet"
          : ticketCount > 0
          ? `${ticketCount} tickets already exist`
          : "No PRD yet",
      },
      {
        key: "summary",
        needsRun: summaryNeedsRun,
        label: "Executive summary",
        reason: summaryNeedsRun
          ? "No summary in the last 7 days"
          : recentSummary !== null
          ? "Generated recently"
          : "No opportunities yet",
      },
    ];

    const anyNeedsRun = steps.some((s) => s.needsRun);

    return Response.json({
      canRun: anyNeedsRun,
      blockedReason: anyNeedsRun ? null : "Everything is up to date",
      steps,
      topOpportunityId: topOpportunity?.id ?? null,
      latestPrdId: latestPRD?.id ?? null,
    } satisfies PipelineStatusResponse);
  } catch (error) {
    console.error("[pipeline/status]", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
