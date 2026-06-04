import { prisma } from "@/lib/db/prisma";
import { ai } from "@/lib/ai/provider";
import {
  LABEL_CLUSTER_PROMPT,
  ClusterLabelSchema,
} from "@/prompts/label-pain-point-cluster";
import { generateOpportunities } from "./opportunity-service";
import { repopulateInsightsFromExtractions, extractDocumentInsights } from "./extraction-service";
import type { StreamingInsight } from "./extraction-service";
import type { StreamingOpportunity } from "./opportunity-service";
import type { PainPointCluster } from "@/types";

const SIMILARITY_THRESHOLD = 0.82;

export interface StreamingPainPoint {
  title: string;
  description: string;
  severity: number;
  urgency: number;
  frequency: number;
  affectedSegments: string[];
}

// Fast-path synthesis: extract insights inline from rawText for any document
// that has text but no extraction yet. Status doesn't matter — rawText is
// available as soon as the upload is parsed, before chunking/embedding finish.
export async function extractRawInsightsFromPendingDocs(
  workspaceId: string
): Promise<void> {
  const docsNeedingExtraction = await prisma.document.findMany({
    where: {
      workspaceId,
      status: { not: "FAILED" },
      rawText: { not: null },
      extractions: { none: {} },
    },
    select: { id: true, rawText: true },
    take: 10,
  });

  const eligible = docsNeedingExtraction.filter(
    (d) => (d.rawText?.length ?? 0) >= 100
  );
  await Promise.allSettled(eligible.map((d) => extractDocumentInsights(d.id)));
}

export async function synthesizeWorkspace(
  workspaceId: string,
  onProgress?: (step: string) => void,
  onPainPoint?: (pp: StreamingPainPoint) => void,
  onInsight?: (insight: StreamingInsight) => void,
  onOpportunity?: (opp: StreamingOpportunity) => void,
  onInsightsDone?: () => void
) {
  // Fast-path: extract insights from any docs that have rawText but haven't
  // been processed yet, so synthesis isn't blocked on the background pipeline.
  await extractRawInsightsFromPendingDocs(workspaceId);

  onProgress?.("Loading pain points...");
  // Fetch all pain points for this workspace
  let painPoints = await prisma.painPoint.findMany({
    where: { workspaceId, status: "ACTIVE" },
  });

  // If synthesis was cleared but documents still have stored extractions, restore from them.
  if (painPoints.length === 0) {
    const docCount = await prisma.document.count({ where: { workspaceId, status: "COMPLETED" } });
    if (docCount > 0) {
      onProgress?.("Restoring insights from stored extractions...");
      await repopulateInsightsFromExtractions(workspaceId, onInsight);
      onInsightsDone?.(); // signal: extraction phase is complete, no more insight events
      painPoints = await prisma.painPoint.findMany({ where: { workspaceId, status: "ACTIVE" } });
    }
  }

  if (painPoints.length === 0) {
    return { painPoints: [], opportunities: [] };
  }

  onProgress?.(`Embedding ${painPoints.length} pain point${painPoints.length === 1 ? "" : "s"}...`);
  // Embed all pain points
  const texts = painPoints.map((p) => `${p.title}: ${p.description}`);
  const embeddings = await ai.embedTexts(texts);

  // Cluster by cosine similarity
  const clusters: Array<{
    indices: number[];
    centroid: number[];
  }> = [];

  for (let i = 0; i < painPoints.length; i++) {
    const emb = embeddings[i];
    let assigned = false;

    for (const cluster of clusters) {
      const sim = cosineSimilarity(emb, cluster.centroid);
      if (sim >= SIMILARITY_THRESHOLD) {
        cluster.indices.push(i);
        cluster.centroid = averageVectors([...cluster.indices.map((idx) => embeddings[idx])]);
        assigned = true;
        break;
      }
    }

    if (!assigned) {
      clusters.push({ indices: [i], centroid: emb });
    }
  }

  onProgress?.(`Grouped into ${clusters.length} cluster${clusters.length === 1 ? "" : "s"}, labeling...`);
  // Label each cluster with LLM
  const labeledClusters: PainPointCluster[] = [];

  for (const cluster of clusters) {
    const clusterPainPoints = cluster.indices.map((i) => painPoints[i]);
    const evidenceQuotes = clusterPainPoints
      .flatMap((p) => (p.evidenceIds ?? []))
      .slice(0, 10);
    const affectedSegments = [
      ...new Set(clusterPainPoints.flatMap((p) => p.affectedSegments)),
    ];

    const prompt = `Pain points in this cluster:\n${clusterPainPoints
      .map((p) => `- ${p.title}: ${p.description} (severity: ${p.severity}, urgency: ${p.urgency})`)
      .join("\n")}`;

    const label = await ai.generateObject({
      system: LABEL_CLUSTER_PROMPT,
      prompt,
      schema: ClusterLabelSchema,
      temperature: 0.3,
    });

    const avgSeverity =
      clusterPainPoints.reduce((s, p) => s + p.severity, 0) / clusterPainPoints.length;
    const avgUrgency =
      clusterPainPoints.reduce((s, p) => s + p.urgency, 0) / clusterPainPoints.length;

    const resolvedSegments = label.affectedSegments.length > 0 ? label.affectedSegments : affectedSegments;
    labeledClusters.push({
      id: `cluster-${Math.random().toString(36).slice(2, 9)}`,
      title: label.title,
      description: label.description,
      evidenceQuotes,
      affectedSegments: resolvedSegments,
      frequency: clusterPainPoints.length,
      avgSeverity,
      avgUrgency,
      sourceDocumentIds: [...new Set(clusterPainPoints.flatMap((p) => p.evidenceIds))],
    });
    onPainPoint?.({ title: label.title, description: label.description, severity: avgSeverity, urgency: avgUrgency, frequency: clusterPainPoints.length, affectedSegments: resolvedSegments });
  }

  // Update existing PainPoints with cluster info (deduplicate)
  // For MVP, mark older duplicates as solved and keep the representative one
  const updatedPainPoints = await Promise.all(
    labeledClusters.map(async (cluster) => {
      const rep = painPoints[clusters[labeledClusters.indexOf(cluster)].indices[0]];
      return prisma.painPoint.update({
        where: { id: rep.id },
        data: {
          title: cluster.title,
          description: cluster.description,
          frequency: cluster.frequency,
          affectedSegments: cluster.affectedSegments,
        },
      });
    })
  );

  onProgress?.("Updating pain point clusters...");
  // Generate opportunities
  const opportunities = await generateOpportunities(workspaceId, labeledClusters, onProgress, onOpportunity);

  // Track event
  await prisma.productEvent.create({
    data: {
      workspaceId,
      event: "workspace_synthesized",
      properties: {
        clusterCount: labeledClusters.length,
        opportunityCount: opportunities.length,
      },
    },
  });

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { lastSynthesizedAt: new Date() },
  });

  return { painPoints: updatedPainPoints, opportunities };
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function averageVectors(vecs: number[][]): number[] {
  const dim = vecs[0].length;
  const result = new Array(dim).fill(0);
  for (const v of vecs) {
    for (let i = 0; i < dim; i++) result[i] += v[i];
  }
  return result.map((x) => x / vecs.length);
}
