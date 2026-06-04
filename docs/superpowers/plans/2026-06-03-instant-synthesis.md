# Instant Synthesis + Auto-Refresh Plan

## Goal
Documents are usable for synthesis seconds after upload. The background pipeline
enriches the knowledge base over time. Synthesis auto-refreshes whenever new
documents complete.

---

## Context (read before touching any file)

### Current pipeline
Upload → PARSING → CHUNKING → EMBEDDING → COMPLETED → extraction fires async

`rawText` is stored on the `Document` record immediately after parsing (before
embedding). This is the fast-path data source.

### Current synthesis flow (`server/services/synthesis-service.ts`)
1. Load `PainPoint` records where `status: "ACTIVE"`
2. If none found → call `repopulateInsightsFromExtractions()` (reads stored
   `DocumentExtraction` JSON for COMPLETED docs)
3. Embed pain points → cluster → label clusters → generate opportunities

Pain points only exist after the extraction step runs (~60–90 s). If user
synthesizes immediately after upload, step 1 + 2 both return empty → nothing.

### Key models
- `Document` — has `rawText: String?`, `status: DocumentStatus`
- `DocumentExtraction` — created by `extractDocumentInsights()`, has `extractedJson`
- `PainPoint` — the input to synthesis clustering
- `Workspace` — no `lastSynthesizedAt` field yet (needs migration)
- `ProductEvent` — already used to track `document_processed` and
  `workspace_synthesized` events; use these to detect staleness

### Cron pattern (copy from `app/api/cron/daily-digest/route.ts`)
- Auth: `Authorization: Bearer ${CRON_SECRET}`
- `export const maxDuration = 300`
- Vercel cron config lives in `vercel.json`

---

## Changes required

### 1. Schema migration — add `lastSynthesizedAt` to Workspace

**File:** `prisma/schema.prisma`

Add to `model Workspace`:
```prisma
lastSynthesizedAt DateTime?
```

Create migration:
```
npx prisma migrate dev --name add_workspace_last_synthesized_at
```

---

### 2. Fast-path synthesis from raw text

**File:** `server/services/synthesis-service.ts`

Add a new exported helper **before** `synthesizeWorkspace`:

```ts
export async function extractRawInsightsFromPendingDocs(
  workspaceId: string
): Promise<void>
```

What it does:
- Query documents where `workspaceId = workspaceId` AND `status NOT IN
  ["COMPLETED", "FAILED"]` AND `rawText IS NOT NULL`
- For each doc, call `extractDocumentInsights(doc.id)` directly (same function
  the background pipeline calls)
- This is the "fast extraction" — it runs synchronously so synthesis has
  something to work with
- Cap at 5 docs to avoid blowing the synthesis timeout; skip any doc whose
  `rawText` length < 100 chars

Then modify `synthesizeWorkspace` to call this at the top before loading pain
points:

```ts
// Fast-path: extract insights from any docs that have rawText but haven't
// been processed yet, so synthesis isn't blocked on the background pipeline.
await extractRawInsightsFromPendingDocs(workspaceId);
```

This means the first synthesis call after an upload will trigger quick
extraction for pending docs, then proceed normally.

**Important:** `extractDocumentInsights` is already idempotent-safe — it just
creates new records. No deduplication needed here; the clustering step in
synthesis handles duplicates.

---

### 3. Persist `lastSynthesizedAt` after each synthesis

**File:** `server/services/synthesis-service.ts`

At the end of `synthesizeWorkspace`, after the `ProductEvent` create:

```ts
await prisma.workspace.update({
  where: { id: workspaceId },
  data: { lastSynthesizedAt: new Date() },
});
```

---

### 4. Auto-refresh cron

**File:** `app/api/cron/auto-synthesize/route.ts` (new file)

```ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { synthesizeWorkspace } from "@/server/services/synthesis-service";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find workspaces that have new COMPLETED documents since last synthesis
  const workspaces = await prisma.workspace.findMany({
    where: {
      documents: {
        some: {
          status: "COMPLETED",
          updatedAt: {
            gt: prisma.workspace.fields.lastSynthesizedAt ?? new Date(0),
          },
        },
      },
    },
    select: { id: true, lastSynthesizedAt: true },
  });
```

**Note:** The `prisma.workspace.fields` trick doesn't work in a where clause.
Use a raw query instead to find workspaces where any document's `updatedAt`
is after `lastSynthesizedAt`:

```ts
  const staleWorkspaces = await prisma.$queryRaw<{ id: string }[]>`
    SELECT DISTINCT w.id
    FROM "Workspace" w
    JOIN "Document" d ON d."workspaceId" = w.id
    WHERE d.status = 'COMPLETED'
      AND d."updatedAt" > COALESCE(w."lastSynthesizedAt", '1970-01-01')
  `;

  const results = await Promise.allSettled(
    staleWorkspaces.map((w) => synthesizeWorkspace(w.id))
  );

  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  return Response.json({ checked: staleWorkspaces.length, synthesized: succeeded });
}
```

---

### 5. Register cron in vercel.json

**File:** `vercel.json` (create if missing, or add to existing `crons` array)

```json
{
  "crons": [
    {
      "path": "/api/cron/auto-synthesize",
      "schedule": "0 * * * *"
    }
  ]
}
```

Runs every hour. Adjust to `"*/30 * * * *"` for every 30 min if needed.

---

### 6. Recency-weighted opportunity ranking

**File:** `server/services/opportunity-service.ts`

Find where opportunities are scored/sorted (look for `score` or `priority`
fields). Add a recency multiplier based on the most recent document evidence:

```ts
// After computing base score, apply recency weight
const daysSinceEvidence = (Date.now() - mostRecentEvidenceDate.getTime())
  / (1000 * 60 * 60 * 24);
const recencyMultiplier = Math.exp(-daysSinceEvidence / 30); // half-life ~30 days
const finalScore = baseScore * (0.7 + 0.3 * recencyMultiplier);
```

The `0.7 + 0.3 * recencyMultiplier` formula means:
- Evidence from today: full score
- Evidence from 30 days ago: ~81% of score  
- Evidence from 90 days ago: ~70% of score (floor)

To get `mostRecentEvidenceDate`, look up `Document.createdAt` for the
document IDs in `opportunity.evidenceIds`.

---

## Implementation order

1. Schema migration (`lastSynthesizedAt`)
2. `synthesizeWorkspace` — add fast-path call + persist `lastSynthesizedAt`
3. Auto-synthesize cron route
4. `vercel.json` cron registration
5. Opportunity recency ranking (lowest priority, do last)

## Files touched
- `prisma/schema.prisma`
- `server/services/synthesis-service.ts`
- `server/services/opportunity-service.ts` (step 6 only)
- `app/api/cron/auto-synthesize/route.ts` (new)
- `vercel.json` (new or updated)

## Do NOT touch
- `server/services/ingestion-service.ts` — pipeline is already correct
- `server/jobs/dispatch.ts` — no changes needed
- `app/api/workspaces/[workspaceId]/synthesize/route.ts` — SSE streaming is fine as-is
- Any upload API routes
