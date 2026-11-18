"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  Area,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, Boxes, FlaskConical, GitPullRequest, MessageSquare, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { obrienFlemingBoundaries } from "@/lib/experiments/stats";
import { cn } from "@/lib/utils";

const BOUNDARIES = obrienFlemingBoundaries(5, 0.05);
const LOOK_DAYS = [3, 6, 8, 11, 14];

const SCENES = [
  {
    id: "context",
    ms: 16000,
    line: "Experiments reads the warehouse, the tickets, and what people are saying about Sponsored results.",
  },
  {
    id: "analytics",
    ms: 4400,
    line: "Purchases fell the week the ranking prompt raised recency_weight to 0.45.",
  },
  {
    id: "propose",
    ms: 5200,
    line: "Kismet proposes a change to the ranking prompt. A person approves it.",
  },
  {
    id: "plan",
    ms: 5400,
    line: "It writes the metric, the guardrails, and the five looks before anything ships.",
  },
  {
    id: "ship",
    ms: 5000,
    line: "Cursor or Claude Code opens the change on x/ranker. Kismet keeps the statistic, and shipping puts the new prompt on 20% of auctions.",
  },
  {
    id: "run",
    ms: 11000,
    line: "The test stays open while it is merely ahead, then stops itself when look 4 clears the boundary.",
  },
] as const;

function sceneIndex(id: (typeof SCENES)[number]["id"]) {
  return SCENES.findIndex((scene) => scene.id === id);
}

const CONNECTORS = {
  databricks: { name: "Databricks", logo: "/connectors/databricks.svg" },
  slack: { name: "Slack", logo: "/connectors/slack.png" },
  jira: { name: "Jira", logo: "/connectors/jira.svg" },
  zendesk: { name: "Zendesk", logo: "/connectors/zendesk.svg" },
  github: { name: "GitHub", logo: "/connectors/github.svg" },
  reddit: { name: "Reddit", logo: "/connectors/reddit.png" },
  quora: { name: "Quora", logo: "/connectors/quora.svg" },
  devto: { name: "DEV", logo: "/connectors/devto.svg" },
  hackernews: { name: "Hacker News", logo: "/connectors/hackernews.svg" },
  linkedin: { name: "LinkedIn", logo: "/connectors/linkedin.svg" },
  google: { name: "Google", logo: "/connectors/google.svg" },
} as const;

type ConnectorId = keyof typeof CONNECTORS;

const SOURCE_ORDER: ConnectorId[] = [
  "databricks",
  "slack",
  "jira",
  "zendesk",
  "reddit",
  "quora",
  "devto",
  "hackernews",
  "linkedin",
  "google",
  "github",
];

const READING = [
  "Purchases per 1,000 impressions on Sponsored results fell from 18.4 to 14.1 in ads.auction_outcomes.",
  "The drop starts the week recency_weight on that feature went from 0.30 to 0.45.",
  "#auction: new advertisers are taking every top slot. RANK-184 says the recency boost overfits cold-start ads.",
  "46 support tickets say the first results are not what people searched.",
  "r/xmarketplace: the first Sponsored results no longer match the search. A Quora thread says new ads take every top slot.",
  "A DEV post and a Hacker News thread both point at the recency boost on cold-start ads.",
  "LinkedIn posts from advertisers say a listing only wins the top slot when it is brand new. Google turns up the same complaint.",
  "The last test in the warehouse raised click-through and left purchases flat. The prompt in x/ranker is what should change.",
].join(" ");

const READING_WORDS = READING.split(" ");

const WEEKS = [
  { week: "W1", purchases: 16.8, clicks: 4.1 },
  { week: "W2", purchases: 17.4, clicks: 4.2 },
  { week: "W3", purchases: 18.4, clicks: 4.3 },
  { week: "W4", purchases: 18.1, clicks: 4.4 },
  { week: "W5", purchases: 15.6, clicks: 4.8 },
  { week: "W6", purchases: 14.9, clicks: 5.1 },
  { week: "W7", purchases: 14.1, clicks: 5.4 },
];

const RUN = [
  { day: 0, prior: 0, recency: 0, band: [-1.4, 1.4] as [number, number] },
  { day: 3, prior: 1.1, recency: 0.6, band: [-1.1, 3.3] as [number, number] },
  { day: 6, prior: 2.7, recency: 0.4, band: [-0.2, 5.6] as [number, number] },
  { day: 8, prior: 3.9, recency: -0.2, band: [0.8, 7.0] as [number, number] },
  { day: 11, prior: 6.2, recency: 0.5, band: [2.8, 9.6] as [number, number] },
];

