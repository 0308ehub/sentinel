import { prisma } from "@/lib/db/prisma";
import { ai } from "@/lib/ai/provider";
import {
  EXTRACT_DOCUMENT_PROMPT,
  DocumentExtractionSchema,
  type DocumentExtractionOutput,
} from "@/prompts/extract-document";
import type { InsightType } from "@prisma/client";

/** Lightweight insight shape streamed to the client during synthesis. */
export interface StreamingInsight {
  /** InsightType string value — safe to serialize over SSE. */
  type: string;
  title: string;
  description: string;
  confidence: number;
}

// Evidence-weighted confidence: caps no-quote items and meaningfully rewards quotes.
// Prevents LLM from clustering everything at 0.7.
function weightedConfidence(llmScore: number, quoteCount: number): number {
  if (quoteCount === 0) return Math.min(llmScore, 0.62);
  const boost = Math.min(0.28, quoteCount * 0.09);
  return Math.min(0.97, llmScore + boost);
}

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
    const confidence = weightedConfidence(fr.confidence, fr.evidenceQuotes.length);
    insightCreates.push(
      prisma.insight.create({
        data: {
          workspaceId,
          type: "FEATURE_REQUEST" as InsightType,
          title: fr.title,
          description: fr.description,
          confidence,
          evidenceIds: [documentId],
          metadata: { quotes: fr.evidenceQuotes, requesterType: fr.requesterType },
        },
      })
    );
  }

  // Workflow issues → Insights
  for (const wi of extraction.workflowIssues) {
    const confidence = weightedConfidence(wi.confidence, wi.evidenceQuotes.length);
    insightCreates.push(
      prisma.insight.create({
        data: {
          workspaceId,
          type: "WORKFLOW_ISSUE" as InsightType,
          title: wi.title,
          description: `Current: ${wi.currentWorkflow}. Breakdown: ${wi.breakdownPoint}`,
          confidence,
          evidenceIds: [documentId],
          metadata: { quotes: wi.evidenceQuotes },
        },
      })
    );
  }

  // Competitor mentions → Insights
  for (const cm of extraction.competitorMentions) {
    const confidence = weightedConfidence(cm.confidence, cm.evidenceQuotes.length);
    insightCreates.push(
      prisma.insight.create({
        data: {
          workspaceId,
          type: "COMPETITIVE_MENTION" as InsightType,
          title: `${cm.competitor} mention`,
          description: cm.context,
          confidence,
          evidenceIds: [documentId],
          metadata: { sentiment: cm.sentiment, quotes: cm.evidenceQuotes },
        },
      })
    );
  }

  // User segments → Insights (no LLM confidence field — derive from evidence count)
  for (const seg of extraction.userSegments) {
    const confidence = Math.min(0.92, 0.5 + seg.evidence.length * 0.08);
    insightCreates.push(
      prisma.insight.create({
        data: {
          workspaceId,
          type: "USER_SEGMENT" as InsightType,
          title: seg.name,
          description: seg.description,
          confidence,
          evidenceIds: [documentId],
          metadata: { evidence: seg.evidence },
        },
      })
    );
  }

  // Objections → Insights
  for (const obj of extraction.objections) {
    const confidence = weightedConfidence(obj.confidence, obj.evidenceQuotes.length);
    insightCreates.push(
      prisma.insight.create({
        data: {
          workspaceId,
          type: "OBJECTION" as InsightType,
          title: obj.title,
          description: obj.description,
          confidence,
          evidenceIds: [documentId],
          metadata: { quotes: obj.evidenceQuotes },
        },
      })
    );
  }

  // Pain points → PainPoints
  // frequency = number of evidence quotes (proxy for how often this was mentioned)
  for (const pp of extraction.painPoints) {
    const frequency = Math.max(1, pp.evidenceQuotes.length);
    insightCreates.push(
      prisma.painPoint.create({
        data: {
          workspaceId,
          title: pp.title,
          description: pp.description,
          severity: pp.severity,
          frequency,
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

// Re-creates PainPoint and Insight records from stored DocumentExtraction JSON.
// Used by synthesis when records were cleared but documents were not re-uploaded.
// Older extractions may be missing `confidence` on individual items — fall back to
// a quote-count-derived estimate so we never write NaN to the DB.
export async function repopulateInsightsFromExtractions(
  workspaceId: string,
  onInsight?: (insight: StreamingInsight) => void
): Promise<void> {
  const documents = await prisma.document.findMany({
    where: { workspaceId, status: "COMPLETED" },
    include: { extractions: { orderBy: { createdAt: "desc" }, take: 1 } },
  });

  // Safely coerce a potentially-missing confidence value before passing to weightedConfidence.
  function safeConf(raw: unknown, quoteCount: number): number {
    const n = typeof raw === "number" && isFinite(raw) ? raw : 0.5 + Math.min(quoteCount * 0.04, 0.2);
    return weightedConfidence(n, quoteCount);
  }

  // All DB creates run in parallel (maximum throughput). Each individual promise
  // calls onInsight only after ITS own write resolves — the natural spread in
  // completion times causes SSE events to arrive in separate HTTP flushes so the
  // client sees cards trickle in, not all at once.
  const perInsightPromises: Promise<void>[] = [];

  for (const doc of documents) {
    const raw = doc.extractions[0];
    if (!raw) continue;
    const data = raw.extractedJson as unknown as DocumentExtractionOutput;
    const documentId = doc.id;

    for (const fr of (data.featureRequests ?? [])) {
      const confidence = safeConf(fr.confidence, fr.evidenceQuotes.length);
      perInsightPromises.push(
        prisma.insight.create({ data: { workspaceId, type: "FEATURE_REQUEST" as InsightType, title: fr.title, description: fr.description, confidence, evidenceIds: [documentId], metadata: { quotes: fr.evidenceQuotes, requesterType: fr.requesterType } } })
          .then(() => { onInsight?.({ type: "FEATURE_REQUEST", title: fr.title, description: fr.description, confidence }); })
      );
    }
    for (const wi of (data.workflowIssues ?? [])) {
      const confidence = safeConf(wi.confidence, wi.evidenceQuotes.length);
      const description = `Current: ${wi.currentWorkflow}. Breakdown: ${wi.breakdownPoint}`;
      perInsightPromises.push(
        prisma.insight.create({ data: { workspaceId, type: "WORKFLOW_ISSUE" as InsightType, title: wi.title, description, confidence, evidenceIds: [documentId], metadata: { quotes: wi.evidenceQuotes } } })
          .then(() => { onInsight?.({ type: "WORKFLOW_ISSUE", title: wi.title, description, confidence }); })
      );
    }
    for (const cm of (data.competitorMentions ?? [])) {
      const confidence = safeConf(cm.confidence, cm.evidenceQuotes.length);
      const title = `${cm.competitor} mention`;
      perInsightPromises.push(
        prisma.insight.create({ data: { workspaceId, type: "COMPETITIVE_MENTION" as InsightType, title, description: cm.context, confidence, evidenceIds: [documentId], metadata: { sentiment: cm.sentiment, quotes: cm.evidenceQuotes } } })
          .then(() => { onInsight?.({ type: "COMPETITIVE_MENTION", title, description: cm.context, confidence }); })
      );
    }
    for (const seg of (data.userSegments ?? [])) {
      const confidence = Math.min(0.92, 0.5 + seg.evidence.length * 0.08);
      perInsightPromises.push(
        prisma.insight.create({ data: { workspaceId, type: "USER_SEGMENT" as InsightType, title: seg.name, description: seg.description, confidence, evidenceIds: [documentId], metadata: { evidence: seg.evidence } } })
          .then(() => { onInsight?.({ type: "USER_SEGMENT", title: seg.name, description: seg.description, confidence }); })
      );
    }
    for (const obj of (data.objections ?? [])) {
      const confidence = safeConf(obj.confidence, obj.evidenceQuotes.length);
      perInsightPromises.push(
        prisma.insight.create({ data: { workspaceId, type: "OBJECTION" as InsightType, title: obj.title, description: obj.description, confidence, evidenceIds: [documentId], metadata: { quotes: obj.evidenceQuotes } } })
          .then(() => { onInsight?.({ type: "OBJECTION", title: obj.title, description: obj.description, confidence }); })
      );
    }
    for (const pp of (data.painPoints ?? [])) {
      perInsightPromises.push(
        prisma.painPoint.create({ data: { workspaceId, title: pp.title, description: pp.description, severity: pp.severity, frequency: Math.max(1, pp.evidenceQuotes.length), urgency: pp.urgency, affectedSegments: pp.affectedSegments, evidenceIds: [documentId], status: "ACTIVE" } })
          .then(() => {})
      );
    }
  }

  await Promise.all(perInsightPromises);
}
