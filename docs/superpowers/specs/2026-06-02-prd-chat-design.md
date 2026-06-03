# PRD Chat — Design Spec
**Date:** 2026-06-02  
**Status:** Approved, ready for implementation

---

## 1. Problem & Goal

PRDs are generated once and then only editable via a raw textarea. Users have no way to continue refining a PRD with AI help inside the app — they copy-paste into ChatGPT instead. The goal is an AI conversation layer tied to each PRD, where the AI can propose per-hunk diffs that the user can accept or reject like Cursor does for code.

---

## 2. User-Facing Behavior

1. User opens a PRD page → a **"PRD: [title]"** tab automatically opens in the right-side agent panel (alongside any existing session tabs).
2. User types a message (e.g. "Add a phased rollout section") → AI streams a response with explanation text, then proposes a revised PRD.
3. The PRD viewer switches to **diff mode**: unchanged lines are normal, removed lines are red, added lines are green. Each changed block (hunk) has **Accept** and **Reject** buttons.
4. User accepts/rejects individual hunks. A floating bar shows "N changes pending • Accept all • Reject all".
5. Once all hunks are resolved, a **Save** button appears and commits the result.
6. The conversation is **persisted to the database** — returning to the PRD page shows the full message history.
7. While a diff is pending (any hunk unresolved), the chat input is **disabled** with hint: "Resolve pending changes to continue."
8. Closing the PRD tab and reopening it (or navigating away and back) restores the same conversation.

---

## 3. Architecture

Four components work together:

```
PRDPageClient
  → on mount: openPRDTab(prdId, prdTitle)       [workspace context]
  → on mount: setPRDWorkingContent(prdId, content)
  → watches:  prdProposals.get(prdId)  →  computeHunks()  →  DiffState

AgentPanel / ChatBody (PRD session)
  → on tab open: GET /api/prds/[prdId]/conversation  (get or create)
  → on send:     POST /api/prds/[prdId]/chat
  → on prd_edit SSE event: setPRDProposal(prdId, proposedContent)
  → input blocked while prdProposals.has(prdId)

POST /api/prds/[prdId]/chat
  → saves user message to DB
  → calls Anthropic with PRD + opportunity + evidence context
  → streams SSE; detects <prd_edit> tag, buffers it, emits prd_edit event
  → saves assistant text (without prd_edit block) to DB

PRD DB schema
  → Conversation.prdId (new optional FK to PRD)
```

---

## 4. Database Schema Changes

### 4a. Migration

Add `prdId` to `Conversation` and add back-relation on `PRD`:

```prisma
model Conversation {
  id          String   @id @default(cuid())
  workspaceId String
  userId      String
  prdId       String?          // NEW — null for regular agent sessions
  title       String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  workspace Workspace    @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  user      User         @relation(fields: [userId], references: [id])
  prd       PRD?         @relation(fields: [prdId], references: [id], onDelete: Cascade)
  messages  Message[]

  @@index([prdId])   // NEW
}

model PRD {
  // ...all existing fields unchanged...
  conversations Conversation[]  // NEW back-relation
}
```

One PRD has at most one conversation. The `GET /api/prds/[prdId]/conversation` endpoint creates it on first access.

Migration name: `add-prd-conversation-link`

### 4b. No changes to Message model

`Message.metadata` (already `Json?`) is available but not used for diffs — the `prd_edit` event is ephemeral SSE, never persisted. The assistant message saved to DB contains only the explanation text (not the `<prd_edit>` block content).

---

## 5. New API Endpoints

### 5a. `GET /api/prds/[prdId]/conversation`

**Purpose:** Get-or-create the persisted conversation for a PRD. Called by the panel on tab open.

**Auth:** `requireUser()` + PRD ownership check (same pattern as existing `verifyPRDAccess`).

**Response:**
```json
{
  "ok": true,
  "data": {
    "conversationId": "...",
    "messages": [
      { "id": "...", "role": "USER", "content": "...", "createdAt": "..." },
      { "id": "...", "role": "ASSISTANT", "content": "...", "createdAt": "..." }
    ]
  }
}
```

