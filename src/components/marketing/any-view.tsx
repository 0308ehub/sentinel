import Link from "next/link";
import { Flag, Library, Scale, ScanSearch, ShieldCheck, Timer } from "lucide-react";
import { AnyLoop } from "@/components/marketing/any-loop";
import { AnyPlanner } from "@/components/marketing/any-planner";
import { MarketingFrame } from "@/components/marketing/marketing-frame";

const FEATURES = [
  {
    icon: ScanSearch,
    title: "Evidence first",
    body: "The next test comes from analytics, tickets, sessions, and the experiments you already ran.",
  },
  {
    icon: Flag,
    title: "A variant that belongs",
    body: "It matches the design system and the codebase, and it ships behind a flag with instrumentation.",
  },
  {
    icon: ShieldCheck,
    title: "A call that can fail",
    body: "Peeking, a broken sample ratio, and a metric chosen after the result do not become a win.",
  },
  {
    icon: Timer,
    title: "Built for less traffic",
    body: "Sequential tests, bandits, and priors from past runs, for teams that do not have consumer-scale samples.",
  },
  {
    icon: Scale,
    title: "The tradeoff is visible",
    body: "Speed, traffic cost, and how many people see the worse version are different goals. The sketch shows which design each one picks.",
  },
  {
    icon: Library,
    title: "The result stays",
    body: "The readout is filed on the feature. The next run starts there, and a lost idea does not get tested again by accident.",
  },
];

const BENCH = [
  "Write scenarios from real experiments: the metric, the traffic, the proposed change, and what else is already running. Hold a set back. The model does not see it in examples or in prompt tuning.",
  "For each scenario, record the call a careful analyst would make: the metric, the guardrails, the sample plan, and ship, hold, or kill. Two people score it. Keep the ones they agree on.",
  "Give every model the same scenario and the same tools. A calculator and the past results. Nothing that leaks the answer.",
  "Score the output on the statistics. Was the metric one that can move? Did it refuse an invalid call? Is the sample plan near the formula? Does the readout claim only what the data supports?",
  "Record dollars and time per scenario. A point on the chart is a model: cost per valid call on one axis, share of calls that passed on the other.",
  "Replace the held-out set when the product changes. Do not tune prompts against it.",
];

const FAQ = [
  {
    q: "What does any% mean?",
    a: "In a speedrun, any% means finishing the game as fast as the rules allow, without completing every optional task. any% is that for experiments. Cross the evidence you have, ship the shortest test that is still valid, read the result, and start the next one further along.",
  },
  {
    q: "How is this different from a typical experimentation tool?",
    a: "Flag and stats platforms start once someone already knows the test. The team still brings the idea, writes the variant, watches for peeking, and files the readout. any% starts at the evidence, produces the variant and the instrumentation, and it will not ship a call that fails the checks. It is also aimed at teams whose traffic cannot support a long fixed-horizon test.",
  },
  {
    q: "What has to be true before any% calls a winner?",
    a: "The primary metric was named first. The sample can support the effect you care about, or a sequential boundary you set in advance has been crossed. The split is intact. The result is not an artifact of testing many ideas and keeping the one that moved. If one of those fails, the call is hold or kill.",
  },
  {
    q: "How does a result change the next experiment?",
    a: "The readout stays on the feature. The next sample plan can use it as a prior. Ideas that lost, or that you cannot tell apart from one that lost, come off the list. That is how the path gets shorter instead of resetting every time.",
  },
  {
    q: "How will you tell which model is good at this?",
    a: "With a held-out set of product situations, scored on whether the statistics are right, not on whether the writeup sounds confident. Cost and time are recorded with the score. That bench is a separate project. The empty chart on this page is where those points go. Nothing is plotted until the set exists.",
  },
  {
    q: "Can I compare the cost of a fixed test, a sequential test, and a bandit?",
    a: "Yes. The sketch above takes your traffic, your baseline, the lift you want to detect, and a cost per thousand visits. Sequential tests can stop early, so they often use less traffic, with a higher monitoring cost in the sketch. A bandit puts fewer people on the worse version and is not the same thing as a pre-registered winner. A locked sample is the fixed test, for when you cannot stop early.",
  },
  {
    q: "Who approves a ship?",
    a: "Inside the guardrails a team has set, a small test can go out. Outside them, any% asks. An experiment that fails the validity checks does not ship either way.",
  },
];

