# Autonomous Pipeline Design
**Date:** 2026-06-02  
**Status:** Approved

## Overview

One-click "Run Sentinel" pipeline that detects what needs updating, chains all workspace analysis steps sequentially, and populates every tab automatically. Requires no user configuration before running. If the system needs more context, it surfaces suggestions in the agent panel after completion.

---

## 1. Staleness Model

A `GET /api/workspaces/[workspaceId]/pipeline/status` endpoint checks each step's conditions and returns exactly what needs to run. All checks are derived from existing data — no new DB fields required.

### Step conditions

| Step | Needs run when |
|---|---|
| **synthesize** | Latest completed document `createdAt` > max PainPoint `createdAt` (new docs since last synthesis), OR `painPoints.count === 0` |
| **opportunities** | `painPoints.count > 0 && opportunities.count === 0`, OR synthesis step just ran |
| **prd** | Top-scored opportunity has no linked PRD |
| **tickets** | A PRD exists in workspace but `engineeringTickets.count === 0` |
| **summary** | No `EXECUTIVE_SUMMARY` ProductEvent in last 7 days AND `opportunities.count > 0` |

### Response shape

```json
{
  "canRun": true,
  "blockedReason": null,
  "steps": [
    { "key": "synthesize",    "needsRun": true,  "label": "Synthesize insights",    "reason": "2 new documents since last run" },
    { "key": "opportunities", "needsRun": true,  "label": "Generate opportunities", "reason": "Will run after synthesis" },
    { "key": "prd",           "needsRun": false, "label": "Generate PRD",           "reason": "PRD already exists for top opportunity" },
    { "key": "tickets",       "needsRun": false, "label": "Generate tickets",       "reason": "24 tickets already exist" },
    { "key": "summary",       "needsRun": true,  "label": "Executive summary",      "reason": "No summary in last 7 days" }
  ]
}
```

When no completed documents exist: `canRun: false, blockedReason: "Upload documents first"`.

---

## 2. Pipeline Orchestration Hook (`usePipeline`)

A new `usePipeline` hook in `app/(dashboard)/workspaces/[workspaceId]/use-pipeline.ts`. It owns pipeline-level state and drives each step using the existing `startJob` infrastructure from `workspace-jobs-context`.

### State shape

```typescript
type PipelineStepKey = 'synthesize' | 'opportunities' | 'prd' | 'tickets' | 'summary'

interface PipelineStep {
  key: PipelineStepKey
  label: string
  status: 'pending' | 'skipped' | 'running' | 'done' | 'failed'
  reason?: string
}

interface PipelineState {
  idle: boolean
  checking: boolean
  running: boolean
  steps: PipelineStep[]
  currentStep: PipelineStepKey | null
  done: boolean
  failed: boolean
  errorMessage?: string
}
```

### Execution flow

1. `runPipeline()` called → sets `checking: true` → fetches status endpoint
2. Builds `steps[]` from response; marks skipped steps immediately
3. Iterates in fixed order: synthesize → opportunities → prd → tickets → summary
4. For each step with `needsRun: true`: calls `startJob` with the correct URL and waits for `onDone`
5. `onDone` advances to the next step; `onError` sets `failed: true` and stops
6. On full completion: calls `router.refresh()` to hydrate all tabs, sets `done: true`

### API URLs per step

| Step | URL | Body |
|---|---|---|
| synthesize | `POST /api/workspaces/[id]/synthesize` | none |
| opportunities | `POST /api/workspaces/[id]/opportunities/generate` | none |
| prd | `POST /api/workspaces/[id]/prds/generate` | `{ opportunityId: <top by totalScore> }` |
| tickets | `POST /api/workspaces/[id]/tickets/generate` | `{ prdId: <most recent PRD> }` |
| summary | `POST /api/workspaces/[id]/reports/executive-summary` | `{ audience: "Leadership", timeframe: "Last 30 days" }` |

### Auto-selection logic

