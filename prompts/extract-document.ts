import { z } from "zod";

export const PROMPT_VERSION = "2026-05-17-v1";

export const EXTRACT_DOCUMENT_PROMPT = `
You are Sentinel, an AI product discovery analyst.

Your job is to extract structured product discovery insights from the provided document.

Focus only on information that would help a product manager decide what to build next.

Extract:
- pain points
- feature requests
- workflow issues
- user segments
- objections
- competitor mentions
- important quotes
- signals of urgency or severity

Rules:
1. Do not invent facts.
2. Every extracted point must be grounded in the document.
3. Prefer specific evidence over vague summaries.
4. Preserve exact quotes when useful.
5. If the document contains little product signal, return sparse arrays.
6. Severity should reflect user pain, business impact, or repeated frustration (1-5 scale).
7. Urgency should reflect explicit immediacy, churn risk, blocker language, or workflow disruption (1-5 scale).

Return valid JSON matching the required schema.
`.trim();

export const DocumentExtractionSchema = z.object({
  documentSummary: z.string(),
  sourceTypeGuess: z.enum([
    "customer_interview",
    "support_ticket",
    "analytics_export",
    "sales_call",
    "user_feedback",
    "internal_doc",
    "market_research",
    "unknown",
  ]),
  userSegments: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      evidence: z.array(z.string()),
    })
  ),
  painPoints: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      severity: z.number().min(1).max(5),
      urgency: z.number().min(1).max(5),
      evidenceQuotes: z.array(z.string()),
      affectedSegments: z.array(z.string()),
    })
  ),
  featureRequests: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      requesterType: z.string().optional(),
      evidenceQuotes: z.array(z.string()),
    })
  ),
  workflowIssues: z.array(
    z.object({
      title: z.string(),
      currentWorkflow: z.string(),
      breakdownPoint: z.string(),
      evidenceQuotes: z.array(z.string()),
    })
  ),
  objections: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      evidenceQuotes: z.array(z.string()),
    })
  ),
  competitorMentions: z.array(
    z.object({
      competitor: z.string(),
      context: z.string(),
      sentiment: z.enum(["positive", "negative", "neutral"]),
      evidenceQuotes: z.array(z.string()),
    })
  ),
  importantQuotes: z.array(
    z.object({
      quote: z.string(),
      speakerType: z.string().optional(),
      whyItMatters: z.string(),
    })
  ),
});

export type DocumentExtractionOutput = z.infer<typeof DocumentExtractionSchema>;
