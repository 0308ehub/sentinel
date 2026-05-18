import { prisma } from "@/lib/db/prisma";
import { ai } from "@/lib/ai/provider";
import { GENERATE_PRD_PROMPT } from "@/prompts/generate-prd";
import { retrieveWorkspaceContext } from "@/lib/retrieval/search";

export interface GeneratePRDInput {
  workspaceId: string;
  opportunityId?: string;
  userInstruction?: string;
  userId?: string;
}

export async function generatePRD(input: GeneratePRDInput) {
  const { workspaceId, opportunityId, userInstruction } = input;

  let opportunity = null;
  if (opportunityId) {
    opportunity = await prisma.opportunity.findUnique({
      where: { id: opportunityId },
      include: { painPoint: true },
    });
  }

  // Retrieve relevant context
  const query = opportunity
    ? `${opportunity.title}: ${opportunity.problemStatement}`
    : userInstruction ?? "product features";

  const context = await retrieveWorkspaceContext({ workspaceId, query, limit: 10 });

  const contextText = [
    opportunity
      ? `Opportunity: ${opportunity.title}\nProblem: ${opportunity.problemStatement}\nSolution: ${opportunity.proposedSolution}\nTarget Segments: ${opportunity.targetSegments.join(", ")}\nScores: Impact ${opportunity.impactScore}, Confidence ${opportunity.confidenceScore}, Urgency ${opportunity.urgencyScore}`
      : "",
    context.chunks.length > 0
      ? `\nEvidence:\n${context.chunks.map((c) => c.content).join("\n\n---\n\n")}`
      : "",
    context.painPoints.length > 0
      ? `\nRelated Pain Points:\n${context.painPoints.slice(0, 5).map((p) => `- ${p.title}: ${p.description}`).join("\n")}`
      : "",
    userInstruction ? `\nAdditional instruction: ${userInstruction}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const content = await ai.generateText({
    system: GENERATE_PRD_PROMPT,
    messages: [{ role: "user", content: contextText }],
    temperature: 0.3,
    maxTokens: 8192,
  });

  const title = opportunity
    ? `PRD: ${opportunity.title}`
    : extractTitleFromMarkdown(content);

  const prd = await prisma.pRD.create({
    data: {
      workspaceId,
      opportunityId: opportunityId ?? null,
      title,
      content,
    },
  });

  if (opportunityId) {
    await prisma.opportunity.update({
      where: { id: opportunityId },
      data: { status: "ACCEPTED" },
    });
  }

  await prisma.productEvent.create({
    data: {
      workspaceId,
      event: "prd_generated",
      properties: { prdId: prd.id, opportunityId },
    },
  });

  return prd;
}

function extractTitleFromMarkdown(md: string): string {
  const match = md.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() ?? "Generated PRD";
}