const CODE_BEFORE = `def score(bid, p_click, age_days):
    recency = 0.45 if age_days < 14 else 1
    return bid * p_click * recency`;

const CODE_AFTER = `def score(bid, p_purchase, purchases_14d, age_days):
    recency = 0.22 if age_days < 14 else 1
    prior = (purchases_14d + 1.2) / (purchases_14d + 8)
    return bid * p_purchase * recency * prior`;

const NAV = [
  { icon: MessageSquare, label: "Chat", jumpTo: null, scenes: [] as string[] },
  { icon: Boxes, label: "Context", jumpTo: "context" as const, scenes: ["context", "propose"] },
  { icon: BarChart3, label: "Analytics", jumpTo: "analytics" as const, scenes: ["analytics"] },
  { icon: FlaskConical, label: "Experiments", jumpTo: "plan" as const, scenes: ["plan", "run"] },
  { icon: GitPullRequest, label: "Ship", jumpTo: "ship" as const, scenes: ["ship"] },
];

export function ExperimentDemo({ surface = "card" }: { surface?: "card" | "window" }) {
  const [scene, setScene] = useState(0);
  const [progress, setProgress] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const current = SCENES[scene]!;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduceMotion(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const id = scene;
    const started = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const next = (now - started) / SCENES[id]!.ms;
      if (next >= 1) {
        const nextId = (id + 1) % SCENES.length;
        setScene(nextId);
        setProgress(0);
        return;
      }
      setProgress(next);
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [reduceMotion, scene]);

  function jump(index: number) {
    setScene(index);
    setProgress(reduceMotion ? 1 : 0);
  }

  const shown = reduceMotion ? 1 : progress;

  const framed = surface === "window";

  return (
    <section aria-label="X ranking experiment">
      <p className="sr-only" aria-live="polite">
        {current.line}
      </p>
      <div className="relative">
        {!framed && (
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-x-6 -inset-y-8 -z-10 bg-[radial-gradient(ellipse_at_center,rgba(5,113,211,0.14),transparent_68%)]"
          />
        )}
        <div
          className={
            framed
              ? "overflow-hidden border-t border-border bg-background"
              : "overflow-hidden rounded-xl border border-border bg-background shadow-[0_24px_80px_rgba(17,17,17,0.08)]"
          }
        >
          <div className="h-0.5 bg-muted">
            <div className="h-full bg-primary transition-[width] duration-100" style={{ width: `${shown * 100}%` }} />
          </div>
          <div className="flex gap-1 overflow-x-auto border-b border-border px-2 py-2 sm:hidden">
            {NAV.filter((item) => item.jumpTo).map((item) => (
              <RailItem
                key={item.label}
                icon={item.icon}
                label={item.label}
                active={item.scenes.includes(current.id)}
                onSelect={() => jump(sceneIndex(item.jumpTo!))}
              />
            ))}
          </div>
          <div className="flex h-[540px] tracking-normal sm:h-[520px]">
            <aside className="hidden w-40 shrink-0 flex-col border-r border-sidebar-border bg-sidebar py-3 sm:flex">
              <div className="mx-2 mb-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-sidebar-foreground">
                <Plus className="h-4 w-4" />
                New
              </div>
              <p className="px-4 pb-1 pt-2 text-[11px] text-muted-foreground">Workspace</p>
              {NAV.slice(0, 2).map((item) => (
                <RailItem
                  key={item.label}
                  icon={item.icon}
                  label={item.label}
                  active={item.scenes.includes(current.id)}
                  onSelect={item.jumpTo ? () => jump(sceneIndex(item.jumpTo)) : undefined}
                />
              ))}
              <p className="px-4 pb-1 pt-3 text-[11px] text-muted-foreground">Measure</p>
              {NAV.slice(2).map((item) => (
                <RailItem
                  key={item.label}
                  icon={item.icon}
                  label={item.label}
                  active={item.scenes.includes(current.id)}
                  onSelect={item.jumpTo ? () => jump(sceneIndex(item.jumpTo)) : undefined}
                />
              ))}
            </aside>
            <div
              className="min-w-0 flex-1 overflow-hidden"
              style={{ opacity: reduceMotion ? 1 : Math.min(1, 0.15 + shown / 0.12) }}
            >
              {current.id === "context" && <ContextScene progress={shown} />}
              {current.id === "analytics" && <AnalyticsScene progress={shown} />}
              {current.id === "propose" && <ProposeScene progress={shown} onApprove={() => jump(sceneIndex("plan"))} />}
              {current.id === "plan" && <PlanScene />}
              {current.id === "ship" && <ShipScene progress={shown} onShip={() => jump(sceneIndex("run"))} />}
              {current.id === "run" && <RunScene progress={shown} />}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function RailItem({
  icon: Icon,
  label,
  active,
  onSelect,
}: {
  icon: typeof Boxes;
  label: string;
  active: boolean;
  onSelect?: () => void;
}) {
  const className = cn(
    "mx-2 flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#0571d3]/40",
    active ? "bg-accent font-medium text-accent-foreground" : "text-sidebar-foreground hover:bg-accent/60",
    !onSelect && "hover:bg-transparent",
  );
  const body = (
    <>
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </>
  );
  if (!onSelect) return <div className={className}>{body}</div>;
  return (
    <button type="button" onClick={onSelect} aria-current={active ? "page" : undefined} className={className}>
      {body}
    </button>
  );
}

function ContextScene({ progress }: { progress: number }) {
  const shownWords = Math.max(1, Math.floor(progress * READING_WORDS.length));
  const sourceCount = Math.min(SOURCE_ORDER.length, Math.max(1, Math.ceil(progress * SOURCE_ORDER.length)));
  const typing = progress < 0.98;
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold">Company context</div>
          <div className="text-[11px] text-muted-foreground">{typing ? "Reading sources" : "Sources read"}</div>
        </div>
        <div className="ml-auto">
          <LogoStack ids={SOURCE_ORDER} visible={sourceCount} />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
        <p className="max-w-2xl text-sm leading-relaxed">
          {READING_WORDS.slice(0, shownWords).join(" ")}
          {typing && <span className="ml-0.5 inline-block h-4 w-px animate-pulse bg-foreground align-middle" />}
        </p>
      </div>
    </div>
  );
}

function LogoStack({ ids, visible }: { ids: ConnectorId[]; visible?: number }) {
  const shown = ids.slice(0, visible ?? ids.length);
  return (
    <div className="flex items-center" aria-label={shown.map((id) => CONNECTORS[id].name).join(", ")}>
      {shown.map((id, index) => (
        <span
          key={id}
          title={CONNECTORS[id].name}
          className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-white shadow-sm"
          style={{ marginLeft: index === 0 ? 0 : -10, zIndex: shown.length - index }}
        >
          <Image src={CONNECTORS[id].logo} alt="" width={18} height={18} className="h-[18px] w-[18px] object-contain" unoptimized />
        </span>
      ))}
    </div>
  );
}

function AnalyticsScene({ progress }: { progress: number }) {
  const count = Math.max(2, Math.ceil(progress * WEEKS.length));
  const latest = WEEKS[count - 1]?.purchases ?? WEEKS[0]!.purchases;
  return (
    <div className="flex h-full flex-col p-4">
      <div className="text-sm font-semibold">Purchases per 1,000 impressions</div>
      <p className="mt-1 text-xs text-muted-foreground">ads.auction_outcomes · click-through rose 6% over the same weeks</p>
      <div className="mt-2 min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={WEEKS.slice(0, count)} margin={{ top: 16, right: 8, bottom: 0, left: 0 }}>
            <XAxis dataKey="week" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="purchases" domain={[12, 20]} width={32} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="clicks" orientation="right" domain={[3, 7]} width={28} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            {count > 4 && (
              <ReferenceLine
                x="W4"
                stroke="#e07a2f"
                strokeDasharray="3 3"
                label={{ value: "recency 0.45", position: "insideTopRight", fontSize: 11, fill: "#e07a2f" }}
              />
            )}
            <Line yAxisId="purchases" dataKey="purchases" name="Purchases" stroke="var(--primary)" strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} type="monotone" />
            <Line yAxisId="clicks" dataKey="clicks" name="Click-through" stroke="#e07a2f" strokeWidth={2} dot={false} isAnimationActive={false} type="monotone" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Before the weight change" value={count > 3 ? "18.4" : latest.toFixed(1)} />
        <Stat label="Purchases this week" value={latest.toFixed(1)} />
        <Stat label="Click-through" value={count > 4 ? "5.4" : "4.3"} hint="Up. Purchases are not." />
      </div>
    </div>
  );
}

