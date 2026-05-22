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

export interface StreamingTicket {
  id: string;
  title: string;
  priority: string;
  ticketType: string | null;
  estimate: string | null;
}

export async function generateEngineeringTickets(
  input: GenerateTicketsInput,
  onTicket?: (ticket: StreamingTicket) => void
) {
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

  // Save sequentially so we can emit each ticket as it lands
  const tickets = [];
  for (const t of result.tickets) {
    const ticket = await prisma.engineeringTicket.create({
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
    });
    onTicket?.({ id: ticket.id, title: ticket.title, priority: ticket.priority, ticketType: ticket.ticketType, estimate: ticket.estimate });
    tickets.push(ticket);
  }

  await prisma.productEvent.create({
    data: {
      workspaceId,
      event: "tickets_generated",
      properties: { count: tickets.length, prdId, opportunityId },
    },
  });

  return { epic: result.epic, tickets };
}
