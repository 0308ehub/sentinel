import Link from "next/link";
import { SentinelMark } from "@/components/brand/sentinel-logo";

const LOOP = [
  { verb: "Observe", detail: "What did they actually say, and how fast?" },
  { verb: "Hypothesise", detail: "Three possible reasons, none of them certain." },
  { verb: "Probe", detail: "Ask the one question that tells them apart." },
  { verb: "Teach", detail: "Use the representation that works for this child." },
  { verb: "Verify", detail: "Check it held, days later, in a new form." },
  { verb: "Remember", detail: "Keep it. Use it next month." },
];

export default function LandingPage() {
  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section aria-labelledby="hero-heading" className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-40 -top-32 h-[36rem] w-[36rem] rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(circle, #e8d9c8 0%, transparent 65%)" }}
        />
        <div className="mx-auto max-w-6xl px-6 pb-24 pt-20 sm:pt-28">
          <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--rule)] bg-[var(--paper-deep)] px-4 py-1.5 text-xs font-medium tracking-wide text-[var(--ink-soft)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
            For children ages 5–9
          </p>

          <h1
            id="hero-heading"
            className="font-display max-w-4xl text-[clamp(2.75rem,1.5rem+5vw,5.5rem)] font-semibold leading-[0.95] tracking-tight"
          >
            A mentor that learns
            <br />
            <span className="italic text-[var(--accent)]">how your child thinks.</span>
          </h1>

          <p className="mt-8 max-w-xl text-lg leading-relaxed text-[var(--ink-soft)]">
            Most tutors adjust how hard the questions are. Sentinel builds a model of your
            child — what they understand, where they get stuck, which explanations land —
            and it keeps that understanding for years.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              href="/sign-up"
              className="rounded-full bg-[var(--ink)] px-7 py-3.5 font-medium text-[var(--paper)] transition-transform duration-200 hover:-translate-y-0.5 hover:bg-[var(--accent)]"
            >
              Meet your child&apos;s mentor
            </Link>
            <a
              href="#example"
              className="group inline-flex items-center gap-2 px-2 py-3.5 font-medium text-[var(--ink-soft)] transition-colors hover:text-[var(--ink)]"
            >
              See how it works
              <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
            </a>
          </div>
        </div>
      </section>

      {/* ── The contrast ─────────────────────────────────────────────────── */}
      <section className="border-y border-[var(--rule)] bg-[var(--paper-deep)]">
        <div className="mx-auto grid max-w-6xl gap-px overflow-hidden px-6 py-20 md:grid-cols-2 md:gap-16">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--ink-faint)]">
              Ordinary adaptive software
            </p>
            <p className="font-display mt-4 text-2xl leading-snug text-[var(--ink-faint)]">
              &ldquo;Subtraction: 50% correct. Serving easier problems.&rdquo;
            </p>
            <p className="mt-4 text-[var(--ink-soft)]">
              It knows a score. It does not know a child.
            </p>
          </div>
          <div className="relative md:pl-16">
            <span
              aria-hidden
              className="absolute left-0 top-0 hidden h-full w-px bg-[var(--rule)] md:block"
            />
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--accent)]">
              Sentinel
            </p>
            <p className="font-display mt-4 text-2xl leading-snug">
              &ldquo;She subtracts each digit on its own. Crossing ten is where it breaks.
              The number line worked last time.&rdquo;
            </p>
            <p className="mt-4 text-[var(--ink-soft)]">
              It knows the misconception, the cause, and the fix that works for her.
            </p>
          </div>
        </div>
      </section>

      {/* ── The worked example ───────────────────────────────────────────── */}
      <section id="example" aria-labelledby="example-heading" className="mx-auto max-w-6xl px-6 py-24">
        <h2 id="example-heading" className="font-display max-w-2xl text-4xl font-semibold leading-tight sm:text-5xl">
          One wrong answer, read properly.
        </h2>

        <div className="mt-14 grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
          <div className="rounded-2xl border border-[var(--rule)] bg-white/60 p-8 shadow-[0_1px_0_rgba(0,0,0,0.03),0_12px_32px_-12px_rgba(28,25,23,0.12)]">
            <div className="space-y-5 text-lg">
              <p className="text-[var(--ink-faint)]">Nova asks:</p>
              <p className="font-display text-2xl">What is 17 − 9?</p>
              <p className="text-[var(--ink-faint)]">Maya, age 7:</p>
              <p className="font-display text-2xl text-[var(--accent)]">&ldquo;Ten.&rdquo;</p>
              <hr className="border-[var(--rule)]" />
              <p className="text-[var(--ink-faint)]">Nova doesn&apos;t correct her. It asks:</p>
              <p className="font-display text-2xl">How did you figure that out?</p>
              <p className="text-[var(--ink-faint)]">Maya:</p>
              <p className="font-display text-2xl text-[var(--accent)]">
                &ldquo;I did 9 take away 7, then put the 1 back on.&rdquo;
              </p>
            </div>
          </div>

          <div className="space-y-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--ink-faint)]">
                What Sentinel records
              </p>
              <p className="mt-4 leading-relaxed text-[var(--ink-soft)]">
                Not &ldquo;got it wrong.&rdquo; It records a <em>misconception</em>: Maya treats
                the digits as separate numbers instead of one quantity. That is a specific,
                fixable idea — and a completely different problem from a counting slip or a
                guess.
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--ink-faint)]">
                What it does next
              </p>
              <p className="mt-4 leading-relaxed text-[var(--ink-soft)]">
                It switches representation — a number line, counters, whatever has worked for
                Maya before — and watches whether the idea actually takes hold.
              </p>
            </div>
            <div className="rounded-xl border-l-2 border-[var(--accent)] bg-[var(--paper-deep)] p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--ink-faint)]">
                Three weeks later, on 32 − 7
              </p>
              <p className="font-display mt-3 text-xl leading-snug">
                &ldquo;Remember when going backwards past ten was tricky? Let&apos;s use that
                number line you liked.&rdquo;
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── The loop ─────────────────────────────────────────────────────── */}
      <section
        id="how"
        aria-labelledby="how-heading"
        className="border-y border-[var(--rule)] bg-[var(--paper-deep)]"
      >
        <div className="mx-auto max-w-6xl px-6 py-24">
          <h2 id="how-heading" className="font-display max-w-2xl text-4xl font-semibold leading-tight sm:text-5xl">
            Every single turn.
          </h2>
          <p className="mt-5 max-w-xl text-[var(--ink-soft)]">
            Behind a friendly conversation, one loop runs continuously.
          </p>

          <ol className="mt-14 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {LOOP.map((step, i) => (
              <li key={step.verb} className="group relative">
                <div className="flex items-baseline gap-4">
                  <span className="font-mono text-xs text-[var(--ink-faint)]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="font-display text-2xl font-semibold">{step.verb}</h3>
                </div>
                <p className="mt-2 pl-9 leading-relaxed text-[var(--ink-soft)]">{step.detail}</p>
                <span className="mt-5 ml-9 block h-px w-12 bg-[var(--accent)] transition-all duration-300 group-hover:w-24" />
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── The long arc ─────────────────────────────────────────────────── */}
      <section aria-labelledby="arc-heading" className="mx-auto max-w-6xl px-6 py-28">
        <h2 id="arc-heading" className="sr-only">
          How the relationship deepens over time
        </h2>
        <div className="space-y-2">
          {[
            { when: "Week one", what: "It remembers me.", muted: false },
            { when: "Six months", what: "It understands me.", muted: false },
            { when: "Years", what: "It grew up with me.", muted: false },
          ].map((row, i) => (
            <div
              key={row.what}
              className="flex flex-col gap-1 border-t border-[var(--rule)] py-8 sm:flex-row sm:items-baseline sm:gap-12"
            >
              <p className="w-32 shrink-0 text-xs font-semibold uppercase tracking-[0.15em] text-[var(--ink-faint)]">
                {row.when}
              </p>
              <p
                className="font-display font-semibold leading-none tracking-tight"
                style={{ fontSize: `clamp(2rem, ${1.5 + i * 0.9}rem + ${3 + i * 1.4}vw, ${3.5 + i * 1.5}rem)` }}
              >
                {row.what}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Parents / safety ─────────────────────────────────────────────── */}
      <section
        id="safety"
        aria-labelledby="safety-heading"
        className="border-t border-[var(--rule)] bg-[var(--paper-deep)]"
      >
        <div className="mx-auto max-w-6xl px-6 py-24">
          <h2 id="safety-heading" className="font-display max-w-2xl text-4xl font-semibold leading-tight sm:text-5xl">
            Built for the parent, not around them.
          </h2>

          <div className="mt-14 grid gap-10 md:grid-cols-3">
            {[
              {
                title: "You set it up",
                body: "You create the account and give consent before your child ever talks to Nova. No child has a login of their own.",
              },
              {
                title: "You see everything",
                body: "Every conversation is reviewable. Nothing your child says is hidden from you, and Nova never encourages secrecy.",
              },
              {
                title: "You can erase it",
                body: "Delete your child's data whenever you want, in full. We designed for that from the first table onward.",
              },
            ].map((card) => (
              <div key={card.title}>
                <h3 className="font-display text-xl font-semibold">{card.title}</h3>
                <p className="mt-3 leading-relaxed text-[var(--ink-soft)]">{card.body}</p>
              </div>
            ))}
          </div>

          <p className="mt-14 max-w-2xl border-l-2 border-[var(--rule)] pl-6 text-sm leading-relaxed text-[var(--ink-faint)]">
            Nova always tells a child it is a computer program, never claims to be human, never
            asks for personal details, and stays inside learning. Every message is screened
            before it is sent and after it is written.
          </p>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-28 text-center">
        <SentinelMark size={40} className="mx-auto text-[var(--ink)]" />
        <h2 className="font-display mx-auto mt-8 max-w-2xl text-4xl font-semibold leading-tight sm:text-5xl">
          Give your child a tutor who knows them.
        </h2>
        <p className="mx-auto mt-5 max-w-md text-[var(--ink-soft)]">
          Ten minutes is enough for Nova to start learning who they are.
        </p>
        <Link
          href="/sign-up"
          className="mt-10 inline-block rounded-full bg-[var(--ink)] px-8 py-4 font-medium text-[var(--paper)] transition-transform duration-200 hover:-translate-y-0.5 hover:bg-[var(--accent)]"
        >
          Get started
        </Link>
      </section>
    </>
  );
}
