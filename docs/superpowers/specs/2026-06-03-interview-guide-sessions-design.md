# Interview Guide Sessions Design

**Date:** 2026-06-03
**Status:** Approved

## Overview

Extend the existing ephemeral Interview Guide Generator into a persistent, session-aware interview management system. Guides are saved to the database, each guide can have multiple interview sessions (one per interviewee), each session captures per-question notes inline during the interview, and Sentinel can synthesize all sessions into a summary that both appears on the guide page and enters the workspace document pipeline.

## Data Model

Four new Prisma models added to the existing schema.

### InterviewGuide
Persisted version of what the generator currently holds in React state.

```
id                String   @id @default(cuid())
workspaceId       String
title             String
customerSegment   String
interviewType     String   (Discovery | Validation | Churn Exit | Onboarding)
focusArea         String?
openingStatement  String
closingStatement  String
createdAt         DateTime @default(now())
updatedAt         DateTime @updatedAt

relations:
  workspace  → Workspace (cascade delete)
  questions  → InterviewQuestion[]
  sessions   → InterviewSession[]
```

### InterviewQuestion
One row per question on the guide. Replaces the ephemeral `InterviewQuestion[]` array.

```
id        String  @id @default(cuid())
guideId   String
theme     String
question  String
probe     String?
order     Int

relations:
  guide  → InterviewGuide (cascade delete)
  notes  → SessionNote[]
```

### InterviewSession
One row per interview conducted (one person, one sitting).

```
id                  String   @id @default(cuid())
guideId             String
intervieweeName     String
intervieweeRole     String?
intervieweeCompany  String?
date                DateTime
generalNotes        String?
createdAt           DateTime @default(now())
updatedAt           DateTime @updatedAt

relations:
  guide  → InterviewGuide (cascade delete)
  notes  → SessionNote[]
```

### SessionNote
One row per question per session. Upserted on autosave.

```
id         String   @id @default(cuid())
sessionId  String
questionId String
content    String
updatedAt  DateTime @updatedAt

relations:
  session   → InterviewSession (cascade delete)
  question  → InterviewQuestion (cascade delete)

unique: [sessionId, questionId]
```

## Page Structure

### `/interview-guide`
List page. Shows all saved guides for the workspace in a table/card list:
- Title, customer segment, interview type, session count, created date
- "New Guide" button opens the generator form

### `/interview-guide/new` (or modal)
The existing generator form, now saves to DB on submit instead of setting React state. On success, redirects to the guide detail page.

### `/interview-guide/[guideId]`
Guide detail page with three sections:

1. **Header** — title, segment, type, edit controls
2. **Questions** — editable list; inline edit per question (text + probe + theme), reorder via drag or up/down buttons, add/remove questions
3. **Sessions** — table of all sessions (interviewee name, role, company, date); "New Session" button
4. **Synthesis** — "Synthesize All Sessions" button; once run, renders the AI output (themes, patterns, quotes, next steps) inline; shows a link to the generated workspace document

### `/interview-guide/[guideId]/sessions/new`
Short form to create a session: interviewee name (required), role, company, date (defaults to today).

### `/interview-guide/[guideId]/sessions/[sessionId]`
Conductor view — used during a live interview.

- **Left panel** (narrow): interviewee metadata, date, editable general notes textarea
- **Right panel** (wide): scrollable list of questions grouped by theme; each question card has the question text, optional probe hint, and an answer textarea beneath it
- Notes autosave with a 1-second debounce on each textarea change (PUT to the batch notes endpoint)
- Autosave indicator in the header ("Saving…" / "Saved")

## API Routes

### Guide CRUD
```
GET    /api/workspaces/[workspaceId]/interview-guide
         → list all guides (with session count)

POST   /api/workspaces/[workspaceId]/interview-guide
         → create guide + questions from generator output
         body: { title, customerSegment, interviewType, focusArea,
                 openingStatement, closingStatement, questions[] }

GET    /api/workspaces/[workspaceId]/interview-guide/[guideId]
         → guide + questions + sessions (metadata only, no notes)

PATCH  /api/workspaces/[workspaceId]/interview-guide/[guideId]
         → update title, focusArea, openingStatement, closingStatement,
           or full questions array (replaces questions, reorders by array index)

DELETE /api/workspaces/[workspaceId]/interview-guide/[guideId]
         → cascade deletes questions, sessions, notes
```

### Session CRUD
```
POST   /api/workspaces/[workspaceId]/interview-guide/[guideId]/sessions
         body: { intervieweeName, intervieweeRole, intervieweeCompany, date }

GET    /api/workspaces/[workspaceId]/interview-guide/[guideId]/sessions/[sessionId]
         → session metadata + notes (keyed by questionId)

PATCH  /api/workspaces/[workspaceId]/interview-guide/[guideId]/sessions/[sessionId]
         → update metadata + generalNotes
```

### Notes Autosave
```
PUT    /api/workspaces/[workspaceId]/interview-guide/[guideId]/sessions/[sessionId]/notes
         body: { notes: [{ questionId, content }] }
         → batch upsert SessionNote rows (unique on sessionId+questionId)
```

### Synthesis
```
POST   /api/workspaces/[workspaceId]/interview-guide/[guideId]/synthesize
         → gather all sessions + all SessionNotes for the guide
         → send to Claude with structured prompt
         → receive: { themes[], patterns[], quotes[], nextSteps[] }
         → create a Document record (sourceType: INTERVIEW_SYNTHESIS)
           with the synthesis as content, triggering normal ingestion pipeline
         → store synthesis JSON on the InterviewGuide record (new `synthesis` JSON field)
         → return synthesis + documentId
```

The synthesis prompt instructs Claude to:
- Identify recurring themes across interviewees
- Surface patterns (what most people said, what was surprising)
- Pull 3–5 notable verbatim quotes
- Recommend 2–3 next steps for the product team

## Synthesis Output Shape (stored in `InterviewGuide.synthesis`)

```json
{
  "generatedAt": "ISO timestamp",
  "sessionCount": 4,
  "themes": [{ "title": "...", "summary": "..." }],
  "patterns": [{ "observation": "...", "frequency": "3 of 4 interviewees" }],
  "quotes": [{ "interviewee": "...", "quote": "...", "context": "..." }],
  "nextSteps": ["..."]
}
```

## Key Decisions

- **Autosave over explicit save** for session notes — reduces friction during live interviews where the user's focus is on the conversation, not the UI.
- **Batch notes upsert** — single PUT with all notes for the session rather than per-note endpoints, keeps network overhead low during typing.
- **Synthesis stored as JSON on the guide + as a Document** — the guide page can render it immediately without re-fetching, while the Document copy enters the pipeline for Sentinel's broader synthesis.
- **Questions are fully editable after generation** — the generator output is a starting point, not locked output.

## Out of Scope

- Real-time collaborative note-taking (multiple users in same session simultaneously)
- Audio recording or transcription
- Exporting guides/sessions to PDF (can be added later)
- Per-session AI synthesis (only full-guide synthesis across all sessions)