export function AnyView() {
  return (
    <MarketingFrame>
      <main>
        <section className="px-6 pb-8 pt-24 text-center md:px-8 md:pt-32">
          <p className="text-sm text-[#5c6570]">Experimentation</p>
          <h1 className="mt-3 text-6xl tracking-[-0.045em] text-[#111] md:text-7xl">any%</h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-[#3c4250]">
            Get to the next result as fast as the evidence allows. Cross what you already know, ship the shortest valid test, and start the one after it from the readout.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link href="/sign-up" className="inline-flex h-10 items-center rounded-lg bg-[#111] px-4 text-sm font-medium text-white hover:bg-[#2a2a2a]">
              Get started
            </Link>
            <Link href="/contact" className="inline-flex h-10 items-center rounded-lg border border-[#d7d7d7] bg-white px-4 text-sm font-medium text-[#111] hover:bg-[#f6f6f6]">
              Talk to us
            </Link>
          </div>
        </section>

        <AnyLoop />

        <section className="border-t border-[#eceef1] px-6 py-20 md:px-8">
          <h2 className="text-center text-4xl tracking-[-0.04em] text-[#111] md:text-5xl">Built for the AI age</h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-[15px] leading-relaxed text-[#3c4250]">
            A model that writes a confident readout is not the same as a model that runs a valid experiment. any% is scored, eventually, on the call. The product around it is the evidence, the variant, the checks, and the record.
          </p>
          <ul className="mx-auto mt-12 grid max-w-5xl border-t border-[#eceef1] sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <li
                key={feature.title}
                className="border-t border-[#eceef1] px-6 py-8 sm:border-r sm:[&:nth-child(2n)]:border-r-0 lg:[&:nth-child(2n)]:border-r lg:[&:nth-child(3n)]:border-r-0"
              >
                <feature.icon className="h-5 w-5 text-[#111]" strokeWidth={1.5} />
                <h3 className="mt-4 text-base text-[#111]">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#3c4250]">{feature.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <AnyPlanner />

        <section className="border-t border-[#eceef1] px-6 py-20 md:px-8" aria-labelledby="any-bench">
          <h2 id="any-bench" className="text-center text-4xl tracking-[-0.04em] text-[#111] md:text-5xl">
            Which model should run the loop
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-[15px] leading-relaxed text-[#3c4250]">
            A separate bench. The chart compares models on cost per valid call, once a held-out set exists. No scores are plotted yet.
          </p>
          <div className="mx-auto mt-10 max-w-3xl">
            <svg viewBox="0 0 640 300" className="w-full" style={{ fontFamily: "inherit" }} role="img" aria-label="Empty chart. Horizontal axis, dollars per valid call. Vertical axis, share of calls that passed.">
              <line x1="64" y1="24" x2="64" y2="240" stroke="#eceef1" />
              <line x1="64" y1="240" x2="600" y2="240" stroke="#eceef1" />
              <text x="18" y="150" fill="#5c6570" fontSize="12" transform="rotate(-90 18 150)">
                Calls that passed
              </text>
              <text x="250" y="276" fill="#5c6570" fontSize="12">
                Dollars per valid call
              </text>
              <text x="320" y="130" textAnchor="middle" fill="#111" fontSize="15">
                Scores go here.
              </text>
            </svg>
            <ol className="mt-4 space-y-4 text-[15px] leading-relaxed text-[#3c4250]">
              {BENCH.map((step, index) => (
                <li key={step} className="grid grid-cols-[2rem_1fr] gap-2">
                  <span className="text-[#111]">{index + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="border-t border-[#eceef1] px-6 py-20 md:px-8" aria-labelledby="any-faq">
          <h2 id="any-faq" className="text-center text-4xl tracking-[-0.04em] text-[#111] md:text-5xl">
            FAQ
          </h2>
          <div className="mx-auto mt-10 max-w-2xl">
            {FAQ.map((item) => (
              <details key={item.q} className="border-b border-[#eceef1] py-4">
                <summary className="cursor-pointer text-[17px] text-[#111]">{item.q}</summary>
                <p className="mt-3 text-[15px] leading-relaxed text-[#3c4250]">{item.a}</p>
              </details>
            ))}
          </div>
          <p className="mt-10 text-center text-sm text-[#5c6570]">
            <Link href="/docs/experiment" className="underline underline-offset-4 hover:text-[#111]">
              The written notes on experimentation
            </Link>
          </p>
        </section>
      </main>
    </MarketingFrame>
  );
}
