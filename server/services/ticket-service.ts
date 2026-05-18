import { prisma } from "@/lib/db/prisma";
import { ai } from "@/lib/ai/provider";
import {
  GENERATE_TICKETS_PROMPT,
  EngineeringTicketsSchema,
  type EngineeringTicketsOutput,
} from "@/prompts/generate-tickets";
import type { TicketPriority } from "@prisma/client";

export interface GenerateTicketsInput {
  workspaceId: string;
  prdId?: string;
  opportunityId?: string;
}

export async function generateEngineeringTickets(input: GenerateTicketsInput) {
  const { workspaceId, prdId, opportunityId } = input;

  let context = "";

  if (prdId) {
    const prd = await prisma.pRD.findUnique({ where: { id: prdId } });
    if (prd) context = `PRD:\n\n${prd.content}`;
  } else if (opportunityId) {
    const opp = await prisma.opportunity.findUnique({ where: { id: opportunityId } });
    if (opp) {
      context = `Opportunity: ${opp.title}\n\nProblem: ${opp.problemStatement}\n\nSolution: ${opp.proposedSolution}\n\nTarget segments: ${opp.targetSegments.join(", ")}`;
    }
  }

  if (!context) throw new Error("No PRD or opportunity provided");

  const result = await ai.generateObject<EngineeringTicketsOutput>({
    system: GENERATE_TICKETS_PROMPT,
    prompt: context,
    schema: EngineeringTicketsSchema,
    temperature: 0.2,
    maxTokens: 8192,
  });

  // Delete existing tickets for this PRD/opportunity
  if (prdId) await prisma.engineeringTicket.deleteMany({ where: { prdId } });
  if (opportunityId && !prdId) {
    await prisma.engineeringTicket.deleteMany({ where: { opportunityId } });
  }

  const priorityMap: Record<string, TicketPriority> = {
    low: "LOW",
    medium: "MEDIUM",
    high: "HIGH",
    critical: "CRITICAL",
  };

  const tickets = await Promise.all(
    result.tickets.map((t) =>
      prisma.engineeringTicket.create({
        data: {
          workspaceId,
          prdId: prdId ?? null,
          opportunityId: opportunityId ?? null,
          title: t.title,
          description: t.description,
          acceptanceCriteria: t.acceptanceCriteria,
          priority: priorityMap[t.priority] ?? "MEDIUM",
          dependencies: t.dependencies,
          ticketType: t.type,
          estimate: t.estimatedComplexity,
          metadata: { implementationNotes: t.implementationNotes },
        },
      })
    )
  );

  await prisma.productEvent.create({
    data: {
      workspaceId,
      event: "tickets_generated",
      properties: { count: tickets.length, prdId, opportunityId },
    },
  });

  return { epic: result.epic, tickets };
}
