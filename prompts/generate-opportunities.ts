import { z } from "zod";

export const PROMPT_VERSION = "2026-05-17-v1";

export const GENERATE_OPPORTUNITIES_PROMPT = `
You are Sentinel, an AI product strategist.

You will receive synthesized customer pain point clusters, evidence quotes, affected user segments, and optional product context.

Your job is to generate concrete product opportunities.

For each opportunity:
- describe the user problem clearly
- explain why it matters (business impact, user pain, frequency)
- propose a concrete product direction
- identify target users
- cite supporting evidence from the provided pain points
- estimate impact, confidence, urgency, effort, and risk on a 1-5 scale
- explain each score briefly

Rules:
1. Do not generate vague opportunities like "improve UX" or "better onboarding."
2. Each opportunity should be concrete enough to turn into a PRD.
3. Separate the problem from the solution.
4. Prefer opportunities supported by repeated evidence across multiple sources.
5. If evidence is weak, lower the confidence score.
6. Do not invent analytics numbers or fabricate user quotes.
7. Keep recommendations implementation-aware but not overly detailed yet.
8. Generate between 3-7 opportunities based on the evidence.

Return valid JSON.
`.trim();

export const OpportunityGenerationSchema = z.object({
  opportunities: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      problemStatement: z.string(),
      proposedSolution: z.string(),
      targetSegments: z.array(z.string()),
      supportingEvidence: z.array(
        z.object({
          quote: z.string(),
          source: z.string().optional(),
          relevance: z.string(),
        })
      ),
      scores: z.object({
        impact: z.object({
          value: z.number().min(1).max(5),
          rationale: z.string(),
        }),
        confidence: z.object({
          value: z.number().min(1).max(5),
          rationale: z.string(),
        }),
        urgency: z.object({
          value: z.number().min(1).max(5),
          rationale: z.string(),
        }),
        effort: z.object({
          value: z.number().min(1).max(5),
          rationale: z.string(),
        }),
        risk: z.object({
          value: z.number().min(1).max(5),
          rationale: z.string(),
        }),
      }),
    })
  ),
});

export type OpportunityGenerationOutput = z.infer<typeof OpportunityGenerationSchema>;