**Logic:**
1. Find `Conversation` where `prdId = prdId` — include `messages` ordered by `createdAt ASC`.
2. If none: create `Conversation` with `{ workspaceId, userId, prdId, title: "PRD: ${prd.title}" }`.
3. Return `{ conversationId, messages }`.

---

### 5b. `POST /api/prds/[prdId]/chat`

**Purpose:** Send a user message, get an AI response as SSE.

**Auth:** `requireUser()` + PRD ownership check.

**Request body:**
```json
{
  "message": "Add a phased rollout section",
  "conversationId": "...",
  "currentContent": "# PRD: ..."
}
```

**SSE event types emitted:**
| Event type | Payload | Meaning |
|---|---|---|
| `text_delta` | `{ content: string }` | Streamed explanation text |
| `prd_edit` | `{ proposedContent: string }` | Full revised PRD content |
| `done` | — | Stream complete |
| `error` | `{ message: string }` | Unrecoverable error |

**Server logic:**
1. Auth + PRD access check.
2. Validate body with Zod.
3. Save user `Message` to DB (`role: USER, content: message`).
4. Fetch linked opportunity (if any) + 6 relevant evidence chunks via `retrieveWorkspaceContext`.
5. Build system prompt (see Section 7).
6. Call Anthropic `messages.stream()` with full conversation history (loaded from DB) + new user message.
7. **SSE tag detection while streaming:**
   - Accumulate streamed text in a buffer.
   - When `<prd_edit>` is detected in the buffer: stop forwarding characters as `text_delta`. Switch to PRD-buffering mode.
   - When `</prd_edit>` is detected: extract buffered content, emit `prd_edit` event. Resume forwarding if any trailing text follows.
   - If stream ends with `<prd_edit>` opened but not closed: emit `error` event — malformed response.
   - Text before `<prd_edit>` streams as `text_delta` normally.
8. On stream complete: save assistant `Message` to DB with the explanation text (the content before `<prd_edit>`; the PRD block itself is not saved).
9. Emit `done`.

**Error handling:**
- Malformed `<prd_edit>` tag (opened, never closed): emit `error`, do not show diff.
- DB save failure: log, do not block the stream response.
- Anthropic error: emit `error` event.

---

## 6. Workspace Context Changes

### 6a. Updated `ChatSession` type

```typescript
interface ChatSession {
  id: string
  label: string
  messages: AgentMessage[]
  // PRD session fields (undefined for regular sessions):
  prdId?: string
  prdTitle?: string
  conversationId?: string   // set after GET /api/prds/[prdId]/conversation resolves
  historyLoaded?: boolean   // prevents double-fetch on re-render
}
```

### 6b. New context values

```typescript
interface WorkspaceContextValue {
  // ...existing values...

  // PRD tab management:
  openPRDTab: (prdId: string, prdTitle: string) => void

  // Working content (updated as hunks are accepted/rejected — not yet saved):
  setPRDWorkingContent: (prdId: string, content: string) => void
  getPRDWorkingContent: (prdId: string) => string | undefined

  // Pending AI proposals (set by panel, read by PRD page):
  prdProposals: Map<string, string>   // prdId → proposedContent
  setPRDProposal: (prdId: string, proposedContent: string) => void
  clearPRDProposal: (prdId: string) => void
}
```

### 6c. `openPRDTab` behavior

1. Search `sessions` for one with `prdId === prdId`.
2. If found: call `setActiveSession(existingSession.id)`. Return.
3. If not found: create `{ id: uuid, label: "PRD: [prdTitle]", messages: [], prdId, prdTitle, historyLoaded: false }`. Add to sessions. Set as active.

### 6d. State storage

- `prdWorkingContent`: `useRef<Map<string, string>>` (no re-render needed; ChatBody reads it synchronously on send).
- `prdProposals`: `useState<Map<string, string>>` (triggers re-render on PRD page when proposal arrives).

---

## 7. Agent Panel Changes (`agent-panel.tsx`)

