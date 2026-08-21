<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Sentinel-Next Codebase Guide

> This file is **self-improving**. When you discover important architecture details, gotchas, or patterns during a session, update the relevant section below so future sessions start with that knowledge.

## Architecture Overview

Sentinel is currently a minimal skeleton for an AI mentor/tutor for children. Do not restore the deleted B2B product-management domain unless explicitly asked.

## Key Files

| File | Purpose |
|------|---------|
| `app/(dashboard)/layout.tsx` | Authenticated shell |
| `app/(dashboard)/dashboard/page.tsx` | Signed-in placeholder dashboard |
| `app/(marketing)/page.tsx` | Placeholder landing page |
| `lib/auth/helpers.ts` | User-only Clerk/Prisma helpers |
| `prisma/schema.prisma` | Minimal `User`, `WaitlistEntry`, and `ProductEvent` schema |

## Patterns

### API response format

All API routes use `apiSuccess(data)` and `apiError(code, message)` from `@/types`.

## Known Gotchas

- The `params` and `searchParams` in Next.js App Router page components are now Promises — always `await params` before destructuring
- Prisma client is at `@/lib/db/prisma` — never instantiate a new PrismaClient in route handlers
- Prisma is pinned to v6 so it can run without the removed PostgreSQL driver adapter; Prisma v7 requires an adapter or Accelerate URL.
- `npm run build` must not deploy migrations or otherwise mutate the production database.

## Self-Improvement Instructions

After each session working on this codebase:
- Document any new service patterns or API conventions
- Record bugs found and their root causes in "Known Gotchas"
