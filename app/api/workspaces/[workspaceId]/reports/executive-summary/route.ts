import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { ai } from "@/lib/ai/provider";
import { apiSuccess, apiError } from "@/types";

const Schema = z.object({
  audience: z.enum(["Leadership", "Engineering", "Board", "Investors"]),
  timeframe: z.enum(["Last 7 days", "Last 30 days", "Last 90 days", "All time"]),
  additionalContext: z.string().optional(),
});

function timeframeCutoff(timeframe: string): Date | null {
  const now = new Date();
  if (timeframe === "Last 7 days") {
    return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
  if (timeframe === "Last 30 days") {
    return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
  if (timeframe === "Last 90 days") {
    return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  }
  return null; // All time
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params;
    const { user } = await requireWorkspaceAccess(workspaceId);

    const body = await request.json();
    const { audience, timeframe, additionalContext } = Schema.parse(body);

    const cutoff = timeframeCutoff(timeframe);
    const dateFilter = cutoff ? { createdAt: { gte: cutoff } } : {};

    const [opportunities, painPoints, insights] = await Promise.all([
      prisma.opportunity.findMany({
        where: { workspaceId, ...dateFilter },
        orderBy: { totalScore: "desc" },
        take: 10,
      }),
      prisma.painPoint.findMany({
        where: { workspaceId, status: "ACTIVE", ...dateFilter },
        orderBy: [{ severity: "desc" }, { urgency: "desc" }],
        take: 10,
      }),
      prisma.insight.findMany({
        where: { workspaceId, ...dateFilter },
        orderBy: { confidence: "desc" },
        take: 15,
      }),
    ]);

    const opportunitiesSummary = opportunities
      .map(
        (o, i) =>
          `${i + 1}. ${o.title} (Score: ${o.totalScore.toFixed(0)}) — ${o.description}`
      )
      .join("\n");

    const painPointsSummary = painPoints
      .map(
        (p, i) =>
          `${i + 1}. ${p.title} (Severity: ${p.severity}/10, Urgency: ${p.urgency}/10) — ${p.description}`
      )
      .join("\n");

    const insightsSummary = insights
      .map((ins, i) => `${i + 1}. [${ins.type}] ${ins.title} — ${ins.description}`)
      .join("\n");

    const audienceInstructions: Record<string, string> = {
      Leadership:
        "Focus on strategic alignment, market opportunity, and team capacity. Use business language. Highlight ROI and competitive positioning.",
      Engineering:
        "Emphasize technical feasibility, scope clarity, and dependencies. Use precise language. Include complexity estimates where relevant.",
      Board:
        "Focus on high-level market opportunity, risk mitigation, and financial impact. Be concise and emphasize governance metrics.",
      Investors:
        "Highlight growth signals, market size, competitive moats, and traction metrics. Use investor-friendly framing and emphasize upside.",
    };

    const systemPrompt = `You are a senior product strategist helping product managers communicate insights to stakeholders.
Write a polished executive summary that is 400-600 words, well-structured with clear sections, and tailored to the specified audience.
Use professional, clear language. Do not use bullet lists excessively — prefer short paragraphs.
Include a brief intro, key findings, top opportunities, and a recommended next step or two.
${audienceInstructions[audience]}`;

    const userPrompt = `Generate an executive summary for the following product discovery data.

Audience: ${audience}
Timeframe: ${timeframe}
${additionalContext ? `Additional context: ${additionalContext}\n` : ""}

TOP PAIN POINTS:
${painPointsSummary || "No pain points recorded for this period."}

TOP OPPORTUNITIES:
${opportunitiesSummary || "No opportunities recorded for this period."}

KEY INSIGHTS:
${insightsSummary || "No insights recorded for this period."}

Write a 400-600 word executive summary tailored for ${audience}. Structure it with clear headings.`;

    const summary = await ai.generateText({
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      temperature: 0.4,
      maxTokens: 1000,
    });

    await prisma.productEvent.create({
      data: {
        workspaceId,
        userId: user.id,
        event: "EXECUTIVE_SUMMARY",
        properties: { audience, timeframe, summary, additionalContext: additionalContext ?? null },
      },
    });

    return Response.json(apiSuccess({ summary }), { status: 201 });
  } catch (error) {
    console.error("[executive-summary]", error);
    return Response.json(
      apiError("INTERNAL_ERROR", "Failed to generate executive summary"),
      { status: 500 }
    );
  }
}
