# Design: Real-Time Generation Progress Streaming

**Date:** 2026-06-04  
**Status:** Approved

## Problem

Three AI generation operations — PRD, Digest, and Interview Guide — show only a frozen spinner while waiting for the backend. Users have no feedback about what is happening or how much longer they need to wait.

Synthesis and Generate Opportunities already stream named step events and render them via `ProgressStream`. This design extends that same pattern to the three remaining operations.

## Scope

Three routes converted from JSON responses to SSE streams:

| Route | Service |
|---|---|
| `POST /api/workspaces/[workspaceId]/prds/generate` | `server/services/prd-service.ts` |
| `POST /api/workspaces/[workspaceId]/digests` | `server/services/digest-service.ts` |
| `POST /api/workspaces/[workspaceId]/interview-guide` | `app/api/workspaces/[workspaceId]/interview-guide/route.ts` (inline logic) |

Three frontend components updated:

| Component | Change |
|---|---|
| `generate-prd-form.tsx` | Replace `useState` loading with `useJob` + `ProgressStream` |
| `digest-generate-button.tsx` | Replace `useState` loading with `useJob` + `ProgressStream` |
| `guide-generator.tsx` | Replace `useState` loading with `useJob` + `ProgressStream` |

## Backend Pattern

Each service receives an `onStep: (text: string) => void` callback. The service calls it at phase boundaries. The route wraps the service in a `ReadableStream` and emits SSE events.

### SSE Event Types

| Event | Shape | When |
|---|---|---|
| `step` | `{ type: "step", step: string }` | At each phase boundary in the service |
| `done` | `{ type: "done", id: string }` | After the record is saved; carries new record ID |
| `error` | `{ type: "error", message: string }` | On any thrown error |

### Route Shape (identical to synthesis route)

```ts
const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
};

export async function POST(req, { params }) {
  // auth check outside stream
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const emit = (data) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      try {
        const result = await generateX(workspaceId, (step) => emit({ type: "step", step }), ...);
        emit({ type: "done", id: result.id });
      } catch (err) {
        emit({ type: "error", message: err.message });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: SSE_HEADERS });
}
```

### Steps Per Operation

**PRD:**
1. `"Loading opportunity"`
2. `"Retrieving evidence"`
3. `"Generating document"`
4. `"Saving"`

**Digest:**
1. `"Loading workspace data"`
2. `"Analyzing activity"`
3. `"Writing digest"`
4. `"Saving"`

**Interview Guide:**
1. `"Loading pain points"`
2. `"Generating questions"`
3. `"Saving guide"`

## Frontend Pattern

Each component replaces `useState(false)` + `setLoading` with `useJob(key)`. The `startJob` call targets the SSE route. Navigation/refresh fires from `onDone`, which receives `{ id }` from the `done` event.

```tsx
const { running, steps, startJob } = useJob("generate-prd");

function handleGenerate() {
  startJob(
    `/api/workspaces/${workspaceId}/prds/generate`,
    (result) => router.push(`/workspaces/${workspaceId}/prd/${result.id}`),
    (msg) => toast.error(msg),
    { body: JSON.stringify({ opportunityId, userInstruction }) }
  );
}

// In JSX:
<Button disabled={running}>
  {running ? <Loader2 className="animate-spin" /> : <Sparkles />}
  {running ? "Generating…" : "Generate PRD"}
</Button>
{steps.length > 0 && <ProgressStream steps={steps} className="w-72 self-end" />}
```

### `useJob` Key Names

| Operation | Key |
|---|---|
| PRD | `"generate-prd"` |
| Digest | `"generate-digest"` |
| Interview Guide | `"generate-interview-guide"` |

## What Does Not Change

- `ProgressStream` component — no changes needed
- `WorkspaceJobsProvider` / `useJob` — the `step` and `done` event types are already handled
- Navigation logic — same destinations, just triggered from `onDone` instead of `.then()`
- Error handling — `onError` callback feeds `toast.error` as today

## Out of Scope

- Agent panel "thinking" state between tool calls
- Any new UI components
- Streaming the actual AI token output (steps are phase labels, not token streams)
