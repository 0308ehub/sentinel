import { prisma } from "@/lib/db/prisma";
import { getAnthropicClient } from "@/lib/ai/anthropic";
import { MODELS } from "@/lib/ai/types";
import type { Digest, DigestType } from "@prisma/client";

export async function generateWorkspaceDigest(
  workspaceId: string,
  type: DigestType = "DAILY",
  onStep?: (step: string) => void
): Promise<Digest> {
  const step = (text: string) => onStep?.(text);
  step("Loading workspace data");
  const lookbackMs =
    type === "WEEKLY"
      ? 7 * 24 * 60 * 60 * 1000
      : 24 * 60 * 60 * 1000;
  const since = new Date(Date.now() - lookbackMs);

  const [
    workspace,
    newDocuments,
    painPoints,
    opportunities,
    tickets,
    completedActions,
    pendingActions,
  ] = await Promise.all([
    prisma.workspace.findUnique({ where: { id: workspaceId } }),
    prisma.document.findMany({
      where: { workspaceId, createdAt: { gte: since } },
      select: { title: true, sourceType: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.painPoint.findMany({
      where: { workspaceId, status: "ACTIVE", createdAt: { gte: since } },
      orderBy: [{ severity: "desc" }],
      take: 8,
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
      where: {
        workspaceId,
        status: "COMPLETED",
        createdAt: { gte: since },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.sentinelAction.findMany({
      where: { workspaceId, status: "PENDING_REVIEW" },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const inProgress = tickets.filter((t) => t.status === "IN_PROGRESS").length;
  const done = tickets.filter((t) => t.status === "DONE").length;
  const inSprint = tickets.filter((t) => t.status === "IN_SPRINT").length;

  const context = `
Workspace: ${workspace?.name ?? workspaceId}
Digest period: ${type === "WEEKLY" ? "Last 7 days" : "Last 24 hours"}

=== Documents Ingested (${newDocuments.length}) ===
${newDocuments.map((d) => `- ${d.title} (${d.sourceType})`).join("\n") || "None"}

=== New Pain Points Surfaced (${painPoints.length}) ===
${painPoints.map((p) => `- ${p.title} (severity: ${p.severity}, urgency: ${p.urgency})`).join("\n") || "None"}

=== Top Opportunities (all-time, by score) ===
${opportunities.map((o) => `- ${o.title} (score: ${o.totalScore.toFixed(0)}, status: ${o.status})`).join("\n") || "None"}

=== Engineering Tickets ===
Total: ${tickets.length} | In Sprint: ${inSprint} | In Progress: ${inProgress} | Done: ${done}

=== Sentinel Actions Completed (${completedActions.length}) ===
${completedActions.map((a) => `- ${a.title} (${a.type})`).join("\n") || "None"}

=== Sentinel Actions Pending Approval (${pendingActions.length}) ===
${pendingActions.map((a) => `- ${a.title}: ${a.description}`).join("\n") || "None"}
`.trim();

  const prompt = `You are the autonomous PM for a product team. Generate a structured PM digest based on this workspace data:

${context}

Write a digest with these four sections — use markdown headers (##):

## What Happened
New documents ingested, pain points surfaced, Sentinel actions that completed. Be concrete with counts and names. Max 5 bullets.

## What Needs Your Attention
Sentinel actions that are pending approval and require a human decision. For each, explain what it will do and why it matters. If none, say so.

## What Information Is Missing
Gaps Sentinel has identified — documents it recommends ingesting, user segments with insufficient evidence, data sources not yet connected. Be specific.

## Next Priorities
Top 3 opportunities + recommended immediate actions. Include the opportunity score and why it ranks highest.

Be direct, data-driven, and no longer than 400 words total.`;

  step("Analyzing activity");
  const response = await getAnthropicClient().messages.create({
    model: MODELS.fast,
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const content =
    response.content[0].type === "text" ? response.content[0].text : "";

  step("Writing digest");
  step("Saving");
  const digest = await prisma.digest.create({
    data: {
      workspaceId,
      type,
      content,
    },
  });

  return digest;
}
