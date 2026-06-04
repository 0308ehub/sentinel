# Generation Progress Streaming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert PRD, Digest, and Interview Guide generation from silent spinners to real-time step streaming using the existing SSE + `useJob` + `ProgressStream` infrastructure.

**Architecture:** Each backend service gains an `onStep` callback; each route wraps the service in a `ReadableStream` emitting `step`, `done`, and `error` SSE events (identical pattern to the synthesis route). Each frontend component replaces `useState(false)` loading with `useJob`, wiring `onDone` to navigate/refresh and rendering `<ProgressStream steps={steps} />` below the button.

**Tech Stack:** Next.js App Router SSE, `ReadableStream`, existing `useJob` / `WorkspaceJobsProvider`, existing `ProgressStream` component.

---

## File Map

| File | Change |
|---|---|
| `server/services/prd-service.ts` | Add `onStep` callback to `GeneratePRDInput` + `generatePRD` |
| `app/api/workspaces/[workspaceId]/prds/generate/route.ts` | Rewrite to SSE stream |
| `app/(dashboard)/workspaces/[workspaceId]/prd/generate-prd-form.tsx` | Replace `useState` loading with `useJob` |
| `server/services/digest-service.ts` | Add `onStep` callback to `generateWorkspaceDigest` |
| `app/api/workspaces/[workspaceId]/digests/route.ts` | Rewrite POST handler to SSE stream |
| `app/(dashboard)/workspaces/[workspaceId]/digests/digest-generate-button.tsx` | Replace `useState` loading with `useJob` |
| `app/api/workspaces/[workspaceId]/interview-guide/route.ts` | Rewrite POST handler to SSE stream with inline `onStep` calls |
| `app/(dashboard)/workspaces/[workspaceId]/interview-guide/guide-generator.tsx` | Replace `useState` loading with `useJob` |

---

## Task 1: Add `onStep` callback to PRD service

**Files:**
- Modify: `server/services/prd-service.ts`

- [ ] **Step 1: Update `GeneratePRDInput` and `generatePRD` signature**

Replace the current interface and function signature:

```ts
export interface GeneratePRDInput {
  workspaceId: string;
  opportunityId?: string;
  userInstruction?: string;
  userId?: string;
  onStep?: (step: string) => void;
}

export async function generatePRD(input: GeneratePRDInput) {
  const { workspaceId, opportunityId, userInstruction, onStep } = input;
  const step = (text: string) => onStep?.(text);
```

- [ ] **Step 2: Insert `step()` calls at each phase boundary**

After the opening destructure, add calls at each phase. The full function body becomes:

```ts
export async function generatePRD(input: GeneratePRDInput) {
  const { workspaceId, opportunityId, userInstruction, onStep } = input;
  const step = (text: string) => onStep?.(text);

  step("Loading opportunity");
  let opportunity = null;
  if (opportunityId) {
    opportunity = await prisma.opportunity.findUnique({
      where: { id: opportunityId },
      include: { painPoint: true },
    });
  }

  step("Retrieving evidence");
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

  step("Generating document");
  const content = await ai.generateText({
    system: GENERATE_PRD_PROMPT,
    messages: [{ role: "user", content: contextText }],
    temperature: 0.3,
    maxTokens: 8192,
  });

  step("Saving");
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
```

- [ ] **Step 3: Commit**

```bash
git add server/services/prd-service.ts
git commit -m "feat: add onStep callback to generatePRD service"
```

---

## Task 2: Convert PRD generate route to SSE

**Files:**
- Modify: `app/api/workspaces/[workspaceId]/prds/generate/route.ts`

- [ ] **Step 1: Rewrite the route**

Replace the entire file contents:

