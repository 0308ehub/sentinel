# Autopilot: Kismet as an autonomous product manager

## Why
Kismet should run the product loop on its own: listen to customers, notice
problems once there is enough evidence, design and build an experiment, and
after it ships, measure it and iterate. A human only steps in right before
something reaches real users.

## Decisions (from the user)
- **One human gate:** everything before shipping to prod (listen, notice,
  design, build the PR) and everything after (measure, read out, iterate) is
  Kismet's job. A person approves the ship.
- **First target is Kismet itself** (repo `0308ehub/sentinel`,
  app.sentinelai.one). A demo product is the next stage.
- **Fake data is fine for now.** Real data is used whenever it appears. Every
  piece of evidence is labelled real or synthetic, and the report never passes
  synthetic evidence off as real.
- **Every claim is backed by evidence** the user can expand down to the raw
  message, ticket or number.
- **Anti-goal:** anything that is not immediately obvious to use. One page, a
  short list of things that need you, plain words.

## The loop
1. **Listen:** collect evidence (Slack, support tickets, analytics findings;
   synthetic generator while there is no real traffic).
2. **Notice:** group evidence into problems ("signals"). A signal is ready once
   it has at least 5 pieces of evidence from at least 2 sources.
3. **Design:** turn a ready signal into an experiment brief: hypothesis,
   metric (a tracked event), guardrail, control, treatment.
4. **Build:** write the change behind a per-user flag and open a PR.
5. **Gate:** the user clicks *Approve & ship* (merges the PR). Merging on
   GitHub works too.
6. **Measure:** once merged, Kismet turns the flag on for a 50/50 split and
   counts visitors and conversions per arm from tracked events.
7. **Read out:** two-proportion test once each arm has enough visitors.
8. **Iterate:** a winner waits for one-click rollout approval (it changes prod
   for everyone); a loser or a flat result is switched off automatically and
   Kismet drafts the next version (up to 3 per signal).

## My calls (builder)
- Storage: Postgres via `postgres` (no ORM), all tables in schema `kismet` and
  created on first use, so nothing touches Elva's tables in the shared Neon
  database. Locally `KISMET_DATABASE_URL`, in prod falls back to
  `DATABASE_URL`.
- Flags live in the database, so merged experiment code stays dark until
  Kismet starts the experiment, and rollout/kill needs no new deploy.
  Assignment is a hash of a `kismet_vid` cookie and the flag.
- A tracker in the root layout records page views, impressions and clicks of
  elements with `data-track`, tagged with the visitor's arms.
- One loop step per call to `/api/autopilot/tick` (Vercel cron, plus a
  *Run now* button). Each step is idempotent and logs what it did.
- UI is a single `/autopilot` page: summary line, **Needs you**, **Running**,
  **What's not working** (signals with expandable evidence), **History**.

## Phases
1. Storage, synthetic evidence, clustering into signals, `/autopilot` page.
2. Experiment design, flagged PR, approval and merge.
3. Tracker, flags, measurement (with a synthetic traffic simulator), readout,
   iterate.
4. Cron, weekly summary, real Slack/Jira ingestion.

## Running experiments at the same time
Kismet decides by itself how experiments may coexist (`src/lib/autopilot/overlap.ts`):
- **Same file → one at a time.** A change whose file another active experiment (or its pending
  cleanup) still uses waits, rather than being forced into a different file.
- **Same page or same metric → mutually exclusive.** They share a layer; each owns a separate slice
  of the layer's visitors, so nobody is in both. A newcomer takes the largest free slice (at least
  30%) or queues and starts automatically when one frees up. An experiment that starts while a
  conflicting one is already on its way takes half, so the other doesn't have to queue.
- **Everything else → overlapping, independently randomized** (each experiment hashes with its own
  key), plus an interaction check: if one experiment's effect differs significantly (|z| > 2.58)
  depending on the other's version, its decision is held; when the other finishes it measures again
  from scratch on clean traffic.