function ProposeScene({ progress, onApprove }: { progress: number; onApprove: () => void }) {
  const approved = progress > 0.66;
  return (
    <div className="flex h-full flex-col overflow-auto px-5 py-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Experiment · waiting on you</p>
      <div className="mt-2 max-w-xl text-lg font-semibold tracking-tight">Change the ranking prompt. Leave the page alone.</div>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
        Cut recency from 0.45 to 0.22 on one arm, and add a 14-day purchase prior on the other. The page stays as it is. The last recency test bought clicks, not purchases.
      </p>
      <div className="mt-4 max-w-xl">
        <PromptDiff />
      </div>
      <div className="relative mt-auto flex items-center gap-3 pt-4">
        <Button type="button" onClick={onApprove} className={cn(approved && "scale-[0.98]")}>
          {approved ? "Approved" : "Approve"}
        </Button>
        <span className="text-xs text-muted-foreground">Outside the guardrails, Kismet asks.</span>
        {progress > 0.12 && progress < 0.92 && <Pointer arrived={progress > 0.48} pressing={approved} />}
      </div>
    </div>
  );
}

function PlanScene() {
  return (
    <div className="h-full overflow-auto p-4">
      <div className="text-sm font-semibold">The plan</div>
      <div className="mt-3 rounded-md border-l-2 border-primary bg-primary/5 p-3 text-sm">
        <b>Purchases, not clicks</b>
        <p className="mt-1">
          <b>Optimizing for:</b> purchases per 1,000 impressions.
        </p>
        <p className="mt-1 text-muted-foreground">
          <b className="text-foreground">Not optimizing for:</b> click-through. The last prompt already won that and lost the sale.
        </p>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <div className="text-xs font-semibold">Primary result</div>
          <p className="mt-1 text-sm">Purchases / 1k · smallest lift 8%</p>
          <table className="mt-2 w-full text-left text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="pb-1 font-medium">Look</th>
                <th className="font-medium">Day</th>
                <th className="font-medium">z needed</th>
              </tr>
            </thead>
            <tbody>
              {BOUNDARIES.map((boundary, index) => (
                <tr key={LOOK_DAYS[index]} className="border-t border-border">
                  <td className="py-1">{index + 1}</td>
                  <td>{LOOK_DAYS[index]}</td>
                  <td>{boundary.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <div className="text-xs font-semibold">The numbers</div>
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
            <dt className="text-muted-foreground">Arms</dt>
            <dd>Control, recency, prior</dd>
            <dt className="text-muted-foreground">Split of the 20%</dt>
            <dd>40 / 30 / 30</dd>
            <dt className="text-muted-foreground">Sample per arm</dt>
            <dd>120,000</dd>
            <dt className="text-muted-foreground">Duration</dt>
            <dd>14 days, 5 looks</dd>
          </dl>
          <p className="mt-3 rounded-md bg-muted p-3 text-xs leading-relaxed text-muted-foreground">
            O’Brien–Fleming, five looks, 5% false-positive rate. A peek that is merely ahead does not ship.
          </p>
        </div>
      </div>
      <div className="mt-4 text-xs font-semibold">Guardrails</div>
      <table className="mt-2 w-full text-left text-xs">
        <thead className="text-muted-foreground">
          <tr>
            <th className="pb-1 font-medium">Metric</th>
            <th className="font-medium">Allowed change</th>
            <th className="font-medium">Action</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-border">
            <td className="py-1.5">Click-through</td>
            <td>−1.5%</td>
            <td>Stop now</td>
          </tr>
          <tr className="border-t border-border">
            <td className="py-1.5">Refund rate</td>
            <td>+0.3 pt</td>
            <td>Stop now</td>
          </tr>
          <tr className="border-t border-border">
            <td className="py-1.5">Ranker p95</td>
            <td>80 ms</td>
            <td>Block ship</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function ShipScene({ progress, onShip }: { progress: number; onShip: () => void }) {
  const shipped = progress > 0.62;
  return (
    <div className="flex h-full flex-col p-4">
      <div className="text-sm font-semibold">Ship the prompt</div>
      <p className="mt-1 text-xs text-muted-foreground">
        {shipped ? "Merged from Cursor. The listing page did not change. Kismet still owns the statistic." : "Claude Code or Cursor writes the diff. Kismet already defined the metric, the looks, and the guardrails."}
      </p>
      <div className="mt-4 max-w-xl overflow-auto rounded-xl border border-border">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <GitPullRequest className={cn("h-4 w-4", shipped ? "text-emerald-700" : "text-primary")} />
          <span className="text-sm font-semibold">x/ranker #418</span>
          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", shipped ? "bg-emerald-100 text-emerald-800" : "bg-accent text-primary")}>
            {shipped ? "Merged" : "Open"}
          </span>
        </div>
        <div className="px-3 py-3">
          <p className="text-sm">Three-arm ranker: purchase prior versus recency alone</p>
          <p className="mt-1 text-xs text-muted-foreground">exp/recency-prior → main · flag auction_prior, 40/30/30 inside 20%</p>
          <PromptDiff />
        </div>
      </div>
      <div className="relative mt-3 flex shrink-0 items-center gap-3">
        <Button type="button" onClick={onShip}>
          {shipped ? "Shipped" : "Approve and ship"}
        </Button>
        <span className="text-xs text-muted-foreground">
          {shipped ? "The new prompt is scoring 20% of auctions." : "One approval. Then the score changes."}
        </span>
        {progress > 0.15 && progress < 0.94 && <Pointer arrived={progress > 0.42} pressing={shipped} />}
      </div>
    </div>
  );
}

function RunScene({ progress }: { progress: number }) {
  const revealed = Math.max(1, Math.ceil(Math.min(progress / 0.42, 1) * RUN.length));
  const data = RUN.slice(0, revealed);
  const stopped = progress > 0.48;
  const look3 = progress > 0.32;
  return (
    <div className="flex h-full flex-col p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Purchase lift, two arms against control</div>
          <p className="mt-1 text-xs text-muted-foreground">Prior arm and recency-only arm · looks on day 3, 6, 8, 11, and 14</p>
        </div>
        {stopped && <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">Stopped · significant</span>}
      </div>
      <div className="mt-2 min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 18, right: 12, bottom: 4, left: 0 }}>
            <XAxis dataKey="day" type="number" domain={[0, 14]} ticks={[0, 3, 6, 8, 11, 14]} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis domain={[-4, 12]} width={36} unit="%" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <ReferenceLine y={0} stroke="var(--border)" />
            {LOOK_DAYS.map((day, index) => (
              <ReferenceLine
                key={day}
                x={day}
                stroke="var(--border)"
                label={{ value: `L${index + 1}`, position: "insideTop", fontSize: 10, fill: "var(--muted-foreground)" }}
              />
            ))}
            {stopped && (
              <ReferenceArea
                x1={11}
                x2={14}
                fill="var(--muted)"
                fillOpacity={0.9}
                label={{ value: "3 days saved", position: "insideTop", fontSize: 11, fill: "var(--muted-foreground)" }}
              />
            )}
            <Area dataKey="band" stroke="none" fill="var(--primary)" fillOpacity={0.16} isAnimationActive={false} />
            <Line dataKey="prior" type="monotone" stroke="var(--primary)" strokeWidth={2.5} dot={false} isAnimationActive={false} />
            <Line dataKey="recency" type="monotone" stroke="#e07a2f" strokeWidth={2} dot={false} isAnimationActive={false} />
            {stopped && (
              <ReferenceDot
                x={11}
                y={6.2}
                r={5}
                fill="var(--primary)"
                stroke="var(--background)"
                strokeWidth={2}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="text-sm leading-relaxed">
        {stopped ? (
          <>
            Look 4 stops the prior arm. z 2.41 clears {BOUNDARIES[3]!.toFixed(2)}. The recency-only arm is still inside the noise. Click-through, refunds, and ranker p95 stayed inside the guardrails. The prior is the prompt that ships.
          </>
        ) : look3 ? (
          <>Look 3 · prior z 2.18, boundary {BOUNDARIES[2]!.toFixed(2)}. Ahead, and not enough to stop. Recency-only is flat.</>
        ) : (
          <>Watching purchases. Click-through and refunds are inside their guardrails.</>
        )}
      </p>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border border-border px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function PromptDiff() {
  return (
    <div className="mt-2 max-w-full overflow-x-auto rounded-md border bg-card font-mono text-[12px] leading-5">
      {CODE_BEFORE.split("\n").map((line) => (
        <div key={`before-${line}`} className="bg-destructive/10 px-3 py-0.5 text-destructive">
          <span className="mr-3 inline-block w-3 select-none text-center">−</span>
          {line}
        </div>
      ))}
      {CODE_AFTER.split("\n").map((line) => (
        <div key={`after-${line}`} className="bg-success/10 px-3 py-0.5 text-success">
          <span className="mr-3 inline-block w-3 select-none text-center">+</span>
          {line}
        </div>
      ))}
    </div>
  );
}

function Pointer({ arrived, pressing }: { arrived: boolean; pressing: boolean }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute left-0 top-0 z-10 transition-transform duration-700 ease-out"
      style={{ transform: pressing ? "translate(92px, 16px)" : arrived ? "translate(84px, 12px)" : "translate(168px, 48px)" }}
    >
      <svg width="18" height="18" viewBox="0 0 18 18" className="drop-shadow-sm">
        <path d="M3 2 L3 14 L7 11 L9.5 16 L12 15 L9.4 10 L14 10 Z" fill="#111" />
      </svg>
    </span>
  );
}
