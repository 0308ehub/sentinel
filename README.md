# Sentinel — AI-Native Product Discovery

Sentinel is a full-stack AI workspace for product managers. Upload customer interviews, support tickets, and sales calls; Sentinel extracts pain points, clusters insights, surfaces prioritised opportunities, and generates PRDs and engineering tickets — all powered by Claude and pgvector.

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, full-stack) |
| Auth | Clerk |
| Database | PostgreSQL + pgvector |
| ORM | Prisma 7 |
| AI (text) | Anthropic Claude (claude-sonnet-4-6) |
| AI (embeddings) | OpenAI text-embedding-3-small |
| Job queue | BullMQ + Redis |
| UI | shadcn/ui + Tailwind CSS |

## Prerequisites

- Node.js 20+
- Docker (for Postgres + Redis)
- An [Anthropic API key](https://console.anthropic.com)
- An [OpenAI API key](https://platform.openai.com/api-keys)
- A [Clerk](https://clerk.com) application (free tier works)

## Local Setup

### 1. Start infrastructure

```bash
docker-compose up -d
```

This starts PostgreSQL (port 5432) with pgvector and Redis (port 6379).

### 2. Configure environment variables

Copy `.env.local` and fill in your keys:

```bash
# Already created at .env.local — edit it:
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# From Clerk dashboard → API Keys:
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...   # set after step 5
```

### 3. Run database migrations

```bash
npm run db:migrate
```

This creates all tables and enables the pgvector extension.

### 4. Seed demo data (optional)

```bash
npm run db:seed
```

Seeds a demo workspace with realistic B2B SaaS customer evidence — interviews, support tickets, sales calls, user feedback, and an analytics summary — so you can test the full pipeline immediately.

### 5. Configure Clerk webhook

In your Clerk dashboard, create a webhook endpoint pointing to:

```
https://<your-ngrok-or-domain>/api/webhooks/clerk
```

Select the `user.created` event. Copy the signing secret into `CLERK_WEBHOOK_SECRET`.

For local dev you can use [ngrok](https://ngrok.com):
```bash
ngrok http 3000
```

### 6. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 7. Start the background worker (optional but recommended)

In a second terminal:

```bash
npm run worker
```

The worker processes document ingestion and synthesis jobs asynchronously. Without it, processing falls back to synchronous mode (slower but functional).

## NPM Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Production build |
| `npm run worker` | Start BullMQ background worker |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:push` | Push schema without migration (dev only) |
| `npm run db:generate` | Regenerate Prisma client |
| `npm run db:seed` | Seed demo workspace |
| `npm run db:studio` | Open Prisma Studio |

## Architecture

```
app/
  (auth)/                  Sign-in / sign-up pages (Clerk)
  (dashboard)/
    dashboard/             User home — recent workspaces & activity
    workspaces/
      [workspaceId]/
        page.tsx           Workspace overview
        documents/         Upload & manage evidence
        insights/          Synthesized pain points & feature requests
        opportunities/     Ranked product opportunities
        prd/               Generate & edit PRDs
        chat/              RAG-powered AI chat
  api/                     Next.js route handlers (REST API)

lib/
  ai/                      Anthropic + OpenAI provider abstractions
  ingestion/               Document parsers (PDF, CSV, plain text)
  retrieval/               pgvector similarity search
  scoring/                 Opportunity scoring formula

server/
  services/                Business logic (ingestion, extraction, synthesis)
  jobs/                    BullMQ queue definitions
  worker.ts                Worker entry point

prompts/                   Zod-validated prompt schemas
prisma/
  schema.prisma            Full data model
  seed.ts                  Demo data
```

## Pipeline

1. **Upload** — user uploads a file or pastes text
2. **Parse** — extract raw text from PDF / CSV / plain text
3. **Chunk** — split into ~800-token overlapping chunks
4. **Embed** — generate OpenAI embeddings, store with pgvector
5. **Extract** — Claude extracts pain points, feature requests, segments, quotes
6. **Synthesize** — cluster pain points by cosine similarity (threshold 0.82), label clusters, generate opportunities
7. **Score** — `totalScore = impact×0.35 + confidence×0.25 + urgency×0.20 + (6-effort)×0.15 + (6-risk)×0.05`, normalized 0–100
8. **PRD** — Claude generates structured PRD from selected opportunity
9. **Tickets** — Claude breaks PRD into engineering tickets with priority/effort
10. **Chat** — RAG retrieves relevant chunks, Claude answers questions about evidence

## Environment Variables Reference

```bash
DATABASE_URL="postgresql://sentinel:sentinel@localhost:5432/sentinel"
DIRECT_URL="postgresql://sentinel:sentinel@localhost:5432/sentinel"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
ANTHROPIC_API_KEY=""
OPENAI_API_KEY=""
REDIS_URL="redis://localhost:6379"
UPLOAD_MAX_FILE_MB="20"
CLERK_SECRET_KEY=""
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=""
CLERK_WEBHOOK_SECRET=""
```
