import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mic } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/helpers";
import { buildParentReport, masteryLabel, confidenceLabel } from "@/lib/learner/report";
import { getConcept } from "@/lib/curriculum/graph";

const DOMAIN_LABEL: Record<string, string> = {
  MATH: "Numbers",
  READING: "Reading",
  REASONING: "Thinking",
};

const MASTERY_FILL: Record<string, string> = {
  "Not started": "w-0",
  Beginning: "w-[15%]",
  Developing: "w-[45%]",
  Secure: "w-[75%]",
  Mastered: "w-full",
};

export default async function ChildReportPage({
  params,
}: {
  params: Promise<{ childId: string }>;
}) {
  const { childId } = await params;
  const user = await getCurrentUser();
  if (!user) notFound();

  const owned = await prisma.child.findUnique({ where: { id: childId } });
  if (!owned || owned.parentId !== user.id) notFound();

  const r = await buildParentReport(childId);
  const name = r.child.name;
  const mentor = r.child.mentorProfile?.mentorName;

  const byDomain = r.skills.reduce<Record<string, typeof r.skills>>((acc, s) => {
    (acc[s.concept.domain] ??= []).push(s);
    return acc;
  }, {});

  const hasAnything = r.stats.totalSessions > 0;

  return (
    <div className="mx-auto max-w-3xl space-y-12 px-6 py-8">
      <header className="space-y-4">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          All children
        </Link>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Age {r.child.ageYears}
              {r.child.gradeLabel ? ` · ${r.child.gradeLabel}` : ""}
              {mentor ? ` · mentor named ${mentor}` : " · mentor not named yet"}
            </p>
          </div>
          <Link
            href={`/learn/${childId}`}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            <Mic className="h-4 w-4" />
            Start a session
          </Link>
        </div>
      </header>

      {!hasAnything ? (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <p className="font-medium">Nothing to report yet</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            After {name}&apos;s first conversation, this page will show what they&apos;re
            learning and what we&apos;ve noticed about how they think.
          </p>
        </div>
      ) : (
        <>
          {/* ── This week ─────────────────────────────────────────────── */}
          <section aria-labelledby="week-heading">
            <h2 id="week-heading" className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              This week
            </h2>
            <dl className="mt-4 flex flex-wrap gap-x-12 gap-y-4">
              {[
                { label: "sessions", value: r.stats.sessionsThisWeek },
                { label: "minutes", value: r.stats.minutesThisWeek },
                { label: "concepts touched", value: r.stats.conceptsTouched },
                { label: "mastered", value: r.stats.conceptsMastered },
              ].map((s) => (
                <div key={s.label}>
                  <dd className="text-3xl font-semibold tabular-nums">{s.value}</dd>
                  <dt className="mt-0.5 text-sm text-muted-foreground">{s.label}</dt>
                </div>
              ))}
            </dl>
          </section>

          {/* ── What they're learning ─────────────────────────────────── */}
          {r.skills.length > 0 && (
            <section aria-labelledby="learning-heading" className="space-y-6">
              <h2 id="learning-heading" className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                What {name} is learning
              </h2>
              {Object.entries(byDomain).map(([domain, skills]) => (
                <div key={domain}>
                  <h3 className="mb-3 text-sm font-medium">{DOMAIN_LABEL[domain] ?? domain}</h3>
                  <ul className="space-y-3">
                    {skills.map((s) => {
                      const label = masteryLabel(s);
                      return (
                        <li key={s.id} className="flex items-center gap-4">
                          <span className="flex-1 text-sm">{s.concept.label}</span>
                          <span className="h-1.5 w-32 overflow-hidden rounded-full bg-muted">
                            <span
                              className={`block h-full rounded-full bg-foreground ${MASTERY_FILL[label]}`}
                            />
                          </span>
                          <span className="w-24 text-right text-xs text-muted-foreground">
                            {label}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </section>
          )}

          {/* ── What we've noticed ────────────────────────────────────── */}
          {(r.hypotheses.length > 0 || r.provisionalCount > 0) && (
            <section aria-labelledby="noticed-heading">
              <h2 id="noticed-heading" className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                What we&apos;ve noticed about {name}
              </h2>
              {r.hypotheses.length === 0 && (
                <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
                  Nothing confirmed yet. We&apos;re watching a few early patterns but
                  haven&apos;t seen them often enough to tell you about them.
                </p>
              )}
              <ul className="mt-4 space-y-4">
                {r.hypotheses.map((h) => (
                  <li key={h.id} className="border-l-2 border-border pl-4">
                    <p className="text-[15px] leading-relaxed">{h.description}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {confidenceLabel(h.confidence)}
                      {h.status === "CONFIRMED" ? " · seen repeatedly" : ""}
                    </p>
                  </li>
                ))}
              </ul>
              <p className="mt-5 max-w-xl text-xs leading-relaxed text-muted-foreground">
                These are working theories, not conclusions. Each is held with a
                confidence that moves as {name} gives us more evidence, and we don&apos;t
                show you anything resting on a single moment.
                {r.provisionalCount > 0
                  ? ` ${r.provisionalCount} early observation${r.provisionalCount === 1 ? " is" : "s are"} still being checked.`
                  : ""}
              </p>
            </section>
          )}

          {/* ── What works ────────────────────────────────────────────── */}
          {(r.bestStrategies.length > 0 || r.interests.length > 0) && (
            <section aria-labelledby="works-heading" className="space-y-4">
              <h2 id="works-heading" className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                What works for {name}
              </h2>
              {r.bestStrategies.length > 0 && (
                <p className="text-[15px] leading-relaxed">
                  Explanations that have landed:{" "}
                  {r.bestStrategies.map((s) => s.strategy.replace(/_/g, " ")).join(", ")}.
                </p>
              )}
              {r.interests.length > 0 && (
                <p className="text-[15px] leading-relaxed text-muted-foreground">
                  Examples are built around what {name} likes:{" "}
                  {r.interests.slice(0, 6).map((i) => i.label).join(", ")}.
                </p>
              )}
            </section>
          )}

          {/* ── What's next ───────────────────────────────────────────── */}
          {r.nextConceptIds.length > 0 && (
            <section aria-labelledby="next-heading">
              <h2 id="next-heading" className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                What&apos;s next
              </h2>
              <ul className="mt-4 space-y-2">
                {r.nextConceptIds.map((id) => {
                  const c = getConcept(id);
                  if (!c) return null;
                  return (
                    <li key={id} className="text-[15px]">
                      <span className="font-medium">{c.label}</span>
                      <span className="text-muted-foreground"> — {c.description}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* ── Sessions ──────────────────────────────────────────────── */}
          <section aria-labelledby="sessions-heading">
            <h2 id="sessions-heading" className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Conversations
            </h2>
            <ul className="mt-4 divide-y border-y">
              {r.sessions.slice(0, 8).map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/children/${childId}/sessions/${s.id}`}
                    className="group flex items-center justify-between gap-4 py-3 text-sm transition-colors hover:text-foreground"
                  >
                    <span className="shrink-0">
                      {s.startedAt.toLocaleDateString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    {s.summary && (
                      <span className="hidden flex-1 truncate text-muted-foreground sm:block">
                        {s.summary}
                      </span>
                    )}
                    <span className="flex shrink-0 items-center gap-3 text-muted-foreground">
                      {s._count.messages} message{s._count.messages === 1 ? "" : "s"}
                      <span className="opacity-0 transition-opacity group-hover:opacity-100">→</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              Every conversation is reviewable. Nothing {name} says is hidden from you.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
