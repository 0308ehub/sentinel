import { prisma } from "@/lib/db/prisma";
import { ai } from "@/lib/ai/provider";
import type { RetrievedContext } from "@/types";

export async function retrieveWorkspaceContext({
  workspaceId,
  query,
  limit = 12,
}: {
  workspaceId: string;
  query: string;
  limit?: number;
}): Promise<RetrievedContext> {
  const queryEmbedding = await ai.embedText(query);
  const vectorStr = `[${queryEmbedding.join(",")}]`;

  // Raw vector similarity search
  const chunks = await prisma.$queryRaw<
    Array<{
      id: string;
      documentId: string;
      content: string;
      similarity: number;
      metadata: unknown;
    }>
  >`
    SELECT
      id,
      "documentId",
      content,
      metadata,
      1 - (embedding <=> ${vectorStr}::vector) AS similarity
    FROM "DocumentChunk"
    WHERE "workspaceId" = ${workspaceId}
      AND embedding IS NOT NULL
    ORDER BY embedding <=> ${vectorStr}::vector
    LIMIT ${limit}
  `;

  const [insights, painPoints, opportunities] = await Promise.all([
    prisma.insight.findMany({
      where: { workspaceId },
      orderBy: { confidence: "desc" },
      take: 20,
    }),
    prisma.painPoint.findMany({
      where: { workspaceId, status: "ACTIVE" },
      orderBy: { severity: "desc" },
      take: 20,
    }),
    prisma.opportunity.findMany({
      where: { workspaceId },
      orderBy: { totalScore: "desc" },
      take: 10,
    }),
  ]);

  return {
    chunks: chunks.map((c) => ({
      id: c.id,
      documentId: c.documentId,
      content: c.content,
      similarity: Number(c.similarity),
      metadata: c.metadata as Record<string, unknown> | undefined,
    })),
    insights,
    painPoints,
    opportunities,
  };
}

export function formatContextForPrompt(context: RetrievedContext): string {
  const parts: string[] = [];

  if (context.chunks.length > 0) {
    parts.push("## Relevant Evidence\n");
    context.chunks.forEach((c, i) => {
      parts.push(`### Evidence ${i + 1} (similarity: ${c.similarity.toFixed(2)})\n${c.content}`);
    });
  }

  if (context.painPoints.length > 0) {
    parts.push("\n## Top Pain Points\n");
    context.painPoints.slice(0, 8).forEach((p) => {
      parts.push(`- **${p.title}** (severity: ${p.severity}, urgency: ${p.urgency}): ${p.description}`);
    });
  }

  if (context.opportunities.length > 0) {
    parts.push("\n## Product Opportunities\n");
    context.opportunities.slice(0, 5).forEach((o) => {
      parts.push(`- **${o.title}** (score: ${o.totalScore.toFixed(1)}): ${o.problemStatement}`);
    });
  }

  return parts.join("\n");
}
