import Link from "next/link";
import { ExperimentDemo } from "@/components/marketing/experiment-demo";
import { MarketingFrame } from "@/components/marketing/marketing-frame";
import { SafariFrame } from "@/components/marketing/safari-frame";
import { SiteFooter } from "@/components/marketing/site-footer";
import { TopoField } from "@/components/marketing/topo-field";

const CARDS = [
  {
    photo: "/marketing/winter.jpg",
    title: "It reads the company before it picks a test",
    body: "Warehouse numbers, tickets, and what people said become one experiment, with the metric and the guardrails written down.",
    demo: <ContextCard />,
  },
  {
    photo: "/marketing/lines.png",
    title: "Every test stays in a ledger you can open later",
    body: "The idea, the statistic, the looks, and the decision sit in one table. The next question can see what already shipped.",
    demo: <LedgerCard />,
  },
  {
    photo: "/marketing/forest.jpg",
    title: "The editor writes the diff. Kismet keeps the statistic.",
    body: "Cursor or Claude Code ships the change. Kismet watches the looks, stops the test when it clears the boundary, and pushes the arm that won.",
    demo: <ShipCard />,
  },
];

export function LandingView() {
  return (
    <MarketingFrame footer={false} tone="white">
      <main>
        <section className="mx-auto max-w-[1100px] px-6 pb-2 pt-16 md:px-8 md:pt-24">
          <h1 className="max-w-[16em] text-[clamp(2.1rem,4.4vw,3.5rem)] font-medium leading-[1.05] tracking-[-0.045em] text-[#111]">
            Context-aware autonomous experimentation for product teams.
          </h1>
          <p className="mt-5 max-w-[38em] text-base leading-relaxed text-[#3f3f3f] md:text-lg">
            Kismet decides what to test from the company context, writes the guardrails and the statistics, and stops the experiment when the result is real. The code goes out through Cursor or Claude Code.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/sign-up" className="inline-flex h-10 items-center rounded-md bg-[#111] px-4 text-sm font-medium text-white hover:bg-[#0571d3]">
              Sign up
            </Link>
            <Link href="/contact" className="inline-flex h-10 items-center rounded-md bg-[#f4f4f2] px-4 text-sm font-medium text-[#111] hover:text-[#0571d3]">
              Contact sales
            </Link>
          </div>
        </section>

        <section className="mx-auto max-w-[1200px] px-4 pb-8 pt-12 md:px-8 md:pt-16" aria-label="Experiment demo">
          <div className="relative overflow-hidden rounded-[22px]">
            <img src="/marketing/forest.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className="relative z-10 p-4 sm:p-8 md:p-12">
              <SafariFrame>
                <ExperimentDemo surface="window" />
              </SafariFrame>
            </div>
          </div>
          <p className="mx-auto mt-4 max-w-[46em] text-center text-sm text-[#5c5c5c]">
            Context, the guardrails, the five looks, the ship, and the stop. The test stays open while it is merely ahead.
          </p>
        </section>

        <section className="mx-auto max-w-[1200px] px-6 py-16 md:px-8 md:py-24" aria-label="How the loop works">
          <div className="grid gap-10 md:grid-cols-3 md:gap-6">
            {CARDS.map((card) => (
              <article key={card.title}>
                <div className="relative overflow-hidden rounded-2xl">
                  <img src={card.photo} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  <div className="relative p-4 sm:p-5">{card.demo}</div>
                </div>
                <h2 className="mt-5 text-[1.15rem] font-medium leading-snug tracking-[-0.02em] text-[#111]">{card.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-[#4a4a4a]">{card.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="relative overflow-hidden border-t border-[#eee] bg-[#f7f7f5]" aria-label="The loop keeps running">
          <TopoField id="home-lines" ink />
          <div className="relative mx-auto max-w-[760px] px-6 py-24 text-center md:py-32">
            <p className="text-[clamp(1.6rem,3vw,2.4rem)] font-medium leading-[1.15] tracking-[-0.035em] text-[#111]">
              It stops the experiment when the statistic clears, and ships the arm that won.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </MarketingFrame>
  );
}

function ContextCard() {
  return (
    <div className="rounded-xl bg-white p-4 text-[#111] shadow-[0_10px_30px_rgba(0,0,0,0.12)]">
      <p className="text-xs font-medium text-[#6b6b6b]">From the warehouse and from Slack</p>
      <p className="mt-2 text-sm font-medium">Purchases per 1,000 impressions fell from 18.4 to 14.1.</p>
      <ul className="mt-3 space-y-2 text-xs">
        <li className="flex justify-between gap-3 border-t border-[#eee] pt-2">
          <span>Refund rate</span>
          <span className="text-[#3a3a3a]">+0.3 pt · stop</span>
        </li>
        <li className="flex justify-between gap-3 border-t border-[#eee] pt-2">
          <span>Ranker p95</span>
          <span className="text-[#3a3a3a]">80 ms · block ship</span>
        </li>
        <li className="flex justify-between gap-3 border-t border-[#eee] pt-2">
          <span>Primary</span>
          <span className="text-[#3a3a3a]">Purchases / 1k · 8% lift</span>
        </li>
      </ul>
    </div>
  );
}

function LedgerCard() {
  const rows = [
    ["Recency vs prior", "Purchases / 1k", "Stopped"],
    ["Checkout copy", "Conversion", "Running"],
    ["Empty state", "Activation", "Guardrail"],
  ];
  return (
    <div className="rounded-xl bg-white p-4 text-[#111] shadow-[0_10px_30px_rgba(0,0,0,0.12)]">
      <p className="text-xs font-medium text-[#6b6b6b]">Experiments</p>
      <table className="mt-3 w-full text-left text-xs">
        <thead className="text-[#8a8a8a]">
          <tr>
            <th className="pb-2 font-medium">Test</th>
            <th className="font-medium">Statistic</th>
            <th className="font-medium">State</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[0]} className="border-t border-[#eee]">
              {row.map((cell) => (
                <td key={cell} className="py-2 pr-2">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ShipCard() {
  return (
    <div className="rounded-xl bg-white p-4 text-[#111] shadow-[0_10px_30px_rgba(0,0,0,0.12)]">
      <div className="flex gap-2">
        <span className="rounded-md bg-[#111] px-2 py-1 text-[11px] font-medium text-white">Cursor</span>
        <span className="rounded-md border border-[#e6e6e6] px-2 py-1 text-[11px] font-medium">Claude Code</span>
      </div>
      <p className="mt-3 text-sm font-medium">x/ranker #418 · merged</p>
      <p className="mt-1 text-xs leading-relaxed text-[#4a4a4a]">New statistic: purchases / 1k, five looks, 5% false-positive rate. Look 4 cleared. The prior arm ships.</p>
    </div>
  );
}
