import { prisma } from "@/lib/db/prisma";
import { getAnthropicClient } from "@/lib/ai/anthropic";
import { MODELS } from "@/lib/ai/types";

export async function generateWorkspaceDigest(workspaceId: string) {
  const [workspace, documents, painPoints, opportunities, tickets, recentActions] =
    await Promise.all([
      prisma.workspace.findUnique({ where: { id: workspaceId } }),
      prisma.document.count({ where: { workspaceId } }),
      prisma.painPoint.findMany({
        where: { workspaceId, status: "ACTIVE" },
        orderBy: [{ severity: "desc" }],
        take: 5,
      }),
      prisma.opportunity.findMany({
        where: { workspaceId },
        orderBy: { totalScore: "desc" },
        take: 5,
      }),
      prisma.engineeringTicket.findMany({
        where: { workspaceId },
        orderBy: [{ priority: "desc" }],
      }),
      prisma.sentinelAction.findMany({
        where: { workspaceId, status: "COMPLETED", createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

  const inProgress = tickets.filter((t) => t.status === "IN_PROGRESS").length;
  const done = tickets.filter((t) => t.status === "DONE").length;
  const inSprint = tickets.filter((t) => t.status === "IN_SPRINT").length;

  const context = `
Workspace: ${workspace?.name}
Documents: ${documents}
Active Pain Points: ${painPoints.length}
Top Pain Points: ${painPoints.map((p) => `- ${p.title} (severity: ${p.severity})`).join("\n")}
Opportunities: ${opportunities.length}
Top Opportunities: ${opportunities.map((o) => `- ${o.title} (score: ${o.totalScore.toFixed(0)})`).join("\n")}
Total Tickets: ${tickets.length}
In Sprint: ${inSprint}, In Progress: ${inProgress}, Done: ${done}
Autonomous Actions This Week: ${recentActions.length}
`.trim();

  const prompt = `You are the autonomous PM for a product team. Generate a concise weekly PM digest based on this workspace data:\n\n${context}\n\nWrite a digest with: 1) What happened this week (max 3 bullets), 2) Current focus (top in-progress item), 3) Key risks or blockers, 4) Recommended next actions (max 3). Be direct, use data, no fluff.`;

  const response = await getAnthropicClient().messages.create({
    model: MODELS.fast,
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const content = response.content[0].type === "text" ? response.content[0].text : "";

  await prisma.productEvent.create({
    data: {
      workspaceId,
      event: "digest_generated",
      properties: { length: content.length },
    },
  });

  return { digest: content, generatedAt: new Date().toISOString() };
}