```ts
import { z } from "zod";
import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { generatePRD } from "@/server/services/prd-service";

const Schema = z.object({
  opportunityId: z.string().optional(),
  userInstruction: z.string().optional(),
});

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

  let user: Awaited<ReturnType<typeof requireWorkspaceAccess>>["user"];
  try {
    ({ user } = await requireWorkspaceAccess(workspaceId));
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await request.json();
  const { opportunityId, userInstruction } = Schema.parse(body);

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const emit = (data: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

      try {
        const prd = await generatePRD({
          workspaceId,
          opportunityId,
          userInstruction,
          userId: user.id,
          onStep: (step) => emit({ type: "step", step }),
        });
        emit({ type: "done", id: prd.id });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to generate PRD";
        console.error("[prd-generate]", err);
        emit({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/api/workspaces/[workspaceId]/prds/generate/route.ts"
git commit -m "feat: convert PRD generate route to SSE stream"
```

---

## Task 3: Update PRD form frontend to use `useJob`

**Files:**
- Modify: `app/(dashboard)/workspaces/[workspaceId]/prd/generate-prd-form.tsx`

- [ ] **Step 1: Rewrite the component**

Replace the entire file contents:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useJob } from "../workspace-jobs-context";
import { ProgressStream } from "@/components/ui/progress-stream";

interface Opportunity {
  id: string;
  title: string;
}

interface GeneratePRDFormProps {
  workspaceId: string;
  opportunities: Opportunity[];
  defaultOpportunityId?: string;
}