### 7a. Session tabs

No visual changes needed. PRD tabs render with a `FileText` icon instead of `Bot` to visually distinguish them.

```typescript
// In SessionTabs, per tab:
const Icon = session.prdId ? FileText : Bot
```

### 7b. `ChatBody` branching

`ChatBody` reads `activeSession` and branches on `session.prdId`:

**PRD session — initialization (runs once when `historyLoaded` is false):**
```
GET /api/prds/[session.prdId]/conversation
→ set session.conversationId
→ load messages into session.messages (map DB MessageRole to AgentMessage shape)
→ set session.historyLoaded = true
```

Show a loading skeleton while `historyLoaded` is false.

**PRD session — sending a message:**
```
POST /api/prds/[session.prdId]/chat
body: {
  message,
  conversationId: session.conversationId,
  currentContent: getPRDWorkingContent(session.prdId) ?? ""
}
```

**PRD session — SSE parsing additions:**
Same loop as existing agent session, plus:
```typescript
} else if (event.type === "prd_edit" && event.proposedContent) {
  setPRDProposal(session.prdId, event.proposedContent)
}
```

**PRD session — input disabled while diff pending:**
```typescript
const diffPending = prdProposals.has(session.prdId ?? "")
// Pass diffPending to Textarea disabled prop
// Show hint below input: "Resolve pending changes to continue"
```

**PRD session — welcome screen:**
```
"I'm reviewing '[prd.title]' with you. Ask me to add sections,
sharpen requirements, adjust scope, or clarify anything."
```
No suggested prompts for PRD sessions (too generic to be useful).

**Regular session:** all existing behavior unchanged.

---

## 8. PRD Page Client Changes (`prd-page-client.tsx`)

### 8a. New imports and state

```typescript
import { useWorkspace } from "../workspace-context"

const { openPRDTab, setPRDWorkingContent, getPRDWorkingContent,
        prdProposals, clearPRDProposal } = useWorkspace()

// Working content: starts as prd.content, updated as hunks are accepted/rejected
const [workingContent, setWorkingContent] = useState(prd.content)

// Active diff state (null when no diff pending)
const [diffState, setDiffState] = useState<DiffState | null>(null)
```

### 8b. Mount/unmount effects

```typescript
// Register PRD tab in agent panel
useEffect(() => {
  openPRDTab(prd.id, prd.title)
  setPRDWorkingContent(prd.id, prd.content)
  return () => clearPRDProposal(prd.id)   // cleanup on unmount
}, [prd.id, prd.title])

// Sync working content to context whenever it changes
useEffect(() => {
  setPRDWorkingContent(prd.id, workingContent)
}, [prd.id, workingContent])
```

### 8c. Watch for proposals

```typescript
useEffect(() => {
  const proposed = prdProposals.get(prd.id)
  if (!proposed) return
  const hunks = computeHunks(workingContent, proposed)
  setDiffState({ proposedContent: proposed, hunks })
  clearPRDProposal(prd.id)
}, [prdProposals])
```

### 8d. Hunk accept/reject handlers

```typescript
function acceptHunk(hunkId: string) {
  setDiffState((prev) => {
    if (!prev) return null
    const updated = prev.hunks.map((h) =>
      h.id === hunkId ? { ...h, status: "accepted" as const } : h
    )
    // Recompute working content from all accepted hunks
    const newContent = applyHunks(prd.content, updated)  // see Section 9
    setWorkingContent(newContent)
    return { ...prev, hunks: updated }
  })
}

function rejectHunk(hunkId: string) {
  setDiffState((prev) => {
    if (!prev) return null
    return {
      ...prev,
      hunks: prev.hunks.map((h) =>
        h.id === hunkId ? { ...h, status: "rejected" as const } : h
      ),
    }
  })
}

function acceptAll() { /* accept each hunk in order */ }
function rejectAll() { /* reject all, setDiffState(null) */ }
```

### 8e. Save after resolving

When `diffState` is non-null and all hunks have `status !== "pending"`:

