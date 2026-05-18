import { prisma } from "@/lib/db/prisma";
import { ai } from "@/lib/ai/provider";
import {
  LABEL_CLUSTER_PROMPT,
  ClusterLabelSchema,
} from "@/prompts/label-pain-point-cluster";
import { generateOpportunities } from "./opportunity-service";
import type { PainPointCluster } from "@/types";

const SIMILARITY_THRESHOLD = 0.82;

export async function synthesizeWorkspace(workspaceId: string) {
  // Fetch all pain points for this workspace
  const painPoints = await prisma.painPoint.findMany({
    where: { workspaceId, status: "ACTIVE" },
  });

  if (painPoints.length === 0) {
    return { painPoints: [], opportunities: [] };
  }

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

    labeledClusters.push({
      id: `cluster-${Math.random().toString(36).slice(2, 9)}`,
      title: label.title,
      description: label.description,
      evidenceQuotes,
      affectedSegments: label.affectedSegments.length > 0 ? label.affectedSegments : affectedSegments,
      frequency: clusterPainPoints.length,
      avgSeverity,
      avgUrgency,
      sourceDocumentIds: [...new Set(clusterPainPoints.flatMap((p) => p.evidenceIds))],
    });
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

  // Generate opportunities
  const opportunities = await generateOpportunities(workspaceId, labeledClusters);

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
