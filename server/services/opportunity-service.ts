import { prisma } from "@/lib/db/prisma";
import { ai } from "@/lib/ai/provider";
import {
  GENERATE_OPPORTUNITIES_PROMPT,
  OpportunityGenerationSchema,
} from "@/prompts/generate-opportunities";
import { calculateTotalScore } from "@/lib/scoring/opportunity-scorer";
import type { PainPointCluster } from "@/types";

export async function generateOpportunities(
  workspaceId: string,
  clusters?: PainPointCluster[]
) {
  // Fetch clusters from DB if not provided
  let painPointClusters = clusters;
  if (!painPointClusters) {
    const painPoints = await prisma.painPoint.findMany({
      where: { workspaceId, status: "ACTIVE" },
      orderBy: { severity: "desc" },
    });

    painPointClusters = painPoints.map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      evidenceQuotes: [],
      affectedSegments: p.affectedSegments,
      frequency: p.frequency,
      avgSeverity: p.severity,
      avgUrgency: p.urgency,
      sourceDocumentIds: p.evidenceIds,
    }));
  }

  if (painPointClusters.length === 0) return [];

  const prompt = `Workspace pain point clusters:\n\n${painPointClusters
    .map(
      (c) =>
        `**${c.title}** (frequency: ${c.frequency}, severity: ${c.avgSeverity.toFixed(1)}, urgency: ${c.avgUrgency.toFixed(1)})\n${c.description}\nAffected segments: ${c.affectedSegments.join(", ")}`
    )
    .join("\n\n")}`;

  const result = await ai.generateObject({
    system: GENERATE_OPPORTUNITIES_PROMPT,
    prompt,
    schema: OpportunityGenerationSchema,
    temperature: 0.4,
    maxTokens: 8192,
  });

  // Delete existing opportunities for fresh synthesis
  await prisma.opportunity.deleteMany({ where: { workspaceId } });

  const created = await Promise.all(
    result.opportunities.map(async (opp) => {
      const totalScore = calculateTotalScore({
        impact: opp.scores.impact.value,
        confidence: opp.scores.confidence.value,
        urgency: opp.scores.urgency.value,
        effort: opp.scores.effort.value,
        risk: opp.scores.risk.value,
      });

      return prisma.opportunity.create({
        data: {
          workspaceId,
          title: opp.title,
          description: opp.description,
          problemStatement: opp.problemStatement,
          proposedSolution: opp.proposedSolution,
          targetSegments: opp.targetSegments,
          evidenceIds: opp.supportingEvidence.map((e) => e.quote).slice(0, 10),
          impactScore: opp.scores.impact.value,
          confidenceScore: opp.scores.confidence.value,
          urgencyScore: opp.scores.urgency.value,
          effortScore: opp.scores.effort.value,
          riskScore: opp.scores.risk.value,
          totalScore,
          status: "PROPOSED",
        },
      });
    })
  );

  await prisma.productEvent.create({
    data: {
      workspaceId,
      event: "opportunities_generated",
      properties: { count: created.length },
    },
  });

  return created.sort((a, b) => b.totalScore - a.totalScore);
}
