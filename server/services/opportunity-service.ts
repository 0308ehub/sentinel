import { prisma } from "@/lib/db/prisma";
import { ai } from "@/lib/ai/provider";
import {
  GENERATE_OPPORTUNITIES_PROMPT,
  OpportunityGenerationSchema,
} from "@/prompts/generate-opportunities";
import { calculateTotalScore } from "@/lib/scoring/opportunity-scorer";
import { repopulateInsightsFromExtractions } from "./extraction-service";
import type { PainPointCluster } from "@/types";

export interface StreamingOpportunity {
  title: string;
  description: string;
  totalScore: number;
  impactScore: number;
  urgencyScore: number;
  targetSegments: string[];
}

export async function generateOpportunities(
  workspaceId: string,
  clusters?: PainPointCluster[],
  onProgress?: (step: string) => void,
  onOpportunity?: (opp: StreamingOpportunity) => void
) {
  // Fetch clusters from DB if not provided
  let painPointClusters = clusters;
  if (!painPointClusters) {
    onProgress?.("Loading pain points...");
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

  if (painPointClusters.length === 0) {
    // No pain points in DB — try restoring from stored document extractions so
    // the user doesn't have to visit Insights first.
    const docCount = await prisma.document.count({
      where: { workspaceId, status: "COMPLETED" },
    });

    if (docCount === 0) {
      throw new Error(
        "No processed documents found. Upload and process documents before generating opportunities."
      );
    }

    onProgress?.("Restoring pain points from your documents…");
    await repopulateInsightsFromExtractions(workspaceId);

    const restored = await prisma.painPoint.findMany({
      where: { workspaceId, status: "ACTIVE" },
      orderBy: { severity: "desc" },
    });

    if (restored.length === 0) {
      throw new Error(
        "No pain points could be extracted from your documents. Try re-processing them on the Documents page."
      );
    }

    painPointClusters = restored.map((p) => ({
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

  onProgress?.(`Analyzing ${painPointClusters.length} pain point cluster${painPointClusters.length === 1 ? "" : "s"}...`);

  const prompt = `Workspace pain point clusters:\n\n${painPointClusters
    .map(
      (c) =>
        `**${c.title}** (frequency: ${c.frequency}, severity: ${c.avgSeverity.toFixed(1)}, urgency: ${c.avgUrgency.toFixed(1)})\n${c.description}\nAffected segments: ${c.affectedSegments.join(", ")}`
    )
    .join("\n\n")}`;

  onProgress?.("Generating opportunities with AI...");
  const result = await ai.generateObject({
    system: GENERATE_OPPORTUNITIES_PROMPT,
    prompt,
    schema: OpportunityGenerationSchema,
    temperature: 0.4,
    maxTokens: 8192,
  });

  onProgress?.(`Saving ${result.opportunities.length} opportunit${result.opportunities.length === 1 ? "y" : "ies"}...`);
  // Delete existing opportunities for fresh synthesis
  await prisma.opportunity.deleteMany({ where: { workspaceId } });

  // Save sequentially so each opportunity can be streamed to the client as it lands.
  const created = [];
  for (const opp of result.opportunities) {
    const totalScore = calculateTotalScore({
      impact: opp.scores.impact.value,
      confidence: opp.scores.confidence.value,
      urgency: opp.scores.urgency.value,
      effort: opp.scores.effort.value,
      risk: opp.scores.risk.value,
    });

    const record = await prisma.opportunity.create({
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

    onOpportunity?.({
      title: record.title,
      description: record.description,
      totalScore: record.totalScore,
      impactScore: record.impactScore,
      urgencyScore: record.urgencyScore,
      targetSegments: record.targetSegments,
    });
    created.push(record);
  }

  await prisma.productEvent.create({
    data: {
      workspaceId,
      event: "opportunities_generated",
      properties: { count: created.length },
    },
  });

  return created.sort((a, b) => b.totalScore - a.totalScore);
}
