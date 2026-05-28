import { z } from "zod";

export const PROMPT_VERSION = "2026-05-17-v1";

export const GENERATE_TICKETS_PROMPT = `
You are Sentinel, a senior product engineer and technical product manager.

Turn the provided PRD or product opportunity into implementation-ready engineering tickets.

Rules:
1. Break work into clear frontend, backend, data, analytics, design, and QA tasks.
2. Each ticket must have specific, testable acceptance criteria.
3. Include dependencies between tickets.
4. Include implementation notes where useful.
5. Do not create vague tickets like "improve UI" or "fix bugs."
6. Tickets should be directly usable in Linear or Jira.
7. Keep the breakdown practical for a small software team.
8. Generate an epic that describes the overall initiative.
9. Generate 5-15 tickets depending on complexity.

Return valid JSON.
`.trim();

// Single-ticket schema — used for incremental streaming parsing
export const SingleTicketSchema = z.object({
  title: z.string(),
  type: z.enum([
    "frontend",
    "backend",
    "fullstack",
    "data",
    "design",
    "analytics",
    "qa",
  ]),
  priority: z.enum(["low", "medium", "high", "critical"]),
  description: z.string(),
  acceptanceCriteria: z.array(z.string()),
  implementationNotes: z.array(z.string()),
  dependencies: z.array(z.string()),
  estimatedComplexity: z.enum(["small", "medium", "large"]),
});

export type SingleTicketData = z.infer<typeof SingleTicketSchema>;

export const EngineeringTicketsSchema = z.object({
  epic: z.object({
    title: z.string(),
    description: z.string(),
  }),
  tickets: z.array(SingleTicketSchema),
});

export type EngineeringTicketsOutput = z.infer<typeof EngineeringTicketsSchema>;
