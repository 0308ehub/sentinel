@AGENTS.md

## Project status

- **Kismet is the primary product.** `main` is Kismet and is the branch that deploys to the live app (app.sentinelai.one).
- **Do not touch Elva.** The earlier AI-mentor product is frozen on `legacy/elva` (tag `elva-archive`). Do not edit it, cherry-pick fixes onto it, or merge it back into `main`. Any work targeting Elva-era files (`app/`, `lib/learner/`, Prisma 7, `scripts/build.mjs`) is out of date — put it into Kismet under `src/` instead.
