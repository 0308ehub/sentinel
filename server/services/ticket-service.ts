import { prisma } from "@/lib/db/prisma";
import { getAnthropicClient } from "@/lib/ai/anthropic";
import { jsonrepair } from "jsonrepair";
import {
  GENERATE_TICKETS_PROMPT,
  EngineeringTicketsSchema,
  SingleTicketSchema,
  type EngineeringTicketsOutput,
} from "@/prompts/generate-tickets";
import { MODELS } from "@/lib/ai/types";
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

/**
 * Incrementally scans a growing text buffer for complete JSON ticket objects
 * inside the `"tickets": [...]` array, emitting each one as soon as its closing
 * `}` is found.  Handles nested objects and string escaping correctly.
 */
class TicketExtractor {
  private buffer = "";
  private scanPos = 0;
  private ticketsFound = false;
  private depth = 0;
  private objectStart = -1;
  private inString = false;
  private escaped = false;

  /** Feed a new chunk; returns any complete ticket JSON strings found. */
  push(text: string): string[] {
    this.buffer += text;
    const results: string[] = [];

    // Wait until we've seen `"tickets":[` before scanning for objects
    if (!this.ticketsFound) {
      const match = this.buffer.match(/"tickets"\s*:\s*\[/);
      if (match?.index !== undefined) {
        this.scanPos = match.index + match[0].length;
        this.ticketsFound = true;
      } else {
        return results;
      }
    }

    while (this.scanPos < this.buffer.length) {
      const ch = this.buffer[this.scanPos++];

      if (this.escaped) { this.escaped = false; continue; }
      if (this.inString) {
        if (ch === "\\") this.escaped = true;
        else if (ch === '"') this.inString = false;
        continue;
      }
      if (ch === '"') { this.inString = true; continue; }

      if (ch === "{") {
        if (this.depth === 0) this.objectStart = this.scanPos - 1;
        this.depth++;
      } else if (ch === "}") {
        this.depth--;
        if (this.depth === 0 && this.objectStart >= 0) {
          results.push(this.buffer.slice(this.objectStart, this.scanPos));
          this.objectStart = -1;
        }
      }
    }

    return results;
  }

  getBuffer(): string { return this.buffer; }
}

const SCHEMA_HINT = JSON.stringify({
  type: "object",
  properties: {
    epic: {
      type: "object",
      properties: { title: { type: "string" }, description: { type: "string" } },
    },
    tickets: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          type: { type: "string", enum: ["frontend","backend","fullstack","data","design","analytics","qa"] },
          priority: { type: "string", enum: ["low","medium","high","critical"] },
          description: { type: "string" },
          acceptanceCriteria: { type: "array", items: { type: "string" } },
          implementationNotes: { type: "array", items: { type: "string" } },
          dependencies: { type: "array", items: { type: "string" } },
          estimatedComplexity: { type: "string", enum: ["small","medium","large"] },
        },
      },
    },
  },
}, null, 2);

const SYSTEM_PROMPT = [
  GENERATE_TICKETS_PROMPT,
  `You must respond with valid JSON matching this schema:\n${SCHEMA_HINT}`,
  "Return only the JSON object, no markdown fences or explanation.",
].join("\n\n");

const PRIORITY_MAP: Record<string, TicketPriority> = {
  low: "LOW", medium: "MEDIUM", high: "HIGH", critical: "CRITICAL",
};

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

  // Clear existing tickets before streaming new ones
  if (prdId) await prisma.engineeringTicket.deleteMany({ where: { prdId } });
  if (opportunityId && !prdId) await prisma.engineeringTicket.deleteMany({ where: { opportunityId } });

  const extractor = new TicketExtractor();
  const tickets = [];

  // Stream the Anthropic response token-by-token.
  // As each complete ticket JSON object is detected in the stream,
  // parse it, save to DB, and emit via onTicket immediately.
  const stream = await getAnthropicClient().messages.create({
    model: MODELS.reasoning,
    max_tokens: 8192,
    temperature: 0.2,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: context }],
    stream: true,
  });

  for await (const event of stream) {
    if (event.type !== "content_block_delta") continue;
    if (event.delta.type !== "text_delta") continue;

    const rawObjects = extractor.push(event.delta.text);

    for (const raw of rawObjects) {
      try {
        const parsed = SingleTicketSchema.parse(JSON.parse(jsonrepair(raw)));
        const ticket = await prisma.engineeringTicket.create({
          data: {
            workspaceId,
            prdId: prdId ?? null,
            opportunityId: opportunityId ?? null,
            title: parsed.title,
            description: parsed.description,
            acceptanceCriteria: parsed.acceptanceCriteria,
            priority: PRIORITY_MAP[parsed.priority] ?? "MEDIUM",
            dependencies: parsed.dependencies,
            ticketType: parsed.type,
            estimate: parsed.estimatedComplexity,
            metadata: { implementationNotes: parsed.implementationNotes },
          },
        });
        onTicket?.({
          id: ticket.id,
          title: ticket.title,
          priority: ticket.priority,
          ticketType: ticket.ticketType,
          estimate: ticket.estimate,
        });
        tickets.push(ticket);
      } catch {
        // Malformed partial — skip; will be covered by final full-parse pass if needed
      }
    }
  }

  // Parse the epic from the complete buffered response
  let epic: EngineeringTicketsOutput["epic"] = { title: "Epic", description: "" };
  try {
    let text = extractor.getBuffer().trim()
      .replace(/^```json\n?/, "")
      .replace(/\n?```$/, "");
    const s = text.indexOf("{");
    const e = text.lastIndexOf("}");
    if (s !== -1 && e > s) text = text.slice(s, e + 1);
    const full = EngineeringTicketsSchema.parse(JSON.parse(jsonrepair(text)));
    epic = full.epic;
  } catch {
    // Epic parse failed — use fallback; tickets were still streamed correctly
  }

  await prisma.productEvent.create({
    data: {
      workspaceId,
      event: "tickets_generated",
      properties: { count: tickets.length, prdId, opportunityId },
    },
  });

  return { epic, tickets };
}