```typescript
const allResolved = diffState?.hunks.every((h) => h.status !== "pending") ?? false
```

Show "Save changes" button. On click: `PATCH /api/prds/[prd.id]` with `{ content: workingContent }`. On success: `setDiffState(null)`, `router.refresh()`.

### 8f. Existing edit mode

Disable the "Edit" button while `diffState` is non-null. Tooltip: "Resolve pending changes first."

---

## 9. Diff Computation

### 9a. Types

```typescript
// In a new file: lib/diff/prd-diff.ts

export interface DiffHunk {
  id: string
  // Line numbers in the ORIGINAL content (0-indexed)
  oldStart: number
  oldLines: string[]   // lines removed (empty array = pure addition)
  newLines: string[]   // lines added   (empty array = pure deletion)
  status: "pending" | "accepted" | "rejected"
}

export interface DiffState {
  proposedContent: string
  hunks: DiffHunk[]
}
```

### 9b. `computeHunks(oldContent, newContent): DiffHunk[]`

Use the `diff` npm package's `diffLines(oldContent, newContent)` function. If `diff` is not in `package.json`, add it (`npm install diff && npm install -D @types/diff`).

Algorithm:
1. Call `diffLines(oldContent, newContent)` → array of `Change` objects.
2. Walk changes, group consecutive removed/added pairs into hunks.
3. Each hunk gets a stable `id` (e.g. `hunk-${index}`).
4. Skip unchanged-only spans — these are context lines, not hunks.

### 9c. `applyHunks(originalContent, hunks): string`

Reconstructs the working content by walking the original lines and applying each hunk based on its current status:
- `accepted`: replace `oldLines` with `newLines`
- `rejected` or `pending`: keep `oldLines`

Process hunks in reverse line order to avoid index shifting.

### 9d. PRD viewer diff rendering

Three render modes (controlled by `diffState` and `editing` flags):

**View mode** (`!editing && !diffState`): existing `<pre>` render, unchanged.

**Edit mode** (`editing && !diffState`): existing textarea, unchanged.

**Diff mode** (`diffState !== null`): replaces the content area with a line-by-line diff renderer.

```
┌─────────────────────────────────────────────────────────────────┐
│ ⚡ 3 changes pending                    Accept all  Reject all  │  ← floating bar
├─────────────────────────────────────────────────────────────────┤
│  # PRD: Feature Name                                            │  ← unchanged (context)
│  ...                                                            │
│ ─────────────── Hunk 1 of 3 ────────────────────────────────── │
│ - ## 3. Supporting Evidence                                     │  ← red, removed
│ + ## 3. Supporting Evidence & Metrics                          │  ← green, added
│                              [Accept ✓]  [Reject ✗]            │
│  ...                                                            │
│ ─────────────── Hunk 2 of 3 ────────────────────────────────── │
│  (additions only — new section)                                 │
│ + ## 9. Phased Rollout                                          │  ← green
│ + Phase 1: ...                                                  │
│ + Phase 2: ...                                                  │
│                              [Accept ✓]  [Reject ✗]            │
└─────────────────────────────────────────────────────────────────┘
```

Accepted hunks: lines turn from green to normal text, buttons disappear.  
Rejected hunks: lines disappear, context snaps back.  
When all resolved: bar changes to "All changes resolved — Save to apply" + Save button.

---

## 10. System Prompt for PRD Chat

```
You are Sentinel, a product management assistant helping refine a PRD.

Current PRD content:
---
{currentContent}
---

{if opportunity:}
Linked opportunity: {opportunity.title}
Problem: {opportunity.problemStatement}
Proposed solution: {opportunity.proposedSolution}
Target segments: {opportunity.targetSegments.join(", ")}
{/if}

{if evidenceChunks.length > 0:}
Relevant customer evidence (use this to ground your suggestions):
{evidenceChunks.map(c => c.content).join("\n\n---\n\n")}
{/if}

Rules:
- For questions, discussion, or feedback: respond conversationally. Do NOT include a <prd_edit> block.
- When the user asks you to ADD, CHANGE, REMOVE, REWRITE, or otherwise modify the PRD:
  1. First, briefly explain what you changed and why (1-3 sentences).
  2. Then output the COMPLETE revised PRD (every section) wrapped in:
     <prd_edit>
     [full revised markdown here]
     </prd_edit>
- ALWAYS include the full PRD in the edit block — never partial sections only.
- Preserve all sections not explicitly changed.
- Ground additions and changes in the provided customer evidence where possible.
```

