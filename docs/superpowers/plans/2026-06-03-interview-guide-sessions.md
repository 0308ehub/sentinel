# Interview Guide Sessions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist interview guides to the database, support multiple named interview sessions under each guide, capture per-question notes inline during sessions, and synthesize all sessions via AI into both a guide-level summary and a workspace document.

**Architecture:** Four new Prisma models (InterviewGuide, InterviewQuestion, InterviewSession, SessionNote) back a hierarchy of pages: guide list → guide detail (editable questions + sessions) → session conductor (split-panel, per-question notes with autosave) → synthesis output. The existing ephemeral generator is rewired to POST-and-save on submit, then redirect to the guide detail page.

**Tech Stack:** Next.js App Router, Prisma, PostgreSQL, TypeScript, Tailwind, shadcn/ui, Zod, `ai.generateObject` (Anthropic)

---

## File Map

**New files:**
- `prisma/migrations/<timestamp>_add_interview_sessions/migration.sql` (auto-generated)
- `app/api/workspaces/[workspaceId]/interview-guide/[guideId]/route.ts`
- `app/api/workspaces/[workspaceId]/interview-guide/[guideId]/sessions/route.ts`
- `app/api/workspaces/[workspaceId]/interview-guide/[guideId]/sessions/[sessionId]/route.ts`
- `app/api/workspaces/[workspaceId]/interview-guide/[guideId]/sessions/[sessionId]/notes/route.ts`
- `app/api/workspaces/[workspaceId]/interview-guide/[guideId]/synthesize/route.ts`
- `app/(dashboard)/workspaces/[workspaceId]/interview-guide/new/page.tsx`
- `app/(dashboard)/workspaces/[workspaceId]/interview-guide/[guideId]/page.tsx`
- `app/(dashboard)/workspaces/[workspaceId]/interview-guide/[guideId]/guide-detail-client.tsx`
- `app/(dashboard)/workspaces/[workspaceId]/interview-guide/[guideId]/sessions/new/page.tsx`
- `app/(dashboard)/workspaces/[workspaceId]/interview-guide/[guideId]/sessions/[sessionId]/page.tsx`
- `app/(dashboard)/workspaces/[workspaceId]/interview-guide/[guideId]/sessions/[sessionId]/conductor-client.tsx`

**Modified files:**
- `prisma/schema.prisma` — add 4 models + Workspace relation
- `app/api/workspaces/[workspaceId]/interview-guide/route.ts` — add GET, change POST to save
- `app/(dashboard)/workspaces/[workspaceId]/interview-guide/page.tsx` — become list page
- `app/(dashboard)/workspaces/[workspaceId]/interview-guide/guide-generator.tsx` — redirect on save

---

## Task 1: Add Prisma Models

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add models to schema**

Open `prisma/schema.prisma`. Find the `// ─── Digests ───` section. Add this block immediately before it:

```prisma
// ─── Interview Guides ─────────────────────────────────────────────────────────

model InterviewGuide {
  id               String   @id @default(cuid())
  workspaceId      String
  title            String
  customerSegment  String
  interviewType    String
  focusArea        String?
  openingStatement String
  closingStatement String
  synthesis        Json?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  workspace Workspace          @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  questions InterviewQuestion[]
  sessions  InterviewSession[]

  @@index([workspaceId])
}

model InterviewQuestion {
  id       String  @id @default(cuid())
  guideId  String
  theme    String
  question String
  probe    String?
  order    Int

  guide InterviewGuide @relation(fields: [guideId], references: [id], onDelete: Cascade)
  notes SessionNote[]

  @@index([guideId])
}

model InterviewSession {
  id                 String   @id @default(cuid())
  guideId            String
  intervieweeName    String
  intervieweeRole    String?
  intervieweeCompany String?
  date               DateTime
  generalNotes       String?
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  guide InterviewGuide @relation(fields: [guideId], references: [id], onDelete: Cascade)
  notes SessionNote[]

  @@index([guideId])
}

model SessionNote {
  id         String   @id @default(cuid())
  sessionId  String
  questionId String
  content    String
  updatedAt  DateTime @updatedAt

  session  InterviewSession  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  question InterviewQuestion @relation(fields: [questionId], references: [id], onDelete: Cascade)

  @@unique([sessionId, questionId])
  @@index([sessionId])
}
```

- [ ] **Step 2: Add relation to Workspace model**

In the `Workspace` model, add `interviewGuides InterviewGuide[]` to the relations list (after `digests Digest[]`).

- [ ] **Step 3: Run migration**

```bash
cd /Users/alanwei/Desktop/sentinel-next
npx prisma migrate dev --name add_interview_sessions
```

Expected: migration file created, applied to DB, Prisma client regenerated.

- [ ] **Step 4: Verify build**

```bash
npx prisma generate
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add InterviewGuide, InterviewQuestion, InterviewSession, SessionNote models"
```

---

## Task 2: Guide List + Create API Route

**Files:**
- Modify: `app/api/workspaces/[workspaceId]/interview-guide/route.ts`

- [ ] **Step 1: Replace the route file**

Replace the entire contents of `app/api/workspaces/[workspaceId]/interview-guide/route.ts` with:

```typescript
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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params;
    await requireWorkspaceAccess(workspaceId);

    const body = await request.json();
    const { customerSegment, interviewType, questionCount, focusArea } = CreateSchema.parse(body);

    const painPoints = await prisma.painPoint.findMany({
      where: { workspaceId, status: "ACTIVE" },
      orderBy: [{ severity: "desc" }, { urgency: "desc" }],
      take: 10,
    });

    const painPointsSummary = painPoints
      .map((p, i) => `${i + 1}. ${p.title} (Severity ${p.severity}/10, Urgency ${p.urgency}/10): ${p.description}`)
      .join("\n");

    const interviewTypeContext: Record<string, string> = {
      Discovery: "Focus on understanding workflows, current solutions, frustrations, and unmet needs. Use open-ended 'how', 'what', and 'tell me about' prompts.",
      Validation: "Focus on validating specific hypotheses about pain points and proposed solutions. Include questions to test assumptions.",
      "Churn Exit": "Focus on understanding why the customer is leaving, what alternatives they found, and what would have made them stay.",
      Onboarding: "Focus on the customer's initial experience, confusion points, and mental model of the product.",
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

    return Response.json(apiSuccess(guide), { status: 201 });
  } catch (error) {
    console.error("[interview-guide POST]", error);
    return Response.json(apiError("INTERNAL_ERROR", "Failed to generate guide"), { status: 500 });
  }
}
```

