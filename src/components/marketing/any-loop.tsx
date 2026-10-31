"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";

interface Step {
  label: string;
  edge: string;
  body: string;
  hot: number[];
}

interface Scene {
  id: string;
  label: string;
  steps: Step[];
}

const SCENES: Scene[] = [
  {
    id: "run",
    label: "The run",
    steps: [
      {
        label: "Read",
        edge: "evidence",
        body: "Analytics, tickets, sessions, and past experiments are already the map. any% does not start from a blank list of ideas.",
        hot: [0, 1, 4, 5],
      },
      {
        label: "Choose",
        edge: "hypothesis",
        body: "It picks a change the evidence can support, and it skips a test you already ran or one that collides with something live.",
        hot: [5, 6, 9, 10],
      },
      {
        label: "Ship",
        edge: "variant",
        body: "The variant matches the design system. It goes out behind a flag, with the metric and the guardrails attached.",
        hot: [9, 10, 13, 14],
      },
      {
        label: "Call",
        edge: "readout",
        body: "When the sample can support a call, any% writes the readout on the feature and the next test starts from that result.",
        hot: [10, 11, 14, 15],
      },
    ],
  },
  {
    id: "call",
    label: "A valid call",
    steps: [
      {
        label: "Metric",
        edge: "primary",
        body: "The primary metric is named before the result, with guardrails beside it. A win on a metric you chose afterward does not count.",
        hot: [2, 3, 6, 7],
      },
      {
        label: "Peeking",
        edge: "boundary",
        body: "Looking early and stopping because it looks good is a failed call. any% will not ship that.",
        hot: [4, 5, 8, 9],
      },
      {
        label: "Split",
        edge: "ratio",
        body: "If the sample ratio is broken, the result is not a winner. The check runs while the test is live, not after someone asks.",
        hot: [8, 9, 12, 13],
      },
      {
        label: "Decision",
        edge: "ship / hold / kill",
        body: "Ship, hold, or kill. An effect that cannot be trusted does not ship, including when several ideas were tested at once.",
        hot: [12, 13, 14, 15],
      },
    ],
  },
  {
    id: "next",
    label: "The next one",
    steps: [
      {
        label: "File",
        edge: "readout",
        body: "The readout stays on the feature, with the hypothesis and the evidence. The next person does not have to reconstruct it.",
        hot: [0, 4, 8, 12],
      },
      {
        label: "Update",
        edge: "prior",
        body: "The next sample plan can start from what this test, and the ones before it, already learned. Low traffic is a reason to do this, not a reason to skip the test.",
        hot: [1, 5, 9, 13],
      },
      {
        label: "Drop",
        edge: "library",
        body: "Ideas that lost, or that you cannot tell apart from one that lost, come off the path. The point is fewer repeated tests.",
        hot: [2, 6, 10, 14],
      },
      {
        label: "Start closer",
        edge: "next test",
        body: "The following run is shorter because the last result is already in the map. That is the speedrun: finish, then start further along.",
        hot: [3, 7, 11, 15],
      },
    ],
  },
];

