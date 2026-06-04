import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { ai } from "@/lib/ai/provider";
import { apiSuccess, apiError } from "@/types";

const CreateSchema = z.object({
  customerSegment: z.string().min(1),
  interviewType: z.enum(["Discovery", "Validation", "Churn Exit", "Onboarding"]),
  questionCount: z.number().int().min(5).max(20).default(10),
  focusArea: z.string().optional(),
});

interface RawQuestion {
  theme: string;
  question: string;
  probe?: string;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params;
    await requireWorkspaceAccess(workspaceId);

    const guides = await prisma.interviewGuide.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { sessions: true } },
      },
    });

    return Response.json(apiSuccess(guides));
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNAUTHORIZED")) {
      return Response.json(apiError("UNAUTHORIZED", "Not authorized"), { status: 401 });
    }
    return Response.json(apiError("INTERNAL_ERROR", "Internal server error"), { status: 500 });
  }
}

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const { workspaceId } = await params;

  try {
    await requireWorkspaceAccess(workspaceId);
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await request.json();
  const { customerSegment, interviewType, questionCount, focusArea } =
    CreateSchema.parse(body);

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const emit = (data: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

      try {
        emit({ type: "step", step: "Loading pain points" });
        const painPoints = await prisma.painPoint.findMany({
          where: { workspaceId, status: "ACTIVE" },
          orderBy: [{ severity: "desc" }, { urgency: "desc" }],
          take: 10,
        });

        const painPointsSummary = painPoints
          .map(
            (p, i) =>
              `${i + 1}. ${p.title} (Severity ${p.severity}/10, Urgency ${p.urgency}/10): ${p.description}`
          )
          .join("\n");

        const interviewTypeContext: Record<string, string> = {
          Discovery:
            "Focus on understanding workflows, current solutions, frustrations, and unmet needs. Use open-ended 'how', 'what', and 'tell me about' prompts.",
          Validation:
            "Focus on validating specific hypotheses about pain points and proposed solutions. Include questions to test assumptions.",
          "Churn Exit":
            "Focus on understanding why the customer is leaving, what alternatives they found, and what would have made them stay.",
          Onboarding:
            "Focus on the customer's initial experience, confusion points, and mental model of the product.",
        };

        const systemPrompt = `You are an expert UX researcher. Generate a structured interview guide with exactly ${questionCount} questions organized by theme.
${interviewTypeContext[interviewType]}
Respond with valid JSON only:
{
  "openingStatement": "string",
  "questions": [{ "theme": "string", "question": "string", "probe": "optional string" }],
  "closingStatement": "string"
}
Group questions under 3-5 themes. Make questions conversational, open-ended, and non-leading.`;

        const userPrompt = `Generate a ${interviewType} interview guide for the "${customerSegment}" customer segment.
Questions: ${questionCount}
${focusArea ? `Focus area: ${focusArea}` : ""}
Top pain points:
${painPointsSummary || "No specific pain points yet — generate general discovery questions."}`;

        emit({ type: "step", step: "Generating questions" });
        const rawJson = await ai.generateText({
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
          temperature: 0.5,
          maxTokens: 2000,
        });

        const jsonMatch = rawJson.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("Failed to parse AI response as JSON");

        const parsed = JSON.parse(jsonMatch[0]) as {
          openingStatement: string;
          questions: RawQuestion[];
          closingStatement: string;
        };

        emit({ type: "step", step: "Saving guide" });
        const title = `${interviewType} — ${customerSegment}`;
        const guide = await prisma.interviewGuide.create({
          data: {
            workspaceId,
            title,
            customerSegment,
            interviewType,
            focusArea: focusArea ?? null,
            openingStatement: parsed.openingStatement,
            closingStatement: parsed.closingStatement,
            questions: {
              create: parsed.questions.map((q, i) => ({
                theme: q.theme,
                question: q.question,
                probe: q.probe ?? null,
                order: i,
              })),
            },
          },
          include: { questions: { orderBy: { order: "asc" } } },
        });

        emit({ type: "done", id: guide.id });
      } catch (err) {
        console.error("[interview-guide POST]", err);
        const message = err instanceof Error ? err.message : "Failed to generate guide";
        emit({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
