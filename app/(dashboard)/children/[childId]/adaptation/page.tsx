import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/helpers";
import { confidenceLabel } from "@/lib/learner/report";

/** A small inline chart of how a belief moved. Pure SVG, no library. */
function ConfidenceTrack({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const w = 220;
  const h = 40;
  const step = w / (points.length - 1);
  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${(i * step).toFixed(1)} ${(h - p * h).toFixed(1)}`)
    .join(" ");
  const last = points[points.length - 1];
  const rising = last >= points[0];

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0" aria-hidden>
      <line x1="0" y1={h * 0.5} x2={w} y2={h * 0.5} className="stroke-border" strokeDasharray="2 3" />
      <path
        d={d}
        fill="none"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        className={rising ? "stroke-foreground" : "stroke-muted-foreground"}
      />
      {points.map((p, i) => (
        <circle
          key={i}
          cx={i * step}
          cy={h - p * h}
          r={i === points.length - 1 ? 3 : 1.8}
          className={i === points.length - 1 ? "fill-foreground" : "fill-muted-foreground"}
        />
      ))}
    </svg>
  );
}

export default async function AdaptationPage({
  params,
}: {
  params: Promise<{ childId: string }>;
}) {
  const { childId } = await params;
  const user = await getCurrentUser();
  if (!user) notFound();

  const child = await prisma.child.findUnique({
    where: { id: childId },
    include: { mentorProfile: true },
  });
  if (!child || child.parentId !== user.id) notFound();

  const [hypotheses, interventions, events] = await Promise.all([
    prisma.hypothesis.findMany({
      where: { childId },
      include: {
        revisions: { orderBy: { createdAt: "asc" } },
        _count: { select: { supportingEvidence: true, contradictingEvidence: true } },
      },
      orderBy: { confidence: "desc" },
    }),
    prisma.intervention.findMany({
      where: { childId, successful: { not: null } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.learningEvent.findMany({ where: { childId }, orderBy: { createdAt: "desc" } }),
  ]);

  const name = child.name;
  const mentor = child.mentorProfile?.mentorName ?? "The mentor";

  // Strategy outcomes over time — this is the clearest evidence of adaptation:
  // something was tried, it failed, something else was tried, it worked.
  const byStrategy = new Map<string, { attempts: number; successes: number; first: Date; last: Date }>();
  for (const i of interventions) {
    const cur = byStrategy.get(i.strategy) ?? {
      attempts: 0,
      successes: 0,
      first: i.createdAt,
      last: i.createdAt,
    };
    cur.attempts += 1;
    if (i.successful) cur.successes += 1;
    cur.last = i.createdAt;
    byStrategy.set(i.strategy, cur);
  }
  const strategies = [...byStrategy.entries()].sort(
    (a, b) => b[1].successes - a[1].successes || a[1].first.getTime() - b[1].first.getTime()
  );

  const moved = hypotheses.filter((h) => h.revisions.length >= 2);

  return (
    <div className="mx-auto max-w-3xl space-y-12 px-6 py-8">
      <header className="space-y-4">
        <Link
          href={`/children/${childId}`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {name}
        </Link>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">How {mentor} adapted</h1>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
            {`Every belief about ${name} is provisional and moves as evidence arrives. This is the record of it changing.`}
          </p>
        </div>
      </header>

      {/* ── Belief trajectories ─────────────────────────────────────────── */}
      <section aria-labelledby="beliefs-heading">
        <h2 id="beliefs-heading" className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          How each belief moved
        </h2>

        {moved.length === 0 && (
          <p className="mt-4 text-[15px] text-muted-foreground">
            {`Nothing has been revised yet — beliefs start moving once ${name} gives us a second data point on the same thing.`}
          </p>
        )}

        <ul className="mt-5 space-y-8">
          {moved.map((h) => {
            const points = [h.revisions[0].before, ...h.revisions.map((r) => r.after)];
            const first = h.revisions[0];
            const last = h.revisions[h.revisions.length - 1];
            const delta = last.after - first.before;
            return (
              <li key={h.id} className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <p className="max-w-md flex-1 text-[15px] leading-relaxed">{h.description}</p>
                  <ConfidenceTrack points={points} />
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="font-mono">{h.type}</span>
                  <span>
                    {Math.round(first.before * 100)}% → {Math.round(last.after * 100)}%
                    <span className={delta >= 0 ? "text-foreground" : ""}>
                      {" "}
                      ({delta >= 0 ? "+" : ""}
                      {Math.round(delta * 100)} points)
                    </span>
                  </span>
                  <span>{confidenceLabel(h.confidence)}</span>
                  <span>
                    {h._count.supportingEvidence} for
                    {h._count.contradictingEvidence > 0
                      ? `, ${h._count.contradictingEvidence} against`
                      : ""}
                  </span>
                  {h.status !== "ACTIVE" && <span className="font-medium">{h.status}</span>}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ── Strategy switching ──────────────────────────────────────────── */}
      {strategies.length > 0 && (
        <section aria-labelledby="strategies-heading">
          <h2 id="strategies-heading" className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            What {mentor} tried, and what it does now
          </h2>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
            {`When an explanation does not land, it is recorded as not landing and is not reached for again. This is how the mentor learns how ${name} learns.`}
          </p>
          <ul className="mt-5 divide-y border-y">
            {strategies.map(([strategy, v]) => {
              const worked = v.successes > 0;
              return (
                <li key={strategy} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="text-[15px] capitalize">{strategy.replace(/_/g, " ")}</p>
                    <p className="text-xs text-muted-foreground">
                      first tried{" "}
                      {v.first.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      {v.attempts > 1
                        ? ` · used ${v.attempts} times`
                        : ""}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs ${
                      worked
                        ? "bg-foreground text-background"
                        : "border text-muted-foreground line-through"
                    }`}
                  >
                    {worked ? `worked ${v.successes}/${v.attempts}` : "did not land"}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* ── Milestones ──────────────────────────────────────────────────── */}
      {events.length > 0 && (
        <section aria-labelledby="events-heading">
          <h2 id="events-heading" className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Turning points
          </h2>
          <ol className="mt-5 space-y-5">
            {events.map((e) => (
              <li key={e.id} className="flex gap-4">
                <span className="w-16 shrink-0 pt-0.5 text-xs text-muted-foreground">
                  {e.createdAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
                <div>
                  <p className="text-[15px] leading-relaxed">{e.summary}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{e.type}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