- **PRD step:** queries committed opportunities ordered by `totalScore desc`, picks `opportunities[0].id`. If no opportunities exist after the opportunities step completes, this step is skipped.
- **Tickets step:** uses most recently created PRD (`prds orderBy createdAt desc limit 1`).
- **Summary step:** hardcoded defaults. User can regenerate with custom settings via the Reports page afterward.

---

## 3. Overview Page Banner

A `PipelineBanner` client component inserted between the overview header and the stats row. It has three visual states:

### Pre-run state
- Small card with indigo left border accent
- Icon + "Sentinel is ready to analyze your workspace"
- Bullet list of steps that will run (from status endpoint, `needsRun: true` only)
- "Run Sentinel" primary button + `×` dismiss
- If `canRun: false`: button replaced with "Upload documents →" link and `blockedReason` shown

### Running state
- Banner expands in-place to show a step-by-step progress list
- Each step row: spinner (running) → checkmark (done) → dash (skipped) → `×` (failed)
- Current step label pulses subtly
- No navigation required to see progress

### Completion state
- Shows "Pipeline complete · ran N steps · took ~Xs"
- Auto-hides with fade after 4 seconds
- Sets dismissal flag in localStorage

### Component location
`app/(dashboard)/workspaces/[workspaceId]/pipeline-banner.tsx`

---

## 4. Dismissal Persistence

`localStorage` keyed by `sentinel-pipeline-dismissed-${workspaceId}`.

**Set when:**
- User clicks `×` (manual early dismiss)
- Pipeline completes successfully (auto-dismiss after 4s fade)

**Cleared when:** never — the banner is gone for this workspace once dismissed.

**New workspace behaviour:** because the key includes `workspaceId`, brand-new workspaces always show the banner until they complete their first run. No DB migration or server state needed.

---

## 5. Tab Indicators

The workspace nav (`components/nav/workspace-nav.tsx`) already renders the tab list. Each tab that maps to an active pipeline step shows a small pulsing indigo dot next to its label while that job is running.

**Mapping:**

| Tab | Job key to watch |
|---|---|
| Insights | `synthesize` |
| Opportunities | `opportunities` |
| PRDs | `prd` |
| Tickets | `tickets` |
| Reports | `summary` |

The nav reads from `WorkspaceJobsContext` via `useJob(key).running`. No new context state needed.

---

## 6. Files to Create / Modify

### New files
- `app/(dashboard)/workspaces/[workspaceId]/use-pipeline.ts` — orchestration hook
- `app/(dashboard)/workspaces/[workspaceId]/pipeline-banner.tsx` — overview banner component
- `app/api/workspaces/[workspaceId]/pipeline/status/route.ts` — staleness check endpoint

### Modified files
- `app/(dashboard)/workspaces/[workspaceId]/page.tsx` — render `PipelineBanner` above stats row
- `components/nav/workspace-nav.tsx` — add pulsing dot indicators per tab
- Possibly `app/api/workspaces/[workspaceId]/opportunities/generate/route.ts` — verify this route exists or needs creating (currently only `opportunities/route.ts` exists)
- Possibly `app/api/workspaces/[workspaceId]/tickets/generate/route.ts` — verify same

### No DB migrations required
All staleness checks are derived from existing fields on existing models.

---

## 7. Error Handling

- If status endpoint fails: banner shows "Couldn't check pipeline status" with a retry button
- If a step fails mid-pipeline: banner shows which step failed with error message; completed steps remain committed in DB; user can retry from that step by clicking "Run Sentinel" again (staleness check will skip already-completed steps)
- Network errors during streaming: existing `onError` in `startJob` handles these — pipeline marks `failed: true`

---

## Out of Scope

- Persisting pipeline run history (covered by existing SentinelAction audit log)
- User-configurable pipeline parameters before run (use individual page forms for custom runs)
- Background/server-side pipeline that survives page close (Approach B — deferred)