export function AnyLoop() {
  const [sceneId, setSceneId] = useState(SCENES[0].id);
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const scene = SCENES.find((item) => item.id === sceneId) ?? SCENES[0];
  const current = scene.steps[step] ?? scene.steps[0];

  useEffect(() => {
    if (paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      setStep((value) => (value + 1) % scene.steps.length);
    }, 3600);
    return () => window.clearInterval(timer);
  }, [paused, scene.steps.length, sceneId]);

  function go(next: number) {
    const count = scene.steps.length;
    setStep((next + count) % count);
  }

  return (
    <section className="px-6 py-20 md:px-8" aria-labelledby="any-how">
      <h2 id="any-how" className="text-center text-4xl tracking-[-0.04em] text-[#111] md:text-5xl">
        How any% works
      </h2>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-1" role="tablist" aria-label="How any% works">
        {SCENES.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={item.id === sceneId}
            onClick={() => {
              setSceneId(item.id);
              setStep(0);
            }}
            className={`rounded-full px-3.5 py-1.5 text-sm ${item.id === sceneId ? "bg-[#f2f2f2] text-[#111]" : "text-[#5c6570] hover:text-[#111]"}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="relative mx-auto mt-14 max-w-5xl">
        <button
          type="button"
          aria-label="Previous step"
          onClick={() => go(step - 1)}
          className="absolute left-0 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-[#eceef1] bg-white text-[#111] hover:bg-[#f6f7f8] md:inline-flex"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Next step"
          onClick={() => go(step + 1)}
          className="absolute right-0 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-[#eceef1] bg-white text-[#111] hover:bg-[#f6f7f8] md:inline-flex"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        <div className="mx-auto grid max-w-3xl grid-cols-[auto_1fr] items-center gap-x-6 px-1 sm:gap-x-10 sm:px-14">
          <div className="self-center">
            <p className="mb-3 text-[12px] text-[#5c6570]">
              <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[#111]" />
              Evidence
            </p>
            <div className="grid grid-cols-4 gap-1.5" aria-hidden>
              {Array.from({ length: 16 }, (_, index) => (
                <span key={index} className={`h-5 w-5 rounded-[3px] sm:h-6 sm:w-6 ${current.hot.includes(index) ? "bg-[#111]" : "bg-[#eceef1]"}`} />
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-right text-[12px] text-[#5c6570]">
              <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[#c4a15a]" />
              Result
            </p>
            <ol className="grid list-none grid-cols-[1fr_12px_1fr_6.5rem] gap-x-3">
              {scene.steps.map((item, index) => (
                <li key={item.label} className="col-span-4 grid grid-cols-subgrid items-center">
                  <span className={`py-2.5 text-right text-[13px] ${index === step ? "text-[#111]" : "text-[#9aa1ab]"}`}>{item.label}</span>
                  <span className="relative flex items-center justify-center py-2.5">
                    <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-[#0571d3]" />
                    <span
                      className={`relative z-10 h-3 w-3 rounded-full border-2 ${index === step ? "border-[#0571d3] bg-white ring-4 ring-[#0571d3]/15" : "border-[#0571d3] bg-[#0571d3]"}`}
                    />
                  </span>
                  <span className={`py-2.5 text-[13px] ${index === step ? "text-[#111]" : "text-[#9aa1ab]"}`}>{item.edge}</span>
                  <span className="flex h-6 gap-1 py-0" aria-hidden>
                    {Array.from({ length: 4 }, (_, bar) => (
                      <span key={bar} className={`h-full flex-1 rounded-[3px] ${index === step ? "bg-[#c4a15a]" : "bg-[#eceef1]"}`} />
                    ))}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <p className="mx-auto mt-10 max-w-lg text-center text-[15px] leading-relaxed text-[#3c4250]">{current.body}</p>
      </div>

      <div className="mx-auto mt-8 flex w-fit items-center gap-4 rounded-full border border-[#eceef1] bg-white px-4 py-2">
        <div className="h-1 w-16 overflow-hidden rounded-full bg-[#eceef1]" aria-hidden>
          <div className="h-full bg-[#111]" style={{ width: `${((step + 1) / scene.steps.length) * 100}%` }} />
        </div>
        <div className="flex items-center gap-1.5" aria-hidden>
          {scene.steps.map((item, index) => (
            <span key={item.label} className={`h-1.5 w-1.5 rounded-full ${index === step ? "bg-[#111]" : "bg-[#d5d8de]"}`} />
          ))}
        </div>
        <button
          type="button"
          aria-label={paused ? "Play" : "Pause"}
          onClick={() => setPaused((value) => !value)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[#111] hover:bg-[#f6f7f8]"
        >
          {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
        </button>
      </div>
      <p className="sr-only">
        {scene.label}, step {step + 1} of {scene.steps.length}: {current.label}. {current.body}
      </p>
    </section>
  );
}
