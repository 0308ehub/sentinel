import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { ai } from "@/lib/ai/provider";
import { apiSuccess, apiError } from "@/types";

const Schema = z.object({
  customerSegment: z.string().min(1),
  interviewType: z.enum(["Discovery", "Validation", "Churn Exit", "Onboarding"]),
  questionCount: z.number().int().min(5).max(20).default(10),
});

interface InterviewQuestion {
  theme: string;
  question: string;
  probe?: string;
}

interface InterviewGuide {
  customerSegment: string;
  interviewType: string;
  questionCount: number;
  questions: InterviewQuestion[];
  openingStatement: string;
  closingStatement: string;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params;
    await requireWorkspaceAccess(workspaceId);

    const body = await request.json();
    const { customerSegment, interviewType, questionCount } = Schema.parse(body);

    const painPoints = await prisma.painPoint.findMany({
      where: {
        workspaceId,
        status: "ACTIVE",
      },
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
        "Focus on understanding workflows, current solutions, frustrations, and unmet needs. Avoid leading questions. Use open-ended 'how', 'what', and 'tell me about' prompts.",
      Validation:
        "Focus on validating specific hypotheses about pain points and proposed solutions. Include questions to test assumptions and check willingness to adopt new solutions.",
      "Churn Exit":
        "Focus on understanding why the customer is leaving, what alternatives they found, and what would have made them stay. Be empathetic and non-defensive.",
      Onboarding:
        "Focus on understanding the customer's initial experience, any confusion or friction points, and their mental model of the product.",
    };

    const systemPrompt = `You are an expert UX researcher and product manager skilled at crafting user interview guides.
Generate a structured interview guide with exactly ${questionCount} questions organized by theme.
${interviewTypeContext[interviewType]}
Format your response as valid JSON matching this structure:
{
  "openingStatement": "string",
  "questions": [
    { "theme": "string", "question": "string", "probe": "optional follow-up string" }
  ],
  "closingStatement": "string"
}
Group questions under 3-5 themes. Each theme should have related questions.
Make questions conversational, open-ended, and non-leading.`;

    const userPrompt = `Generate a ${interviewType} interview guide for the "${customerSegment}" customer segment.
Number of questions: ${questionCount}

Top pain points to explore:
${painPointsSummary || "No specific pain points recorded yet — generate general discovery questions."}

Create ${questionCount} interview questions organized by theme, with optional follow-up probes for each question.`;

    const rawJson = await ai.generateText({
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      temperature: 0.5,
      maxTokens: 2000,
    });

    // Extract JSON from the response (may have markdown code fences)
    const jsonMatch = rawJson.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Failed to parse AI response as JSON");
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      openingStatement: string;
      questions: InterviewQuestion[];
      closingStatement: string;
    };

    const guide: InterviewGuide = {
      customerSegment,
      interviewType,
      questionCount,
      questions: parsed.questions,
      openingStatement: parsed.openingStatement,
      closingStatement: parsed.closingStatement,
    };

    return Response.json(apiSuccess(guide), { status: 201 });
  } catch (error) {
    console.error("[interview-guide]", error);
    return Response.json(
      apiError("INTERNAL_ERROR", "Failed to generate interview guide"),
      { status: 500 }
    );
  }
}
