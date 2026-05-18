import { prisma } from "@/lib/db/prisma";
import { ai } from "@/lib/ai/provider";
import {
  EXTRACT_DOCUMENT_PROMPT,
  DocumentExtractionSchema,
  type DocumentExtractionOutput,
} from "@/prompts/extract-document";
import type { InsightType } from "@prisma/client";

export async function extractDocumentInsights(documentId: string) {
  const document = await prisma.document.findUniqueOrThrow({
    where: { id: documentId },
    select: { rawText: true, workspaceId: true, title: true },
  });

  const text = document.rawText ?? "";
  if (!text.trim()) return null;

  // If text is very long, truncate to ~60k chars (enough for context)
  const truncated = text.length > 60000 ? text.slice(0, 60000) + "\n\n[Document truncated]" : text;

  const extraction = await ai.generateObject<DocumentExtractionOutput>({
    system: EXTRACT_DOCUMENT_PROMPT,
    prompt: `Document title: ${document.title}\n\nDocument content:\n\n${truncated}`,
    schema: DocumentExtractionSchema,
    temperature: 0.2,
    maxTokens: 8192,
  });

  // Save raw extraction
  const savedExtraction = await prisma.documentExtraction.create({
    data: {
      documentId,
      summary: extraction.documentSummary,
      extractedJson: extraction as unknown as Record<string, string>,
    },
  });

  // Persist pain points as Insights + PainPoints
  const { workspaceId } = document;

  const insightCreates: Promise<unknown>[] = [];

  // Feature requests → Insights
  for (const fr of extraction.featureRequests) {
    insightCreates.push(
      prisma.insight.create({
        data: {
          workspaceId,
          type: "FEATURE_REQUEST" as InsightType,
          title: fr.title,
          description: fr.description,
          confidence: 0.7,
          evidenceIds: [documentId],
          metadata: { quotes: fr.evidenceQuotes, requesterType: fr.requesterType },
        },
      })
    );
  }

  // Workflow issues → Insights
  for (const wi of extraction.workflowIssues) {
    insightCreates.push(
      prisma.insight.create({
        data: {
          workspaceId,
          type: "WORKFLOW_ISSUE" as InsightType,
          title: wi.title,
          description: `Current: ${wi.currentWorkflow}. Breakdown: ${wi.breakdownPoint}`,
          confidence: 0.75,
          evidenceIds: [documentId],
          metadata: { quotes: wi.evidenceQuotes },
        },
      })
    );
  }

  // Competitor mentions → Insights
  for (const cm of extraction.competitorMentions) {
    insightCreates.push(
      prisma.insight.create({
        data: {
          workspaceId,
          type: "COMPETITIVE_MENTION" as InsightType,
          title: `${cm.competitor} mention`,
          description: cm.context,
          confidence: 0.8,
          evidenceIds: [documentId],
          metadata: { sentiment: cm.sentiment, quotes: cm.evidenceQuotes },
        },
      })
    );
  }

  // User segments → Insights
  for (const seg of extraction.userSegments) {
    insightCreates.push(
      prisma.insight.create({
        data: {
          workspaceId,
          type: "USER_SEGMENT" as InsightType,
          title: seg.name,
          description: seg.description,
          confidence: 0.65,
          evidenceIds: [documentId],
          metadata: { evidence: seg.evidence },
        },
      })
    );
  }

  // Pain points → PainPoints
  for (const pp of extraction.painPoints) {
    insightCreates.push(
      prisma.painPoint.create({
        data: {
          workspaceId,
          title: pp.title,
          description: pp.description,
          severity: pp.severity,
          frequency: 1,
          urgency: pp.urgency,
          affectedSegments: pp.affectedSegments,
          evidenceIds: [documentId],
          status: "ACTIVE",
        },
      })
    );
  }

  await Promise.all(insightCreates);
  return savedExtraction;
}
