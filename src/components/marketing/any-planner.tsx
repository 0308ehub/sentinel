"use client";

import { useMemo, useState, type ReactNode } from "react";
import { planDesigns, winningDesign, type PlanGoal } from "@/lib/any/planner";

const GOALS: { id: PlanGoal; label: string }[] = [
  { id: "speed", label: "Speed" },
  { id: "price", label: "Price" },
  { id: "customers", label: "Customers" },
  { id: "locked", label: "Locked sample" },
];

export function AnyPlanner() {
  const [weekly, setWeekly] = useState(20000);
  const [baselinePct, setBaselinePct] = useState(8);
  const [liftPct, setLiftPct] = useState(10);
  const [cpm, setCpm] = useState(8);
  const [goal, setGoal] = useState<PlanGoal>("speed");

  const designs = useMemo(
    () =>
      planDesigns({
        weeklyVisits: weekly,
        baseline: baselinePct / 100,
        relativeLift: liftPct / 100,
        costPerThousand: cpm,
      }),
    [weekly, baselinePct, liftPct, cpm]
  );
  const winner = winningDesign(designs, goal);
  const chosen = designs.find((item) => item.id === winner) ?? designs[0];
  const days = designs.map((item) => item.days);
  const costs = designs.map((item) => item.cost);
  const daySpan = Math.max(1, Math.max(...days) - Math.min(...days));
  const costSpan = Math.max(1, Math.max(...costs) - Math.min(...costs));
  const x0 = Math.max(0, Math.min(...days) - daySpan * 0.45);
  const x1 = Math.max(...days) + daySpan * 0.55;
  const y0 = Math.max(0, Math.min(...costs) - costSpan * 0.45);
  const y1 = Math.max(...costs) + costSpan * 0.55;
  const tooLong = designs.some((item) => item.days > 365);

  return (
    <section className="px-6 py-20 md:px-8" aria-labelledby="any-cost">
      <h2 id="any-cost" className="text-center text-4xl tracking-[-0.04em] text-[#111] md:text-5xl">
        What a run costs
      </h2>
      <p className="mx-auto mt-4 max-w-xl text-center text-[15px] leading-relaxed text-[#3c4250]">
        A planning sketch for this traffic and this effect. Price, speed, and the people on the worse version do not pick the same design.
      </p>

      <div className="mx-auto mt-10 grid max-w-5xl gap-10 lg:grid-cols-[280px_1fr]">
        <div className="space-y-5 text-sm">
          <Field label="Visits per week" value={weekly.toLocaleString()}>
            <input type="range" min={1000} max={200000} step={1000} value={weekly} onChange={(event) => setWeekly(Number(event.target.value))} className="w-full" />
          </Field>
          <Field label="Baseline rate" value={`${baselinePct}%`}>
            <input type="range" min={1} max={40} value={baselinePct} onChange={(event) => setBaselinePct(Number(event.target.value))} className="w-full" />
          </Field>
          <Field label="Lift to detect" value={`${liftPct}% relative`}>
            <input type="range" min={5} max={50} value={liftPct} onChange={(event) => setLiftPct(Number(event.target.value))} className="w-full" />
          </Field>
          <Field label="Cost per thousand visits" value={`$${cpm}`}>
            <input type="range" min={0} max={40} value={cpm} onChange={(event) => setCpm(Number(event.target.value))} className="w-full" />
          </Field>
          <div>
            <p className="text-[#5c6570]">Optimize for</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {GOALS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setGoal(item.id)}
                  className={`rounded-full px-3 py-1 text-[13px] ${goal === item.id ? "bg-[#111] text-white" : "bg-[#f2f2f2] text-[#111]"}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <svg viewBox="0 0 640 360" className="w-full" style={{ fontFamily: "inherit" }} role="img" aria-label="Days against cost for a fixed test, a sequential test, and a bandit">
            <line x1="48" y1="36" x2="48" y2="292" stroke="#eceef1" />
            <line x1="48" y1="292" x2="600" y2="292" stroke="#eceef1" />
            <text x="48" y="22" fill="#5c6570" fontSize="12">
              Cost
            </text>
            <text x="600" y="316" fill="#5c6570" fontSize="12" textAnchor="end">
              Days to a call
            </text>
            {designs.map((item) => {
              const x = 72 + ((item.days - x0) / (x1 - x0)) * 480;
              const y = 272 - ((item.cost - y0) / (y1 - y0)) * 210;
              const on = item.id === winner;
              const name = item.id === "fixed" ? "Fixed" : item.label;
              return (
                <g key={item.id}>
                  {on && <circle cx={x} cy={y} r="14" fill="none" stroke="#111" strokeWidth="1" />}
                  <circle cx={x} cy={y} r="6" fill={on ? "#0571d3" : "#111"} />
                  <text x={x} y={y - 16} fill="#111" fontSize="13" textAnchor="middle">
                    {name}
                  </text>
                </g>
              );
            })}
          </svg>
          <p className="text-[15px] leading-relaxed text-[#111]">
            {chosen.label}. {chosen.days.toLocaleString()} days, ${chosen.cost.toLocaleString()}, {chosen.worse.toLocaleString()} people on the worse version.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[#5c6570]">{chosen.note}</p>
          {tooLong && (
            <p className="mt-2 text-sm leading-relaxed text-[#5c6570]">
              At this traffic, that lift takes more than a year. any% would look for a larger effect or a metric that moves sooner.
            </p>
          )}
        </div>
      </div>

      <p className="mx-auto mt-8 max-w-2xl text-center text-[13px] leading-relaxed text-[#5c6570]">
        Sample size is a two-proportion test at 95% confidence and 80% power. Sequential uses about 70% of that sample when the effect is real, and the cap can be higher. The sketch adds $400 of monitoring for a sequential test and $700 for a bandit, so a cheap visit can favor a fixed test. These are not Kismet prices.
      </p>
    </section>
  );
}

function Field({ label, value, children }: { label: string; value: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between text-[#5c6570]">
        {label}
        <span className="text-[#111]">{value}</span>
      </span>
      <span className="mt-2 block">{children}</span>
    </label>
  );
}