Evidence retrieval: `retrieveWorkspaceContext({ workspaceId, query: userMessage, limit: 6 })`.

---

## 11. Error Handling

| Scenario | Behavior |
|---|---|
| `GET /api/prds/[prdId]/conversation` fails | Show error state in tab with retry button |
| `POST /api/prds/[prdId]/chat` stream error | Show error message bubble in chat; input re-enabled |
| AI returns `<prd_edit>` but tag never closes | Emit `error` SSE event; no diff shown; log server-side |
| `PATCH /api/prds/[prdId]` save fails | Toast error; diff state preserved (user can retry save) |
| User navigates away with pending diff | Diff state is in React state — lost on unmount. Working content is NOT auto-saved. This is acceptable for MVP. |
| PRD tab opened on a PRD the user doesn't own | `GET /api/prds/[prdId]/conversation` returns 403; tab shows "Access denied" |

---

## 12. Files to Create / Modify

### New files
| File | Purpose |
|---|---|
| `lib/diff/prd-diff.ts` | `DiffHunk`, `DiffState` types, `computeHunks()`, `applyHunks()` |
| `components/prd/prd-diff-viewer.tsx` | Diff mode renderer (line-by-line with accept/reject) |
| `app/api/prds/[prdId]/conversation/route.ts` | GET — get-or-create PRD conversation |
| `app/api/prds/[prdId]/chat/route.ts` | POST — PRD chat SSE endpoint |
| `prompts/prd-chat-system.ts` | System prompt for PRD chat AI |

### Modified files
| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `prdId` to `Conversation`; back-relation on `PRD` |
| `app/(dashboard)/workspaces/[workspaceId]/workspace-context.tsx` | New context values: `openPRDTab`, `setPRDWorkingContent`, `getPRDWorkingContent`, `prdProposals`, `setPRDProposal`, `clearPRDProposal` |
| `app/(dashboard)/workspaces/[workspaceId]/agent-panel.tsx` | PRD session type handling in `SessionTabs` and `ChatBody`; `prd_edit` SSE parsing; input disable logic |
| `app/(dashboard)/workspaces/[workspaceId]/prd/[prdId]/prd-page-client.tsx` | `openPRDTab` on mount; diff state management; render mode switching; hunk accept/reject; save handler |
| `app/api/prds/[prdId]/route.ts` | No changes needed (PATCH endpoint already exists) |

---

## 13. Implementation Order

Build in this order to keep each step independently verifiable:

1. **Schema + migration** — add `prdId` to `Conversation`, run migration
2. **`GET /api/prds/[prdId]/conversation`** — get-or-create, return messages
3. **`POST /api/prds/[prdId]/chat`** — SSE endpoint with tag detection (test with curl before wiring UI)
4. **`lib/diff/prd-diff.ts`** — `computeHunks` + `applyHunks` (unit-testable in isolation)
5. **`components/prd/prd-diff-viewer.tsx`** — diff renderer component (stub with fake hunks to test UI)
6. **Workspace context** — new fields and methods
7. **Agent panel** — PRD session branching, history load, `prd_edit` handling, input disable
8. **`PRDPageClient`** — mount effects, proposal watcher, hunk handlers, mode switching, save

---

## 14. Out of Scope (MVP)

- Multiple conversations per PRD (one per PRD is enough)
- Streaming the diff as it arrives (full PRD edit is emitted as one event after `</prd_edit>`)
- Persisting partially-resolved diff state across page refreshes
- Syntax-highlighted markdown diff (plain line diff is sufficient)
- Undo/redo for accepted hunks
