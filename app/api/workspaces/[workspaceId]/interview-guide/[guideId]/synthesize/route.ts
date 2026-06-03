import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { ai } from "@/lib/ai/provider";
import { createDocument } from "@/server/services/document-service";
import { dispatchIngestion } from "@/server/jobs/dispatch";
import { apiSuccess, apiError } from "@/types";

const SynthesisSchema = z.object({
  themes: z.array(z.object({ title: z.string(), summary: z.string() })),
  patterns: z.array(z.object({ observation: z.string(), frequency: z.string() })),
  quotes: z.array(z.object({ interviewee: z.string(), quote: z.string(), context: z.string() })),
  nextSteps: z.array(z.string()),
});

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string; guideId: string }> }
) {
  try {
    const { workspaceId, guideId } = await params;
    const { user } = await requireWorkspaceAccess(workspaceId);

    const guide = await prisma.interviewGuide.findFirst({
      where: { id: guideId, workspaceId },
      include: {
        questions: { orderBy: { order: "asc" } },
        sessions: {
          include: { notes: true },
          orderBy: { date: "asc" },
        },
      },
    });

    if (!guide) {
      return Response.json(apiError("NOT_FOUND", "Guide not found"), { status: 404 });
    }

    if (guide.sessions.length === 0) {
      return Response.json(apiError("VALIDATION_ERROR", "No sessions to synthesize"), { status: 400 });
    }

    const notesByQuestionId = new Map(guide.questions.map((q) => [q.id, q]));

    const sessionTranscripts = guide.sessions.map((session) => {
      const noteLines = session.notes
        .map((note) => {
          const q = notesByQuestionId.get(note.questionId);
          return q ? `Q: ${q.question}\nA: ${note.content}` : null;
        })
        .filter(Boolean)
        .join("\n\n");

      return `## ${session.intervieweeName}${session.intervieweeRole ? ` (${session.intervieweeRole}${session.intervieweeCompany ? `, ${session.intervieweeCompany}` : ""})` : ""} — ${new Date(session.date).toLocaleDateString()}

${noteLines || "(No notes recorded)"}

${session.generalNotes ? `General notes: ${session.generalNotes}` : ""}`.trim();
    });

    const sessionCount = guide.sessions.length;

    const synthesis = await ai.generateObject({
      system: `You are an expert product researcher. Synthesize interview session notes into structured analysis.
Return JSON matching exactly:
{
  "themes": [{ "title": "string", "summary": "string" }],
  "patterns": [{ "observation": "string", "frequency": "string" }],
  "quotes": [{ "interviewee": "string", "quote": "string", "context": "string" }],
  "nextSteps": ["string"]
}
- themes: 3-5 recurring topics across sessions
- patterns: notable behaviors with frequency (e.g. "${sessionCount} of ${sessionCount} interviewees")
- quotes: 3-5 memorable verbatim quotes
- nextSteps: 2-3 concrete product team actions`,
      prompt: `Interview Guide: ${guide.title}
Type: ${guide.interviewType}, Segment: ${guide.customerSegment}
Sessions: ${sessionCount}

${sessionTranscripts.join("\n\n---\n\n")}`,
      schema: SynthesisSchema,
      temperature: 0.3,
      maxTokens: 3000,
    });

    const docText = [
      `# Interview Synthesis: ${guide.title}`,
      `Type: ${guide.interviewType} | Segment: ${guide.customerSegment} | Sessions: ${sessionCount}`,
      "",
      "## Themes",
      ...synthesis.themes.map((t) => `### ${t.title}\n${t.summary}`),
      "",
      "## Patterns",
      ...synthesis.patterns.map((p) => `- ${p.observation} (${p.frequency})`),
      "",
      "## Notable Quotes",
      ...synthesis.quotes.map((q) => `> "${q.quote}"\n> — ${q.interviewee}, ${q.context}`),
      "",
      "## Recommended Next Steps",
      ...synthesis.nextSteps.map((s, i) => `${i + 1}. ${s}`),
    ].join("\n");

    const document = await createDocument({
      workspaceId,
      uploadedById: user.id,
      title: `Interview Synthesis: ${guide.title}`,
      sourceType: "INTERVIEW",
      rawText: docText,
    });

    dispatchIngestion(document.id, docText);

    const synthesisPayload = {
      generatedAt: new Date().toISOString(),
      sessionCount,
      ...synthesis,
    };

    await prisma.interviewGuide.update({
      where: { id: guideId },
      data: { synthesis: synthesisPayload },
    });

    return Response.json(apiSuccess({ synthesis: synthesisPayload, documentId: document.id }), { status: 201 });
  } catch (error) {
    console.error("[synthesize POST]", error);
    return Response.json(apiError("INTERNAL_ERROR", "Synthesis failed"), { status: 500 });
  }
}
