<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Sentinel-Next Codebase Guide

> This file is **self-improving**. When you discover important architecture details, gotchas, or patterns during a session, update the relevant section below so future sessions start with that knowledge.

## Architecture Overview

Sentinel is an autonomous PM product. The main workspace flow is:

1. **Upload evidence** (documents) → background ingestion pipeline chunks + embeds them
2. **Synthesize** (extract pain points and insights from embedded docs via LLM)
3. **Generate opportunities** (rank pain points into product opportunities)
4. **Generate PRD** (for top opportunity)
5. **Generate tickets** (engineering breakdown)
6. **Executive summary**

The pipeline orchestrator lives in `pipeline-context.tsx` and runs these steps sequentially via SSE streaming.

## Job / Streaming System

All LLM generation uses a shared **SSE streaming job context**.

- `workspace-jobs-context.tsx` — `WorkspaceJobsProvider` holds all job state
- `useJob(key)` — hook to subscribe to a named job's running state, steps, and streamed entities
- Job keys in use: `"synthesize"`, `"generate-opportunities"`, `"tickets"`, `"prd-<id>"`, `"digest-<id>"`, `"interview-guide-<id>"`
- **CRITICAL**: The pipeline context (`pipeline-context.tsx`) must use `useJob("generate-opportunities")` for the opportunities step — matching what `OpportunitiesClient` and `GenerateOpportunitiesButton` subscribe to. If you change the key, streaming will silently break on the Opportunities page.

SSE server endpoints emit these event types:
- `{ type: "step", step: "..." }` — progress step text
- `{ type: "opportunity", data: {...} }` — streamed opportunity object
- `{ type: "pain_point", data: {...} }` — streamed pain point
- `{ type: "insight", data: {...} }` — streamed insight
- `{ type: "ticket", data: {...} }` — streamed ticket
- `{ type: "done", ... }` — job complete
- `{ type: "error", message: "..." }` — job failed

## Document Processing

Documents go through: `PENDING → PARSING → CHUNKING → EMBEDDING → COMPLETED` (or `FAILED`).

- The documents page (`DocumentsManager`) polls `router.refresh()` every 3s when any doc has an in-progress status. Stop polling is automatic when all docs reach terminal state.
- Auto-heal logic on the documents page resets docs stuck in processing >5 minutes back to `PENDING` and re-dispatches them.

## Key Files

| File | Purpose |
|------|---------|
| `app/(dashboard)/workspaces/[workspaceId]/workspace-jobs-context.tsx` | SSE job state management |
| `app/(dashboard)/workspaces/[workspaceId]/pipeline-context.tsx` | Full pipeline orchestration |
| `app/(dashboard)/workspaces/[workspaceId]/pipeline-banner.tsx` | Pipeline UI on overview page |
| `components/document/documents-manager.tsx` | Document list with auto-polling |
| `app/(dashboard)/workspaces/[workspaceId]/opportunities/opportunities-client.tsx` | Streaming opportunities display |
| `components/ui/progress-stream.tsx` | Reusable SSE step progress UI |
| `server/services/` | LLM generation services (opportunity, synthesis, tickets, PRD, digest) |
| `server/jobs/dispatch.ts` | Document ingestion dispatcher |

## Patterns

### Adding a new SSE streaming route

1. Server: emit `data: {...}\n\n` newline-delimited JSON, end with `{ type: "done" }`
2. Client: call `useJob(key).startJob(url, onDone, onError)`
3. Render progress with `<ProgressStream steps={steps} />`
4. Render streamed entities from `useJob(key).streamingXxx` arrays

### API response format

All API routes use `apiSuccess(data)` and `apiError(code, message)` from `@/types`.

### router.refresh() pattern

Client components use `router.refresh()` (not window.location.reload) to re-fetch server component data without losing client state. Used after mutations and on polling intervals.

## Known Gotchas

- **Job key must match across pipeline-context, page client component, and button** — any mismatch silently breaks streaming UI without errors
- The `params` and `searchParams` in Next.js App Router page components are now Promises — always `await params` before destructuring
- Prisma client is at `@/lib/db/prisma` — never instantiate a new PrismaClient in route handlers
- `requireWorkspaceAccess(workspaceId)` handles both auth check and returns `{ workspace }` — always wrap in try/catch and redirect on failure
- The pipeline banner auto-dismisses after 4s on completion and persists dismissal in localStorage per workspace

## Self-Improvement Instructions

After each session working on this codebase:
- Add any new job keys to the "Key files" or "Known gotchas" section
- Note any new SSE event types discovered
- Document any new service patterns or API conventions
- Record bugs found and their root causes in "Known Gotchas"
