# The experiment loop (any% in the app)

## Why
The most impressive part of Kismet to demo is automated experimentation. The full
loop has to work, and look good, from start to finish:

1. **Read context.** Company goals, user behavior by segment, support and
   session evidence, the codebase, and past experiments.
2. **Decide what to test.** Ranked proposals, each one backed by the evidence it
   came from, skipping ideas that already lost or that collide with a live test.
3. **Design it.** Objective, primary metric, variants, segments with their own
   success definitions, guardrails, sample size, minimum detectable effect,
   duration, and the exact result that would count as significant.
4. **Run it.** Kismet watches the results as they come in, posts updates on its
   own, and stops early when a pre-set boundary is crossed (win, harm, or
   futility) instead of waiting out the full duration.
5. **Decide and ship.** Kismet reads the result (overall, by segment, against
   the guardrails), recommends what to do, opens the code change that keeps the
   winner and removes the flag, and a person approves it with one click.
6. **Loop.** The readout is filed and the next proposal starts from it.

## Decisions
- **Self-contained demo that never breaks.** It runs entirely in the browser on
  a fictional demo company with rich context. No database, warehouse, or GitHub
  is needed. Results come from a seeded traffic simulator on a simulated clock
  (a day every couple of seconds, with play, pause, and speed controls).
- **The statistics are real.** The simulator only produces visitors and
  outcomes. Power analysis, sequential boundaries, guardrail tests, sample ratio
  checks, and segment readouts are real calculations on that data, in pure
  TypeScript modules with unit tests.
- **AI is optional, never load-bearing.** Proposal writing and the readout text
  can go through the model (`askForJson`), but every call has a deterministic
  fallback built from the company context, so the demo works with no API key
  and never shows a spinner that never stops.
- **Demo company: "Pantry"**, a recipe app (free with ads, plus a Premium
  subscription), defined in one file so it can be renamed or swapped. It has
  real tradeoffs. More ads raise revenue and can hurt retention. Time on page
  is not the same goal as coming back. That is what makes the guardrails
  matter.
- **Where it lives:** `/experiments` becomes the experiment loop (lab home), and
  `/experiments/[id]` shows a lab experiment. Graph-based experiment nodes keep
  their old detail page as a fallback. The Agents page shows the four loop
  agents (Scout, Designer, Analyst, Shipper) doing the real work of the loop,
  next to the custom agents people make there.

## Objectives and guardrails
Every experiment names exactly one **objective**, and the objective sets the
primary metric and the default guardrails:

| Objective | Primary metric | Default guardrails (stop or block ship if breached) |
|---|---|---|
| Retention (users come back) | D7 return rate | Ad revenue per user ≥ −2%, crash/error rate not up |
| Engagement (users stay) | Recipe completion rate / engaged minutes | D7 return ≥ −1.5%, page load p75 ≤ +100ms |
| Monetization (ad revenue) | Ad revenue per user | D7 return ≥ −1%, engaged minutes ≥ −3%, Premium conversion ≥ −5% |
| Conversion (Premium) | Premium trial start rate | D7 return ≥ −1%, refund rate not up |

Guardrails are one-sided non-inferiority tests at a stricter level (99%). Each
one has a margin, a direction, and an action: **stop now** (harm guardrail) or
**block ship** (it must clear before shipping).

## Segments
New (first 7 days), Casual, Power cooks, Premium. Each experiment says which
segments it targets and can define a segment-specific success metric (for
example, new users are judged on D7 return, power cooks on recipes saved). The
readout reports each segment with its own interval and flags real differences
between segments (an interaction test), so the decision can be "ship to new
users only".

## Design math
- Binary metrics: two-proportion sample size, alpha 0.05 two-sided, power 0.8.
  Continuous metrics: the same with the metric's standard deviation.
- Duration = sample needed ÷ eligible daily traffic × allocation, rounded up to
  whole weeks (at least 7 days, to cover weekly cycles), capped at 28 days.
- Sequential monitoring: group sequential design with Lan-DeMets
  O'Brien-Fleming alpha spending at 5 planned looks (one per info fraction
  0.2…1.0), with the max sample inflated by about 3%. Efficacy boundary on the
  primary metric, non-binding futility boundary (conditional power < 10% after
  look 2), and harm boundaries on guardrails checked at every look.
- Sample ratio check: chi-square on arm counts, p < 0.001 halts the readout.
- The brief states in plain words what counts as significant, for example
  "Treatment wins if D7 return is at least 3.1% higher than control with the
  z-score past 2.96 at look 2, 2.36 at look 3, … 2.01 at the final look."

## Demo scenarios (seeded)
1. **Save prompt after 60 seconds of reading** (retention). Real positive effect,
   mostly in new users. Crosses the efficacy boundary at look 3, about 9 days
   early. The hero path.
2. **Second ad slot mid-recipe** (monetization). Ad revenue up about 9%, but
   D7 return drops past the guardrail. Kismet stops it for harm.
3. **Sticky ingredient checklist** (engagement). No real effect. Stopped for
   futility.
4. **Paywall after the 3rd saved recipe** (conversion). Waits in the queue
   because it touches the same page as #1 and starts when #1 ends.

## The loop agents
- **Scout** reads the context and writes proposals.
- **Designer** turns a proposal into a brief and design.
- **Analyst** watches running experiments and posts updates.
- **Shipper** writes the readout and the code change, and waits for approval.

Their status and latest action come from the lab's state, not from a random
ticker.

## Out of scope for the demo
Real event ingestion, real PRs (the code change is shown as a diff and "merged"
in the demo), and multi-arm bandits (they appear in the design choice only).
