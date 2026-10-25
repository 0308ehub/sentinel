# Kismet

> **Kismet is the primary product.** `main` is Kismet and is what deploys to the live app (app.sentinelai.one). Elva, the earlier AI-mentor product, is frozen on the `legacy/elva` branch and tag `elva-archive` — do not change it or merge it back into `main`.

The operating system for product development. A graph-centric platform where every document, metric, decision, and customer signal connects into a living Product Knowledge Graph.

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — redirects to the dashboard.

> **Note:** Requires Node.js ≥ 20.9.0 for Next.js 16. Prisma requires disk space for `npm install -D prisma`.

## Architecture

```
src/
├── app/                    # Next.js App Router pages
│   ├── dashboard/          # Product health overview
│   ├── explorer/           # VS Code-style hierarchy browser
│   ├── features/[id]/      # Four-panel feature workspace
│   ├── timeline/           # Auto-generated event timeline
│   ├── graph/              # React Flow knowledge graph
│   ├── analytics/          # BigQuery-inspired analytics
│   ├── decisions/          # Decision explorer
│   ├── ai/                 # AI workspace + Product Debugger
│   └── api/                # REST endpoints
├── components/
│   ├── ui/                 # Design system (shadcn-style)
│   ├── layout/             # App shell, sidebar, header
│   ├── dashboard/          # Dashboard widgets
│   ├── explorer/           # Tree + table explorer
│   ├── feature-workspace/  # Four-panel editor
│   ├── graph/              # React Flow visualization
│   ├── timeline/           # Timeline engine
│   ├── analytics/          # TanStack Table analytics
│   ├── decisions/          # Decision records
│   ├── ai/                 # AI chat + debugger
│   ├── search/             # Command palette (⌘K)
│   └── shared/             # Reusable primitives
├── lib/
│   ├── data/seed.ts        # Realistic demo graph data
│   └── graph/              # Graph utilities + search
├── stores/                 # Zustand (UI + workspace state)
└── types/                  # TypeScript graph types

prisma/
└── schema.prisma           # Full PostgreSQL schema
```

## Core Concepts

### Product Knowledge Graph
Every entity is a **node** connected by typed **edges**. Nodes include Features, PRDs, Metrics, Decisions, PRs, Support Tickets, and 25+ other types. The graph is the source of truth — not documents.

### Views
All views are lenses into the same graph:
- **Dashboard** — health, risks, launches, AI recommendations
- **Explorer** — searchable hierarchy
- **Feature Workspace** — four-panel editing (evidence / specs / delivery / metrics)
- **Timeline** — auto-built from graph events
- **Graph View** — interactive React Flow canvas
- **Analytics** — SQL-like queries linked to graph nodes
- **Decisions** — searchable decision records with evidence
- **AI Workspace** — graph-aware AI + Product Debugger

### Product Git (Roadmap)
The schema includes `GraphSnapshot` for versioning the entire product graph — checkout state at any date, compare roadmap versions, replay feature evolution.

## Tech Stack

- **Next.js 16** (App Router) + TypeScript
- **Tailwind CSS 4** + shadcn/ui components
- **React Query** + **Zustand**
- **Prisma** + PostgreSQL
- **React Flow** (@xyflow/react)
- **TanStack Table** + **Recharts**
- **Clerk** (auth) + **OpenAI** (AI workspace)

## Database Setup

When disk space is available:

```bash
npm install -D prisma tsx
npx prisma generate
npx prisma db push
npx prisma db seed
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘K` → **Propose feature…** | Create a new feature in the product graph |
| `⌘K` | Universal search / command palette |

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/graph` | Full graph snapshot |
| `GET /api/dashboard` | Dashboard summary data |
