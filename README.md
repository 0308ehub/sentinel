# Elva

**An AI mentor for children that learns how each child thinks and grows with them over time.**

Elva starts with foundational learning — reading, writing, and arithmetic — but instead of
simply adapting question difficulty, it builds a **persistent model of the child**: what they
understand, where they struggle, how they reason, which explanations work for them, and what
they are curious about.

If a child can solve `17 − 6` but consistently struggles with `17 − 9`, Elva identifies the
underlying misconception — regrouping across a ten — and changes *how* it teaches, rather than
just serving easier problems.

As the child grows, the mentor grows with them. It remembers years of learning and life context
and gradually expands beyond academic skills into critical thinking, reasoning, and
age-appropriate ethical dilemmas. The goal is to give every child something closer to a great
lifelong tutor and mentor: one that knows them deeply, adapts to how they learn, and helps them
become a better thinker over time.

---

## Status

> **Early skeleton.** The repository was reset on 2026-08-20 from a previous product
> (an autonomous product-manager tool). What remains on `main` is deliberately minimal
> infrastructure — auth, database, AI provider layer, and a UI kit. The product itself and the
> marketing site are both still to be designed and built. The placeholder UI is throwaway.

| Branch | Contents |
|---|---|
| `main` | The skeleton for the new product. Deploys to production. |
| `legacy/cursor-for-pms` | The complete previous product, preserved and intact. Do not delete. |

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router, React Server Components) |
| Language | TypeScript |
| Database | PostgreSQL + `pgvector`, hosted on Neon |
| ORM | Prisma 7 (driver adapter — see gotchas) |
| Auth | Clerk |
| AI | Anthropic Claude, with a provider abstraction; OpenAI for embeddings |
| UI | Tailwind CSS + shadcn/ui, `next-themes`, `lucide-react`, `sonner` |
| Hosting | Vercel |

## Project Layout

```
app/
├── (marketing)/       Public landing page  (placeholder)
├── (auth)/            Clerk sign-in / sign-up
├── (dashboard)/       Authenticated app shell  (placeholder)
└── api/
    ├── users/sync/    Clerk webhook → upserts the User row
    └── waitlist/      Waitlist signups
components/
├── ui/                shadcn primitives (22 components)
├── providers.tsx      App-wide providers
└── theme-*.tsx        Dark/light theming
lib/
├── ai/                Anthropic client, provider abstraction, embeddings
├── auth/helpers.ts    getCurrentUser() / requireUser()
├── db/prisma.ts       Prisma singleton (pg driver adapter)
└── hooks/             use-progress-stream (SSE)
prisma/
├── schema.prisma      User, WaitlistEntry, ProductEvent
└── migrations/        Single init migration
```

## Getting Started

**Prerequisites:** Node 20+, Docker (for local Postgres), a Clerk application, an Anthropic API key.

```bash
git clone git@github.com:0308ehub/sentinel.git
cd sentinel
npm install

cp .env.example .env.local     # then fill in the values below
docker compose up -d           # Postgres 16 + pgvector on :5432
npx prisma migrate dev         # apply the init migration
npm run dev                    # http://localhost:3000
```

### Environment Variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string (pooled) |
| `DIRECT_URL` | Direct connection, used for migrations |
| `NEXT_PUBLIC_APP_URL` | Base URL of the app |
| `ANTHROPIC_API_KEY` | Claude API access |
| `OPENAI_API_KEY` | Embeddings |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk client key |
| `CLERK_SECRET_KEY` | Clerk server key |
| `CLERK_WEBHOOK_SECRET` | Verifies the `users/sync` webhook |

Never commit these. `.env*` is gitignored; production values live in Vercel's encrypted
environment variables.

### Scripts

| Command | Does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | `prisma generate && next build` |
| `npm run lint` | ESLint |
| `npm run db:migrate` | `prisma migrate dev` |
| `npm run db:push` | Push schema without a migration |
| `npm run db:studio` | Prisma Studio |

---

## Data Model

Currently minimal and intentionally so:

- **`User`** — one row per Clerk identity. This is the **parent / account holder**, not a child.
- **`WaitlistEntry`** — pre-launch email capture.
- **`ProductEvent`** — lightweight analytics.

### The next modelling decision

A child is **not** a login. The intended shape is:

```
User (parent)  →  Child  →  LearnerModel / Sessions / Attempts
```

One parent may have several children; the learner model hangs off the `Child`, not the `User`.
Everything downstream keys off this, so it is worth settling before writing tutor logic.

Multi-tenancy is **row-scoped, not database-per-user** — one database, every table carrying a
`userId` / `childId` foreign key, and every query filtered on it.

---

## Handling Children's Data

This product stores a longitudinal model of how a specific child thinks. Treat that as among the
most sensitive categories of personal data, and design for it from the start rather than
retrofitting:

- **COPPA** applies to users under 13 in the US — verifiable parental consent, data
  minimisation, retention limits, and deletion on request.
- Build **per-child hard deletion** in from the beginning. Purging one child must not require
  surgery across a dozen tables.
- Be deliberate about what child data is sent to third-party model providers, and whether
  zero-retention terms are needed.
- Keep the learner model isolated enough to export or delete independently.

This is engineering guidance, not legal advice — get real counsel before launch.

---

## Gotchas

- **Prisma 7 requires a driver adapter.** `@prisma/adapter-pg` and `pg` are *not* optional
  dependencies — the client will not work without them. Likewise, the `datasource` block in
  `schema.prisma` has **no `url` field** in v7; the connection string is supplied via
  `prisma.config.ts`.
- **`jsonrepair` is load-bearing** in `lib/ai/anthropic.ts`. It repairs malformed JSON returned
  by the model (unescaped quotes, trailing commas, control characters). Do not remove it as an
  unused dependency.
- **Builds do not run migrations.** `npm run build` is `prisma generate && next build`.
  Migrations are applied deliberately, never as a deploy side effect.
- **Server Components by default.** `params` and `searchParams` are Promises in the App Router —
  `await` them before destructuring.
- **API envelope.** All routes return `apiSuccess(data)` / `apiError(code, message)` from
  `@/types`.

## Deployment

Vercel project **`sentinel`**, deploying `main` to production. Preview deployments are created
for every branch and pull request. There are no cron jobs.

## License

Private and unlicensed. All rights reserved.