- [ ] **Step 2: Verify the app builds**

```bash
cd /Users/alanwei/Desktop/sentinel-next
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors related to this file.

- [ ] **Step 3: Commit**

```bash
git add app/api/workspaces/\[workspaceId\]/interview-guide/route.ts
git commit -m "feat: interview-guide API - GET list + POST generate-and-save"
```

---

## Task 3: Guide Detail API Route

**Files:**
- Create: `app/api/workspaces/[workspaceId]/interview-guide/[guideId]/route.ts`

- [ ] **Step 1: Create the file**

```typescript
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { apiSuccess, apiError } from "@/types";

const PatchSchema = z.object({
  title: z.string().min(1).optional(),
  focusArea: z.string().optional(),
  openingStatement: z.string().min(1).optional(),
  closingStatement: z.string().min(1).optional(),
  questions: z
    .array(
      z.object({
        id: z.string().optional(),
        theme: z.string().min(1),
        question: z.string().min(1),
        probe: z.string().optional(),
      })
    )
    .optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string; guideId: string }> }
) {
  try {
    const { workspaceId, guideId } = await params;
    await requireWorkspaceAccess(workspaceId);

    const guide = await prisma.interviewGuide.findFirst({
      where: { id: guideId, workspaceId },
      include: {
        questions: { orderBy: { order: "asc" } },
        sessions: { orderBy: { date: "desc" } },
      },
    });

    if (!guide) {
      return Response.json(apiError("NOT_FOUND", "Guide not found"), { status: 404 });
    }

    return Response.json(apiSuccess(guide));
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNAUTHORIZED")) {
      return Response.json(apiError("UNAUTHORIZED", "Not authorized"), { status: 401 });
    }
    return Response.json(apiError("INTERNAL_ERROR", "Internal server error"), { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string; guideId: string }> }
) {
  try {
    const { workspaceId, guideId } = await params;
    await requireWorkspaceAccess(workspaceId);

    const body = PatchSchema.parse(await request.json());

    const existing = await prisma.interviewGuide.findFirst({
      where: { id: guideId, workspaceId },
    });
    if (!existing) {
      return Response.json(apiError("NOT_FOUND", "Guide not found"), { status: 404 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (body.questions) {
        await tx.interviewQuestion.deleteMany({ where: { guideId } });
        await tx.interviewQuestion.createMany({
          data: body.questions.map((q, i) => ({
            guideId,
            theme: q.theme,
            question: q.question,
            probe: q.probe ?? null,
            order: i,
          })),
        });
      }

      return tx.interviewGuide.update({
        where: { id: guideId },
        data: {
          ...(body.title && { title: body.title }),
          ...(body.focusArea !== undefined && { focusArea: body.focusArea }),
          ...(body.openingStatement && { openingStatement: body.openingStatement }),
          ...(body.closingStatement && { closingStatement: body.closingStatement }),
        },
        include: { questions: { orderBy: { order: "asc" } }, sessions: { orderBy: { date: "desc" } } },
      });
    });

    return Response.json(apiSuccess(updated));
  } catch (error) {
    console.error("[interview-guide PATCH]", error);
    return Response.json(apiError("INTERNAL_ERROR", "Internal server error"), { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string; guideId: string }> }
) {
  try {
    const { workspaceId, guideId } = await params;
    await requireWorkspaceAccess(workspaceId);

    const existing = await prisma.interviewGuide.findFirst({
      where: { id: guideId, workspaceId },
    });
    if (!existing) {
      return Response.json(apiError("NOT_FOUND", "Guide not found"), { status: 404 });
    }

    await prisma.interviewGuide.delete({ where: { id: guideId } });

    return Response.json(apiSuccess({ deleted: true }));
  } catch (error) {
    console.error("[interview-guide DELETE]", error);
    return Response.json(apiError("INTERNAL_ERROR", "Internal server error"), { status: 500 });
  }
}
```

- [ ] **Step 2: Verify types**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add "app/api/workspaces/[workspaceId]/interview-guide/[guideId]/route.ts"
git commit -m "feat: interview-guide detail API - GET, PATCH, DELETE"
```

---

## Task 4: Sessions API Routes

**Files:**
- Create: `app/api/workspaces/[workspaceId]/interview-guide/[guideId]/sessions/route.ts`
- Create: `app/api/workspaces/[workspaceId]/interview-guide/[guideId]/sessions/[sessionId]/route.ts`

- [ ] **Step 1: Create sessions collection route**

Create `app/api/workspaces/[workspaceId]/interview-guide/[guideId]/sessions/route.ts`:

```typescript
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { apiSuccess, apiError } from "@/types";

const CreateSessionSchema = z.object({
  intervieweeName: z.string().min(1),
  intervieweeRole: z.string().optional(),
  intervieweeCompany: z.string().optional(),
  date: z.string().datetime().or(z.string().date()),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string; guideId: string }> }
) {
  try {
    const { workspaceId, guideId } = await params;
    await requireWorkspaceAccess(workspaceId);

    const guide = await prisma.interviewGuide.findFirst({
      where: { id: guideId, workspaceId },
    });
    if (!guide) {
      return Response.json(apiError("NOT_FOUND", "Guide not found"), { status: 404 });
    }

    const body = CreateSessionSchema.parse(await request.json());

    const session = await prisma.interviewSession.create({
      data: {
        guideId,
        intervieweeName: body.intervieweeName,
        intervieweeRole: body.intervieweeRole ?? null,
        intervieweeCompany: body.intervieweeCompany ?? null,
        date: new Date(body.date),
      },
    });

    return Response.json(apiSuccess(session), { status: 201 });
  } catch (error) {
    console.error("[sessions POST]", error);
    return Response.json(apiError("INTERNAL_ERROR", "Failed to create session"), { status: 500 });
  }
}
```

- [ ] **Step 2: Create session detail route**

Create `app/api/workspaces/[workspaceId]/interview-guide/[guideId]/sessions/[sessionId]/route.ts`:

```typescript
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { apiSuccess, apiError } from "@/types";

const PatchSessionSchema = z.object({
  intervieweeName: z.string().min(1).optional(),
  intervieweeRole: z.string().optional(),
  intervieweeCompany: z.string().optional(),
  date: z.string().datetime().or(z.string().date()).optional(),
  generalNotes: z.string().optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string; guideId: string; sessionId: string }> }
) {
  try {
    const { workspaceId, guideId, sessionId } = await params;
    await requireWorkspaceAccess(workspaceId);

    const session = await prisma.interviewSession.findFirst({
      where: { id: sessionId, guideId },
      include: {
        notes: true,
        guide: {
          include: { questions: { orderBy: { order: "asc" } } },
        },
      },
    });

    if (!session) {
      return Response.json(apiError("NOT_FOUND", "Session not found"), { status: 404 });
    }

    // Verify the guide belongs to this workspace
    if (session.guide.workspaceId !== workspaceId) {
      return Response.json(apiError("UNAUTHORIZED", "Not authorized"), { status: 401 });
    }

    return Response.json(apiSuccess(session));
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNAUTHORIZED")) {
      return Response.json(apiError("UNAUTHORIZED", "Not authorized"), { status: 401 });
    }
    return Response.json(apiError("INTERNAL_ERROR", "Internal server error"), { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string; guideId: string; sessionId: string }> }
) {
  try {
    const { workspaceId, guideId, sessionId } = await params;
    await requireWorkspaceAccess(workspaceId);

    const body = PatchSessionSchema.parse(await request.json());

    const session = await prisma.interviewSession.findFirst({
      where: { id: sessionId, guideId },
      include: { guide: { select: { workspaceId: true } } },
    });

    if (!session || session.guide.workspaceId !== workspaceId) {
      return Response.json(apiError("NOT_FOUND", "Session not found"), { status: 404 });
    }

    const updated = await prisma.interviewSession.update({
      where: { id: sessionId },
      data: {
        ...(body.intervieweeName && { intervieweeName: body.intervieweeName }),
        ...(body.intervieweeRole !== undefined && { intervieweeRole: body.intervieweeRole }),
        ...(body.intervieweeCompany !== undefined && { intervieweeCompany: body.intervieweeCompany }),
        ...(body.date && { date: new Date(body.date) }),
        ...(body.generalNotes !== undefined && { generalNotes: body.generalNotes }),
      },
    });

    return Response.json(apiSuccess(updated));
  } catch (error) {
    console.error("[session PATCH]", error);
    return Response.json(apiError("INTERNAL_ERROR", "Internal server error"), { status: 500 });
  }
}
```

- [ ] **Step 3: Verify types**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add "app/api/workspaces/[workspaceId]/interview-guide/[guideId]/sessions/"
git commit -m "feat: interview sessions API - create and detail routes"
```

---

## Task 5: Notes Autosave API Route

**Files:**
- Create: `app/api/workspaces/[workspaceId]/interview-guide/[guideId]/sessions/[sessionId]/notes/route.ts`

- [ ] **Step 1: Create the file**

```typescript
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { apiSuccess, apiError } from "@/types";

const NotesSchema = z.object({
  notes: z.array(
    z.object({
      questionId: z.string().min(1),
      content: z.string(),
    })
  ),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string; guideId: string; sessionId: string }> }
) {
  try {
    const { workspaceId, guideId, sessionId } = await params;
    await requireWorkspaceAccess(workspaceId);

    const session = await prisma.interviewSession.findFirst({
      where: { id: sessionId, guideId },
      include: { guide: { select: { workspaceId: true } } },
    });

    if (!session || session.guide.workspaceId !== workspaceId) {
      return Response.json(apiError("NOT_FOUND", "Session not found"), { status: 404 });
    }

    const body = NotesSchema.parse(await request.json());

    await prisma.$transaction(
      body.notes.map(({ questionId, content }) =>
        prisma.sessionNote.upsert({
          where: { sessionId_questionId: { sessionId, questionId } },
          create: { sessionId, questionId, content },
          update: { content },
        })
      )
    );

    return Response.json(apiSuccess({ saved: body.notes.length }));
  } catch (error) {
    console.error("[notes PUT]", error);
    return Response.json(apiError("INTERNAL_ERROR", "Failed to save notes"), { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/api/workspaces/[workspaceId]/interview-guide/[guideId]/sessions/[sessionId]/notes/route.ts"
git commit -m "feat: session notes autosave API"
```

---

## Task 6: Synthesize API Route

**Files:**
- Create: `app/api/workspaces/[workspaceId]/interview-guide/[guideId]/synthesize/route.ts`

- [ ] **Step 1: Create the file**

```typescript
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

    // Build transcript for the AI
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

    const systemPrompt = `You are an expert product researcher. Synthesize interview session notes into a structured analysis.
Return valid JSON matching exactly:
{
  "themes": [{ "title": "string", "summary": "string" }],
  "patterns": [{ "observation": "string", "frequency": "string" }],
  "quotes": [{ "interviewee": "string", "quote": "string", "context": "string" }],
  "nextSteps": ["string"]
}
- themes: 3-5 recurring topics across sessions
- patterns: notable behaviors or sentiments with frequency (e.g. "3 of ${guide.sessions.length} interviewees")
- quotes: 3-5 verbatim or near-verbatim memorable quotes
- nextSteps: 2-3 concrete product team actions`;

    const userPrompt = `Interview Guide: ${guide.title}
Type: ${guide.interviewType}, Segment: ${guide.customerSegment}
Sessions: ${guide.sessions.length}

${sessionTranscripts.join("\n\n---\n\n")}`;

    const synthesis = await ai.generateObject({
      system: systemPrompt,
      prompt: userPrompt,
      schema: SynthesisSchema,
      temperature: 0.3,
      maxTokens: 3000,
    });

    // Build document text
    const docText = [
      `# Interview Synthesis: ${guide.title}`,
      `Type: ${guide.interviewType} | Segment: ${guide.customerSegment} | Sessions: ${guide.sessions.length}`,
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

    // Save as workspace document
    const document = await createDocument({
      workspaceId,
      uploadedById: user.id,
      title: `Interview Synthesis: ${guide.title}`,
      sourceType: "INTERVIEW",
      rawText: docText,
    });

    dispatchIngestion(document.id, docText);

    // Store synthesis on guide
    const synthesisPayload = {
      generatedAt: new Date().toISOString(),
      sessionCount: guide.sessions.length,
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
```

- [ ] **Step 2: Verify types**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/api/workspaces/[workspaceId]/interview-guide/[guideId]/synthesize/route.ts"
git commit -m "feat: interview guide synthesis API"
```

---

## Task 7: Update Guide Generator (Redirect on Save)

**Files:**
- Modify: `app/(dashboard)/workspaces/[workspaceId]/interview-guide/guide-generator.tsx`

- [ ] **Step 1: Add router redirect and prop**

Replace the entire `guide-generator.tsx` with:

```typescript
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Loader2, MessageSquarePlus } from "lucide-react";
import { toast } from "sonner";

type InterviewType = "Discovery" | "Validation" | "Churn Exit" | "Onboarding";

interface PainPoint {
  id: string;
  affectedSegments: string[];
}

interface InterviewGuideGeneratorProps {
  workspaceId: string;
}

export function InterviewGuideGenerator({ workspaceId }: InterviewGuideGeneratorProps) {
  const router = useRouter();
  const [segments, setSegments] = useState<string[]>([]);
  const [customerSegment, setCustomerSegment] = useState("");
  const [customSegment, setCustomSegment] = useState("");
  const [interviewType, setInterviewType] = useState<InterviewType>("Discovery");
  const [questionCount, setQuestionCount] = useState(10);
  const [focusArea, setFocusArea] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadSegments() {
      try {
        const res = await fetch(`/api/workspaces/${workspaceId}/pain-points`);
        const data = await res.json();
        if (data.ok) {
          const allSegments = (data.data as PainPoint[])
            .flatMap((pp) => pp.affectedSegments)
            .filter(Boolean);
          const unique = Array.from(new Set(allSegments)).sort();
          setSegments(unique);
          if (unique.length > 0) setCustomerSegment(unique[0]);
        }
      } catch {
        // Segments will be empty; user can type custom
      }
    }
    loadSegments();
  }, [workspaceId]);

  const effectiveSegment = customerSegment === "__custom__" ? customSegment : customerSegment;

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!effectiveSegment.trim()) {
      toast.error("Please enter or select a customer segment.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/interview-guide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerSegment: effectiveSegment.trim(),
          interviewType,
          questionCount,
          focusArea: focusArea.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error?.message ?? "Failed to generate guide");
      }

      toast.success("Interview guide saved!");
      router.push(`/workspaces/${workspaceId}/interview-guide/${data.data.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquarePlus className="h-4 w-4 text-indigo-500" />
          Configure Interview Guide
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-5">
        <form onSubmit={handleGenerate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Customer Segment</label>
              {segments.length > 0 ? (
                <select
                  value={customerSegment}
                  onChange={(e) => setCustomerSegment(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {segments.map((seg) => (
                    <option key={seg} value={seg}>{seg}</option>
                  ))}
                  <option value="__custom__">— Enter custom segment —</option>
                </select>
              ) : (
                <input
                  type="text"
                  value={customerSegment}
                  onChange={(e) => setCustomerSegment(e.target.value)}
                  placeholder="E.g. Enterprise Power Users"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              )}
              {customerSegment === "__custom__" && (
                <input
                  type="text"
                  value={customSegment}
                  onChange={(e) => setCustomSegment(e.target.value)}
                  placeholder="Enter custom segment name"
                  className="w-full mt-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Interview Type</label>
              <select
                value={interviewType}
                onChange={(e) => setInterviewType(e.target.value as InterviewType)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Discovery">Discovery</option>
                <option value="Validation">Validation</option>
                <option value="Churn Exit">Churn Exit</option>
                <option value="Onboarding">Onboarding</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Number of Questions <span className="font-normal text-muted-foreground">(5–20)</span>
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={5}
                max={20}
                step={1}
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
                className="flex-1 h-2 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #4f46e5 0%, #4f46e5 ${((questionCount - 5) / 15) * 100}%, #e5e7eb ${((questionCount - 5) / 15) * 100}%, #e5e7eb 100%)`,
                }}
              />
              <span className="text-sm font-semibold text-indigo-700 min-w-[2rem] text-center">{questionCount}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Focus Area <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <textarea
              value={focusArea}
              onChange={(e) => setFocusArea(e.target.value)}
              placeholder="E.g. Dig into why users abandon during onboarding…"
              rows={3}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Generating and saving…</>
            ) : (
              <><Sparkles className="h-4 w-4" /> Generate Guide</>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/(dashboard)/workspaces/[workspaceId]/interview-guide/guide-generator.tsx"
git commit -m "feat: guide generator redirects to saved guide after POST"
```

---

## Task 8: Guide List Page + New Guide Page

**Files:**
- Modify: `app/(dashboard)/workspaces/[workspaceId]/interview-guide/page.tsx`
- Create: `app/(dashboard)/workspaces/[workspaceId]/interview-guide/new/page.tsx`

- [ ] **Step 1: Rewrite the list page**

Replace `app/(dashboard)/workspaces/[workspaceId]/interview-guide/page.tsx`:

```typescript
import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageSquarePlus, Plus, Users, ChevronRight } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default async function InterviewGuidePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;

  try {
    await requireWorkspaceAccess(workspaceId);
  } catch {
    redirect("/sign-in");
  }

  const guides = await prisma.interviewGuide.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { sessions: true } } },
  });

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="flex items-center justify-between px-8 py-5 border-b border-border bg-card">
        <div>
          <h1 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <MessageSquarePlus className="h-5 w-5 text-indigo-500" />
            Interview Guides
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Generate guides, run sessions, and synthesize findings.
          </p>
        </div>
        <Link href={`/workspaces/${workspaceId}/interview-guide/new`}>
          <Button size="sm" className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
            <Plus className="h-3.5 w-3.5" /> New Guide
          </Button>
        </Link>
      </div>

      <div className="p-8">
        {guides.length === 0 ? (
          <div className="bg-card rounded-xl border border-dashed border-border px-6 py-16 text-center">
            <MessageSquarePlus className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">No interview guides yet</p>
            <p className="text-xs text-muted-foreground mb-4">
              Generate a guide to start conducting structured customer interviews.
            </p>
            <Link href={`/workspaces/${workspaceId}/interview-guide/new`}>
              <Button size="sm" className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
                <Plus className="h-3.5 w-3.5" /> New Guide
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {guides.map((guide) => (
              <Link
                key={guide.id}
                href={`/workspaces/${workspaceId}/interview-guide/${guide.id}`}
              >
                <div className="bg-card rounded-xl border border-border px-5 py-4 flex items-center justify-between gap-4 hover:border-indigo-300 transition-colors cursor-pointer">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{guide.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className="text-xs bg-indigo-500/10 text-indigo-400 border-0">
                        {guide.interviewType}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{guide.customerSegment}</span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">{formatDate(guide.createdAt)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="h-3.5 w-3.5" />
                      {guide._count.sessions} session{guide._count.sessions !== 1 ? "s" : ""}
                    </span>
                    {guide.synthesis && (
                      <Badge className="text-xs bg-emerald-500/10 text-emerald-400 border-0">Synthesized</Badge>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create new guide page**

Create `app/(dashboard)/workspaces/[workspaceId]/interview-guide/new/page.tsx`:

```typescript
import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { InterviewGuideGenerator } from "../guide-generator";

export default async function NewInterviewGuidePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;

  try {
    await requireWorkspaceAccess(workspaceId);
  } catch {
    redirect("/sign-in");
  }

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="flex items-center gap-3 px-8 py-5 border-b border-border bg-card">
        <Link href={`/workspaces/${workspaceId}/interview-guide`}>
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Button>
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-foreground">New Interview Guide</h1>
          <p className="text-sm text-muted-foreground">
            Generates targeted questions from your workspace pain points.
          </p>
        </div>
      </div>

      <div className="p-8 max-w-2xl">
        <InterviewGuideGenerator workspaceId={workspaceId} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/workspaces/[workspaceId]/interview-guide/page.tsx" \
        "app/(dashboard)/workspaces/[workspaceId]/interview-guide/new/page.tsx"
git commit -m "feat: interview guide list page and new guide page"
```

---

## Task 9: Guide Detail Page

**Files:**
- Create: `app/(dashboard)/workspaces/[workspaceId]/interview-guide/[guideId]/page.tsx`
- Create: `app/(dashboard)/workspaces/[workspaceId]/interview-guide/[guideId]/guide-detail-client.tsx`

- [ ] **Step 1: Create the server page**

Create `app/(dashboard)/workspaces/[workspaceId]/interview-guide/[guideId]/page.tsx`:

```typescript
import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { redirect, notFound } from "next/navigation";
import { GuideDetailClient } from "./guide-detail-client";

export default async function GuideDetailPage({
  params,
}: {
  params: Promise<{ workspaceId: string; guideId: string }>;
}) {
  const { workspaceId, guideId } = await params;

  try {
    await requireWorkspaceAccess(workspaceId);
  } catch {
    redirect("/sign-in");
  }

  const guide = await prisma.interviewGuide.findFirst({
    where: { id: guideId, workspaceId },
    include: {
      questions: { orderBy: { order: "asc" } },
      sessions: { orderBy: { date: "desc" } },
    },
  });

  if (!guide) notFound();

  return <GuideDetailClient workspaceId={workspaceId} guide={guide} />;
}
```

- [ ] **Step 2: Create the client component**

Create `app/(dashboard)/workspaces/[workspaceId]/interview-guide/[guideId]/guide-detail-client.tsx`:

```typescript
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Plus, Users, Sparkles, Loader2, Pencil, Trash2,
  Check, X, ChevronRight, FileText,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import type { InterviewGuide, InterviewQuestion, InterviewSession } from "@prisma/client";

type GuideWithRelations = InterviewGuide & {
  questions: InterviewQuestion[];
  sessions: InterviewSession[];
};

interface SynthesisData {
  generatedAt: string;
  sessionCount: number;
  themes: { title: string; summary: string }[];
  patterns: { observation: string; frequency: string }[];
  quotes: { interviewee: string; quote: string; context: string }[];
  nextSteps: string[];
}

export function GuideDetailClient({
  workspaceId,
  guide: initialGuide,
}: {
  workspaceId: string;
  guide: GuideWithRelations;
}) {
  const router = useRouter();
  const [guide, setGuide] = useState(initialGuide);
  const [editingQuestionIdx, setEditingQuestionIdx] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState({ theme: "", question: "", probe: "" });
  const [synthesizing, setSynthesizing] = useState(false);
  const [synthesis, setSynthesis] = useState<SynthesisData | null>(
    initialGuide.synthesis as SynthesisData | null
  );

  async function saveQuestions(questions: InterviewQuestion[]) {
    const res = await fetch(
      `/api/workspaces/${workspaceId}/interview-guide/${guide.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questions: questions.map((q) => ({
            theme: q.theme,
            question: q.question,
            probe: q.probe ?? undefined,
          })),
        }),
      }
    );
    const data = await res.json();
    if (!data.ok) throw new Error(data.error?.message ?? "Save failed");
    setGuide(data.data as GuideWithRelations);
  }

  function startEdit(idx: number) {
    const q = guide.questions[idx];
    setEditDraft({ theme: q.theme, question: q.question, probe: q.probe ?? "" });
    setEditingQuestionIdx(idx);
  }

  async function commitEdit(idx: number) {
    const updated = guide.questions.map((q, i) =>
      i === idx
        ? { ...q, theme: editDraft.theme, question: editDraft.question, probe: editDraft.probe || null }
        : q
    );
    try {
      await saveQuestions(updated);
      setEditingQuestionIdx(null);
      toast.success("Question updated");
    } catch {
      toast.error("Failed to save");
    }
  }

  async function deleteQuestion(idx: number) {
    const updated = guide.questions.filter((_, i) => i !== idx);
    try {
      await saveQuestions(updated);
      toast.success("Question removed");
    } catch {
      toast.error("Failed to remove");
    }
  }

  async function addQuestion() {
    const updated = [
      ...guide.questions,
      { id: "", guideId: guide.id, theme: "General", question: "New question", probe: null, order: guide.questions.length },
    ] as InterviewQuestion[];
    try {
      await saveQuestions(updated);
      setEditingQuestionIdx(guide.questions.length);
      const newQ = guide.questions[guide.questions.length];
      setEditDraft({ theme: "General", question: "New question", probe: "" });
      // Focus will be set after render
      toast.success("Question added — edit it below");
    } catch {
      toast.error("Failed to add question");
    }
  }

  async function handleSynthesize() {
    if (guide.sessions.length === 0) {
      toast.error("Add at least one session before synthesizing.");
      return;
    }
    setSynthesizing(true);
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/interview-guide/${guide.id}/synthesize`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!data.ok) throw new Error(data.error?.message ?? "Synthesis failed");
      setSynthesis(data.data.synthesis as SynthesisData);
      toast.success("Synthesis complete — saved as a workspace document.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Synthesis failed");
    } finally {
      setSynthesizing(false);
    }
  }

  const groupedQuestions = guide.questions.reduce(
    (acc, q, idx) => {
      const theme = q.theme || "General";
      if (!acc[theme]) acc[theme] = [];
      acc[theme].push({ q, idx });
      return acc;
    },
    {} as Record<string, { q: InterviewQuestion; idx: number }[]>
  );

  return (
    <div className="h-full overflow-auto bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <Link href={`/workspaces/${workspaceId}/interview-guide`}>
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </Button>
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-foreground">{guide.title}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge className="text-xs bg-indigo-500/10 text-indigo-400 border-0">{guide.interviewType}</Badge>
              <span className="text-xs text-muted-foreground">{guide.customerSegment}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/workspaces/${workspaceId}/interview-guide/${guide.id}/sessions/new`}>
            <Button size="sm" variant="outline" className="gap-2">
              <Plus className="h-3.5 w-3.5" /> New Session
            </Button>
          </Link>
          <Button
            size="sm"
            onClick={handleSynthesize}
            disabled={synthesizing || guide.sessions.length === 0}
            className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {synthesizing ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Synthesizing…</>
            ) : (
              <><Sparkles className="h-3.5 w-3.5" /> Synthesize All</>
            )}
          </Button>
        </div>
      </div>

      <div className="p-8 space-y-8 max-w-5xl">
        {/* Questions section */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Questions ({guide.questions.length})
            </h2>
            <Button variant="ghost" size="sm" onClick={addQuestion} className="gap-1.5 text-indigo-600 text-xs">
              <Plus className="h-3.5 w-3.5" /> Add Question
            </Button>
          </div>
          <div className="space-y-4">
            {Object.entries(groupedQuestions).map(([theme, items]) => (
              <div key={theme}>
                <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  {theme}
                </p>
                <div className="space-y-2 ml-3">
                  {items.map(({ q, idx }) =>
                    editingQuestionIdx === idx ? (
                      <div key={q.id || idx} className="bg-card border border-indigo-500/30 rounded-xl px-4 py-3 space-y-2">
                        <input
                          autoFocus
                          className="w-full text-sm bg-transparent border-b border-border focus:border-indigo-500 outline-none pb-1 text-foreground"
                          value={editDraft.question}
                          onChange={(e) => setEditDraft((d) => ({ ...d, question: e.target.value }))}
                          placeholder="Question"
                        />
                        <div className="flex gap-2">
                          <input
                            className="flex-1 text-xs bg-transparent border-b border-border focus:border-indigo-500 outline-none pb-1 text-muted-foreground"
                            value={editDraft.theme}
                            onChange={(e) => setEditDraft((d) => ({ ...d, theme: e.target.value }))}
                            placeholder="Theme"
                          />
                          <input
                            className="flex-1 text-xs bg-transparent border-b border-border focus:border-indigo-500 outline-none pb-1 text-muted-foreground"
                            value={editDraft.probe}
                            onChange={(e) => setEditDraft((d) => ({ ...d, probe: e.target.value }))}
                            placeholder="Follow-up probe (optional)"
                          />
                        </div>
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" variant="ghost" onClick={() => setEditingQuestionIdx(null)} className="h-7 px-2">
                            <X className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" onClick={() => commitEdit(idx)} className="h-7 px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1">
                            <Check className="h-3 w-3" /> Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div key={q.id || idx} className="bg-card rounded-xl border border-border px-4 py-3 flex items-start justify-between gap-3 group">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground leading-relaxed">{q.question}</p>
                          {q.probe && (
                            <p className="text-xs text-muted-foreground mt-1 italic">Follow-up: {q.probe}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => startEdit(idx)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400 hover:text-red-500" onClick={() => deleteQuestion(idx)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Sessions section */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Users className="h-3.5 w-3.5" /> Sessions ({guide.sessions.length})
            </h2>
            <Link href={`/workspaces/${workspaceId}/interview-guide/${guide.id}/sessions/new`}>
              <Button variant="ghost" size="sm" className="gap-1.5 text-indigo-600 text-xs">
                <Plus className="h-3.5 w-3.5" /> New Session
              </Button>
            </Link>
          </div>
          {guide.sessions.length === 0 ? (
            <div className="bg-card rounded-xl border border-dashed border-border px-5 py-8 text-center">
              <p className="text-sm text-muted-foreground">No sessions yet.</p>
              <Link href={`/workspaces/${workspaceId}/interview-guide/${guide.id}/sessions/new`}>
                <Button variant="link" className="mt-1 text-indigo-600 text-sm">Add your first session</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {guide.sessions.map((session) => (
                <Link
                  key={session.id}
                  href={`/workspaces/${workspaceId}/interview-guide/${guide.id}/sessions/${session.id}`}
                >
                  <div className="bg-card rounded-xl border border-border px-4 py-3 flex items-center justify-between gap-3 hover:border-indigo-300 transition-colors cursor-pointer">
                    <div>
                      <p className="text-sm font-medium text-foreground">{session.intervieweeName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {[session.intervieweeRole, session.intervieweeCompany].filter(Boolean).join(", ")}
                        {(session.intervieweeRole || session.intervieweeCompany) ? " · " : ""}
                        {formatDate(session.date)}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Synthesis section */}
        {synthesis && (
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2 mb-3">
              <FileText className="h-3.5 w-3.5" /> Synthesis
              <Badge className="text-xs bg-emerald-500/10 text-emerald-400 border-0 ml-1">
                {synthesis.sessionCount} sessions
              </Badge>
            </h2>
            <div className="bg-card rounded-xl border border-border p-5 space-y-5">
              <div>
                <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wide mb-2">Themes</p>
                <div className="space-y-2">
                  {synthesis.themes.map((t, i) => (
                    <div key={i} className="bg-indigo-500/5 rounded-lg px-3 py-2">
                      <p className="text-sm font-medium text-foreground">{t.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{t.summary}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wide mb-2">Patterns</p>
                <ul className="space-y-1">
                  {synthesis.patterns.map((p, i) => (
                    <li key={i} className="text-sm text-foreground flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                      {p.observation}
                      <span className="text-xs text-muted-foreground shrink-0">({p.frequency})</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wide mb-2">Notable Quotes</p>
                <div className="space-y-2">
                  {synthesis.quotes.map((q, i) => (
                    <blockquote key={i} className="border-l-2 border-indigo-500/30 pl-3">
                      <p className="text-sm text-foreground italic">&ldquo;{q.quote}&rdquo;</p>
                      <p className="text-xs text-muted-foreground mt-0.5">— {q.interviewee}, {q.context}</p>
                    </blockquote>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wide mb-2">Next Steps</p>
                <ol className="space-y-1">
                  {synthesis.nextSteps.map((s, i) => (
                    <li key={i} className="text-sm text-foreground flex items-start gap-2">
                      <span className="text-indigo-500 font-semibold shrink-0">{i + 1}.</span>
                      {s}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/workspaces/[workspaceId]/interview-guide/[guideId]/"
git commit -m "feat: guide detail page with editable questions and sessions list"
```

---

## Task 10: New Session Page

**Files:**
- Create: `app/(dashboard)/workspaces/[workspaceId]/interview-guide/[guideId]/sessions/new/page.tsx`

- [ ] **Step 1: Create the file**

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, UserPlus } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { use } from "react";

export default function NewSessionPage({
  params,
}: {
  params: Promise<{ workspaceId: string; guideId: string }>;
}) {
  const { workspaceId, guideId } = use(params);
  const router = useRouter();

  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Interviewee name is required.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/interview-guide/${guideId}/sessions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            intervieweeName: name.trim(),
            intervieweeRole: role.trim() || undefined,
            intervieweeCompany: company.trim() || undefined,
            date: new Date(date).toISOString(),
          }),
        }
      );
      const data = await res.json();
      if (!data.ok) throw new Error(data.error?.message ?? "Failed");
      toast.success("Session created");
      router.push(`/workspaces/${workspaceId}/interview-guide/${guideId}/sessions/${data.data.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create session");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="flex items-center gap-3 px-8 py-5 border-b border-border bg-card">
        <Link href={`/workspaces/${workspaceId}/interview-guide/${guideId}`}>
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Button>
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <UserPlus className="h-4.5 w-4.5 text-indigo-500" /> New Interview Session
          </h1>
        </div>
      </div>

      <div className="p-8 max-w-lg">
        <form onSubmit={handleSubmit} className="bg-card rounded-xl border border-border p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Interviewee Name <span className="text-red-400">*</span>
            </label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Sarah Chen"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Role</label>
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Product Manager"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Company</label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Acme Corp"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</>
            ) : (
              <><UserPlus className="h-4 w-4" /> Start Session</>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/(dashboard)/workspaces/[workspaceId]/interview-guide/[guideId]/sessions/new/page.tsx"
git commit -m "feat: new interview session form page"
```

---

## Task 11: Conductor View (Session Page)

**Files:**
- Create: `app/(dashboard)/workspaces/[workspaceId]/interview-guide/[guideId]/sessions/[sessionId]/page.tsx`
- Create: `app/(dashboard)/workspaces/[workspaceId]/interview-guide/[guideId]/sessions/[sessionId]/conductor-client.tsx`

- [ ] **Step 1: Create the server page**

Create `app/(dashboard)/workspaces/[workspaceId]/interview-guide/[guideId]/sessions/[sessionId]/page.tsx`:

```typescript
import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { redirect, notFound } from "next/navigation";
import { ConductorClient } from "./conductor-client";

export default async function SessionPage({
  params,
}: {
  params: Promise<{ workspaceId: string; guideId: string; sessionId: string }>;
}) {
  const { workspaceId, guideId, sessionId } = await params;

  try {
    await requireWorkspaceAccess(workspaceId);
  } catch {
    redirect("/sign-in");
  }

  const session = await prisma.interviewSession.findFirst({
    where: { id: sessionId, guideId },
    include: {
      notes: true,
      guide: {
        include: {
          questions: { orderBy: { order: "asc" } },
        },
      },
    },
  });

  if (!session || session.guide.workspaceId !== workspaceId) notFound();

  return (
    <ConductorClient
      workspaceId={workspaceId}
      guideId={guideId}
      session={session}
    />
  );
}
```

- [ ] **Step 2: Create the conductor client component**

Create `app/(dashboard)/workspaces/[workspaceId]/interview-guide/[guideId]/sessions/[sessionId]/conductor-client.tsx`:

```typescript
"use client";

import { useState, useCallback, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";
import type { InterviewSession, InterviewQuestion, SessionNote, InterviewGuide } from "@prisma/client";

type SessionWithRelations = InterviewSession & {
  notes: SessionNote[];
  guide: InterviewGuide & { questions: InterviewQuestion[] };
};

export function ConductorClient({
  workspaceId,
  guideId,
  session: initialSession,
}: {
  workspaceId: string;
  guideId: string;
  session: SessionWithRelations;
}) {
  const [session, setSession] = useState(initialSession);
  const [notes, setNotes] = useState<Record<string, string>>(
    Object.fromEntries(initialSession.notes.map((n) => [n.questionId, n.content]))
  );
  const [generalNotes, setGeneralNotes] = useState(initialSession.generalNotes ?? "");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistNotes = useCallback(
    async (latestNotes: Record<string, string>, latestGeneral: string) => {
      setSaveStatus("saving");
      try {
        const notePayload = Object.entries(latestNotes)
          .filter(([, content]) => content.trim().length > 0)
          .map(([questionId, content]) => ({ questionId, content }));

        await Promise.all([
          fetch(
            `/api/workspaces/${workspaceId}/interview-guide/${guideId}/sessions/${session.id}/notes`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ notes: notePayload }),
            }
          ),
          fetch(
            `/api/workspaces/${workspaceId}/interview-guide/${guideId}/sessions/${session.id}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ generalNotes: latestGeneral }),
            }
          ),
        ]);

        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch {
        setSaveStatus("idle");
        toast.error("Failed to autosave");
      }
    },
    [workspaceId, guideId, session.id]
  );

  function scheduleAutosave(latestNotes: Record<string, string>, latestGeneral: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => persistNotes(latestNotes, latestGeneral), 1000);
  }

  function handleNoteChange(questionId: string, value: string) {
    const updated = { ...notes, [questionId]: value };
    setNotes(updated);
    scheduleAutosave(updated, generalNotes);
  }

  function handleGeneralNotesChange(value: string) {
    setGeneralNotes(value);
    scheduleAutosave(notes, value);
  }

  const groupedQuestions = session.guide.questions.reduce(
    (acc, q) => {
      const theme = q.theme || "General";
      if (!acc[theme]) acc[theme] = [];
      acc[theme].push(q);
      return acc;
    },
    {} as Record<string, InterviewQuestion[]>
  );

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-3">
          <Link href={`/workspaces/${workspaceId}/interview-guide/${guideId}`}>
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </Button>
          </Link>
          <div>
            <p className="text-sm font-semibold text-foreground">{session.intervieweeName}</p>
            <p className="text-xs text-muted-foreground">
              {[session.intervieweeRole, session.intervieweeCompany].filter(Boolean).join(", ")}
              {(session.intervieweeRole || session.intervieweeCompany) ? " · " : ""}
              {new Date(session.date).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saveStatus === "saving" && (
            <span className="text-xs text-muted-foreground animate-pulse">Saving…</span>
          )}
          {saveStatus === "saved" && (
            <span className="text-xs text-emerald-500 flex items-center gap-1">
              <Save className="h-3 w-3" /> Saved
            </span>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => persistNotes(notes, generalNotes)}
            className="gap-1.5 text-xs"
          >
            <Save className="h-3.5 w-3.5" /> Save Now
          </Button>
        </div>
      </div>

      {/* Split panel */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: metadata + general notes */}
        <div className="w-72 shrink-0 border-r border-border bg-card/50 p-5 overflow-y-auto flex flex-col gap-4">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Interviewee
            </p>
            <p className="text-sm font-medium text-foreground">{session.intervieweeName}</p>
            {session.intervieweeRole && (
              <p className="text-xs text-muted-foreground mt-0.5">{session.intervieweeRole}</p>
            )}
            {session.intervieweeCompany && (
              <p className="text-xs text-muted-foreground">{session.intervieweeCompany}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {new Date(session.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>

          <div className="flex-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              General Notes
            </p>
            <textarea
              value={generalNotes}
              onChange={(e) => handleGeneralNotesChange(e.target.value)}
              placeholder="Overall impressions, context, follow-up items…"
              rows={10}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>
        </div>

        {/* Right: questions + answer notes */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Opening statement */}
          <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl px-4 py-3">
            <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wide mb-1">
              Opening Statement
            </p>
            <p className="text-sm text-foreground/80 italic">
              &ldquo;{session.guide.openingStatement}&rdquo;
            </p>
          </div>

          {Object.entries(groupedQuestions).map(([theme, questions]) => (
            <div key={theme}>
              <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                {theme}
              </p>
              <div className="space-y-3 ml-3">
                {questions.map((q) => (
                  <div key={q.id} className="bg-card rounded-xl border border-border px-4 py-3">
                    <p className="text-sm font-medium text-foreground mb-0.5">{q.question}</p>
                    {q.probe && (
                      <p className="text-xs text-muted-foreground italic mb-2">Follow-up: {q.probe}</p>
                    )}
                    <textarea
                      value={notes[q.id] ?? ""}
                      onChange={(e) => handleNoteChange(q.id, e.target.value)}
                      placeholder="Notes…"
                      rows={3}
                      className="w-full mt-1 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Closing statement */}
          <div className="bg-muted/30 border border-border/50 rounded-xl px-4 py-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              Closing Statement
            </p>
            <p className="text-sm text-foreground/80 italic">
              &ldquo;{session.guide.closingStatement}&rdquo;
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

```bash
cd /Users/alanwei/Desktop/sentinel-next
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/workspaces/[workspaceId]/interview-guide/[guideId]/sessions/[sessionId]/"
git commit -m "feat: conductor view for live interview note-taking"
```

---

## Task 12: End-to-End Verification

- [ ] **Step 1: Start the dev server**

```bash
cd /Users/alanwei/Desktop/sentinel-next
npm run dev
```

- [ ] **Step 2: Verify guide list page**

Navigate to `/workspaces/<id>/interview-guide`. Expect: empty state with "New Guide" button.

- [ ] **Step 3: Verify guide generation and save**

Click "New Guide", fill the form, submit. Expect: redirects to the guide detail page showing questions grouped by theme.

- [ ] **Step 4: Verify question editing**

On the guide detail page, hover a question and click the pencil icon. Edit the text, click Save. Expect: question updates inline without page reload.

- [ ] **Step 5: Verify session creation**

Click "New Session", fill in name/role/company/date, submit. Expect: redirects to the conductor view for that session.

- [ ] **Step 6: Verify conductor autosave**

In the conductor view, type notes in a few question fields. Wait 1 second. Expect: "Saving…" then "Saved" indicator appears.

- [ ] **Step 7: Verify notes persist**

Refresh the conductor page. Expect: notes are still present.

- [ ] **Step 8: Verify synthesis**

Return to guide detail. Click "Synthesize All". Expect: synthesis section appears with themes, patterns, quotes, and next steps.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: complete interview guide sessions feature"
```
