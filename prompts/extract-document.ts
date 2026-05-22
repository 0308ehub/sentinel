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

Scoring rules (use the FULL range — do not default to middle values):
1. Do not invent facts. Every point must be grounded in the document.
2. Prefer specific evidence over vague summaries. Preserve exact quotes.
3. If the document contains little product signal, return sparse arrays.
4. severity (1–10): 1–3 = minor annoyance, 4–6 = significant friction blocking a workflow, 7–9 = business-critical / causes churn risk, 10 = existential blocker. Use the full scale.
5. urgency (1–10): 1–3 = nice-to-have, 4–6 = user would switch if fixed, 7–9 = user mentioned canceling or explicit deadline, 10 = user already churned or will imminently. Use the full scale.
6. confidence (0.0–1.0) per insight — YOU MUST DIFFERENTIATE. Do NOT return 0.7 for every item:
   - Inferred / no direct quote → 0.25–0.45
   - One indirect or hedged mention → 0.45–0.58
   - One clear direct quote → 0.60–0.70
   - Two direct quotes or explicitly stated → 0.72–0.84
   - Three or more quotes, or unanimous strong signal → 0.85–0.97
   CRITICAL: returning the same confidence for every item is wrong. Scores must reflect the actual evidence strength of each specific item.
7. Differentiate scores: items with more evidence quotes, stronger language, or explicit churn signals must score higher than items with weak or hedged evidence.

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
      severity: z.number().min(1).max(10),
      urgency: z.number().min(1).max(10),
      confidence: z.number().min(0).max(1),
      evidenceQuotes: z.array(z.string()),
      affectedSegments: z.array(z.string()),
    })
  ),
  featureRequests: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      confidence: z.number().min(0).max(1),
      requesterType: z.string().optional(),
      evidenceQuotes: z.array(z.string()),
    })
  ),
  workflowIssues: z.array(
    z.object({
      title: z.string(),
      currentWorkflow: z.string(),
      breakdownPoint: z.string(),
      confidence: z.number().min(0).max(1),
      evidenceQuotes: z.array(z.string()),
    })
  ),
  objections: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      confidence: z.number().min(0).max(1),
      evidenceQuotes: z.array(z.string()),
    })
  ),
  competitorMentions: z.array(
    z.object({
      competitor: z.string(),
      context: z.string(),
      sentiment: z.enum(["positive", "negative", "neutral"]),
      confidence: z.number().min(0).max(1),
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