export function GeneratePRDForm({
  workspaceId,
  opportunities,
  defaultOpportunityId,
}: GeneratePRDFormProps) {
  const [opportunityId, setOpportunityId] = useState(defaultOpportunityId ?? "");
  const [userInstruction, setUserInstruction] = useState("");
  const router = useRouter();
  const { running, steps, startJob } = useJob("generate-prd");

  function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    startJob(
      `/api/workspaces/${workspaceId}/prds/generate`,
      (result) => {
        toast.success("PRD generated successfully!");
        router.push(`/workspaces/${workspaceId}/prd/${result.id as string}`);
      },
      (msg) => toast.error(msg),
      {
        body: JSON.stringify({
          opportunityId: opportunityId || undefined,
          userInstruction: userInstruction || undefined,
        }),
      }
    );
  }

  return (
    <Card className="sticky top-6">
      <CardHeader className="border-b">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-indigo-600" />
          Generate New PRD
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-5">
        <form onSubmit={handleGenerate} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Link to Opportunity{" "}
              <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <select
              value={opportunityId}
              onChange={(e) => setOpportunityId(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="">— No linked opportunity —</option>
              {opportunities.map((opp) => (
                <option key={opp.id} value={opp.id}>
                  {opp.title}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Instructions{" "}
              <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <Textarea
              value={userInstruction}
              onChange={(e) => setUserInstruction(e.target.value)}
              placeholder="E.g. Focus on mobile-first experience. Include a phased rollout plan. Target enterprise customers."
              rows={5}
              className="resize-none text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Guide Sentinel on scope, constraints, or specific requirements.
            </p>
          </div>

          <Button
            type="submit"
            disabled={running}
            className="w-full gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {running ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating PRD…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate PRD
              </>
            )}
          </Button>

          {steps.length > 0 && <ProgressStream steps={steps} />}
        </form>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Verify the page still has `WorkspaceJobsProvider` in scope**

The PRD page is under the workspace layout. Confirm `WorkspaceJobsProvider` wraps this page by checking the workspace layout file:

```bash
grep -r "WorkspaceJobsProvider" app/\(dashboard\)/workspaces/\[workspaceId\]/ --include="*.tsx" -l
```

Expected: at least one layout or page file listed.

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/workspaces/[workspaceId]/prd/generate-prd-form.tsx"
git commit -m "feat: stream PRD generation progress with useJob + ProgressStream"
```

---

## Task 4: Add `onStep` callback to digest service

**Files:**
- Modify: `server/services/digest-service.ts`

- [ ] **Step 1: Update function signature**

Change the function signature to accept an optional `onStep` callback as a third parameter:

```ts
export async function generateWorkspaceDigest(
  workspaceId: string,
  type: DigestType = "DAILY",
  onStep?: (step: string) => void
): Promise<Digest> {
  const step = (text: string) => onStep?.(text);
```

- [ ] **Step 2: Insert `step()` calls at phase boundaries**

Insert calls at the four phase boundaries. The opening of the function body becomes:

```ts
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
    // ... (keep existing Promise.all contents unchanged)
  ]);
```

Then insert the remaining steps directly before the AI call and DB save:

```ts
  // (after building `context` string, before the AI call)
  step("Analyzing activity");

  const response = await getAnthropicClient().messages.create({
    // ... unchanged
  });

  step("Writing digest");
  const content =
    response.content[0].type === "text" ? response.content[0].text : "";

  step("Saving");
  const digest = await prisma.digest.create({
    data: { workspaceId, type, content },
  });

  return digest;
```

- [ ] **Step 3: Commit**

```bash
git add server/services/digest-service.ts
git commit -m "feat: add onStep callback to generateWorkspaceDigest service"
```

---

## Task 5: Convert digest POST route to SSE

**Files:**
- Modify: `app/api/workspaces/[workspaceId]/digests/route.ts`

- [ ] **Step 1: Replace the POST handler**

The GET handler is unchanged. Replace only the `POST` export. The `after` import from `next/server` is no longer needed and can be removed. Full new POST handler:

```ts
const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
};

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const { workspaceId } = await params;

  try {
    await requireWorkspaceAccess(workspaceId);
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const emit = (data: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

      try {
        const digest = await generateWorkspaceDigest(workspaceId, "MANUAL", (step) =>
          emit({ type: "step", step })
        );
        emit({ type: "done", id: digest.id });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to generate digest";
        console.error("[digest-generate]", err);
        emit({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
```

Also remove `after` from the import at the top of the file since it is no longer used.

Note: `generateWorkspaceDigest` previously accepted `DigestType` as second arg. The digest service accepts `"MANUAL"` — check that `DigestType` in the Prisma schema includes `"MANUAL"`. If it only has `"DAILY"` and `"WEEKLY"`, pass `"DAILY"` instead and adjust the step text accordingly. Run:

```bash
grep -r "DigestType\|MANUAL\|DAILY\|WEEKLY" prisma/schema.prisma
```

Use whichever value is correct.

- [ ] **Step 2: Commit**

```bash
git add "app/api/workspaces/[workspaceId]/digests/route.ts"
git commit -m "feat: convert digest generate route to SSE stream"
```

---

## Task 6: Update digest generate button to use `useJob`

**Files:**
- Modify: `app/(dashboard)/workspaces/[workspaceId]/digests/digest-generate-button.tsx`

- [ ] **Step 1: Rewrite the component**

Replace the entire file contents:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { useJob } from "../workspace-jobs-context";
import { ProgressStream } from "@/components/ui/progress-stream";

export function DigestGenerateButton({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const { running, steps, startJob } = useJob("generate-digest");

  function handleGenerate() {
    startJob(
      `/api/workspaces/${workspaceId}/digests`,
      () => {
        toast.success("Digest generated!");
        router.refresh();
      },
      (msg) => toast.error(msg)
    );
  }

  return (
    <div className="flex flex-col items-end gap-3">
      <Button
        onClick={handleGenerate}
        disabled={running}
        className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
      >
        {running ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating…
          </>
        ) : (
          <>
            <Plus className="h-4 w-4" />
            Generate Now
          </>
        )}
      </Button>
      {steps.length > 0 && <ProgressStream steps={steps} className="w-72 self-end" />}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/(dashboard)/workspaces/[workspaceId]/digests/digest-generate-button.tsx"
git commit -m "feat: stream digest generation progress with useJob + ProgressStream"
```

---

## Task 7: Convert interview guide POST route to SSE

**Files:**
- Modify: `app/api/workspaces/[workspaceId]/interview-guide/route.ts`

The interview guide has no separate service file — the AI logic is inline in the route. Add `emit` calls directly in the POST handler.

- [ ] **Step 1: Replace the POST handler**

Keep the GET handler and the `CreateSchema` / `RawQuestion` definitions unchanged. Replace only the `POST` export:

```ts
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
```

- [ ] **Step 2: Remove the now-unused `apiSuccess` and `apiError` imports from the top of the file**

The POST handler no longer calls `apiSuccess` or `apiError`. Check whether GET still uses them; if not, remove those imports too. The GET handler does still use them, so keep them.

- [ ] **Step 3: Commit**

```bash
git add "app/api/workspaces/[workspaceId]/interview-guide/route.ts"
git commit -m "feat: convert interview guide route to SSE stream"
```

---

## Task 8: Update interview guide generator frontend to use `useJob`

**Files:**
- Modify: `app/(dashboard)/workspaces/[workspaceId]/interview-guide/guide-generator.tsx`

- [ ] **Step 1: Replace the loading state and fetch logic**

Make three targeted changes to the existing file:

**a) Add imports** — add to the import block:
```ts
import { useJob } from "../workspace-jobs-context";
import { ProgressStream } from "@/components/ui/progress-stream";
```

**b) Replace `useState(false)` for loading with `useJob`** — remove:
```ts
const [loading, setLoading] = useState(false);
```
Add:
```ts
const { running, steps, startJob } = useJob("generate-interview-guide");
```

**c) Replace `handleGenerate` body** — replace the entire `handleGenerate` function:
```ts
function handleGenerate(e: React.FormEvent) {
  e.preventDefault();
  if (!effectiveSegment.trim()) {
    toast.error("Please enter or select a customer segment.");
    return;
  }
  startJob(
    `/api/workspaces/${workspaceId}/interview-guide`,
    (result) => {
      toast.success("Interview guide saved!");
      router.push(`/workspaces/${workspaceId}/interview-guide/${result.id as string}`);
    },
    (msg) => toast.error(msg),
    {
      body: JSON.stringify({
        customerSegment: effectiveSegment.trim(),
        interviewType,
        questionCount,
        focusArea: focusArea.trim() || undefined,
      }),
    }
  );
}
```

**d) Update button and add ProgressStream** — in the JSX, replace the submit button and anything after it:
```tsx
<Button type="submit" disabled={running} className="w-full gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
  {running ? (
    <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</>
  ) : (
    <><Sparkles className="h-4 w-4" /> Generate Guide</>
  )}
</Button>

{steps.length > 0 && <ProgressStream steps={steps} />}
```

**e) Remove the `async` keyword** from `handleGenerate` (it no longer contains `await`).

- [ ] **Step 2: Verify `useState` import still needed**

`useState` is still used for `segments`, `customerSegment`, `customSegment`, `interviewType`, `questionCount`, and `focusArea`. Keep the import.

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/workspaces/[workspaceId]/interview-guide/guide-generator.tsx"
git commit -m "feat: stream interview guide generation progress with useJob + ProgressStream"
```

---

## Task 9: Verify all three flows end-to-end

- [ ] **Step 1: Start the dev server**

```bash
pnpm dev
```

- [ ] **Step 2: Test PRD generation**

Navigate to the PRD page for any workspace. Click "Generate PRD". Verify:
- The button shows spinner + "Generating PRD…"
- Below the button, steps appear one by one: "Loading opportunity" → "Retrieving evidence" → "Generating document" → "Saving"
- Each completed step gets a green checkmark
- On completion, the page navigates to the new PRD

- [ ] **Step 3: Test Digest generation**

Navigate to the Digests page. Click "Generate Now". Verify:
- Steps appear: "Loading workspace data" → "Analyzing activity" → "Writing digest" → "Saving"
- On completion, the page refreshes with the new digest

- [ ] **Step 4: Test Interview Guide generation**

Navigate to Interview Guide. Fill in the form and click "Generate Guide". Verify:
- Steps appear: "Loading pain points" → "Generating questions" → "Saving guide"
- On completion, the page navigates to the new guide

- [ ] **Step 5: Commit final push**

```bash
git push
```
