import "server-only";

import { armFor } from "@/lib/autopilot/assign";
import { addEvents, listExperiments, listFlags, type NewEvent } from "@/lib/autopilot/store";
import type { Arm } from "@/lib/autopilot/assign";

// Synthetic visitors so the measure → decide → iterate half of the loop can run before real traffic
// exists. Every event is stored with synthetic = true and readouts report the synthetic share.

const VISITORS_PER_EXPERIMENT = 80;
const BACKGROUND_VISITORS = 40;

// Each page with how often a visitor clicks each element. "Request a connector" and "Export CSV" are
// deliberately ignored, so the analytics findings have something real to notice in the fake data.
const PAGES: { page: string; clicks: [string, number][] }[] = [
  { page: "/ai", clicks: [["Send", 0.7], ["New chat", 0.2]] },
  { page: "/features", clicks: [["Board", 0.25], ["Export CSV", 0.006]] },
  { page: "/connectors", clicks: [["Connect", 0.35], ["Request a connector", 0.01]] },
  { page: "/experiments", clicks: [["New experiment", 0.12]] },
  { page: "/dashboard", clicks: [["Features", 0.3]] },
];

function seeded(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10_000) / 10_000;
}

const visitorId = () => `sim-${crypto.randomUUID().slice(0, 18)}`;

export async function simulateTraffic(): Promise<string | null> {
  const running = (await listExperiments()).filter((e) => e.status === "running" && e.metricSpec);
  const events: NewEvent[] = [];

  for (let i = 0; i < BACKGROUND_VISITORS; i++) {
    const visitor = visitorId();
    const page = PAGES[Math.floor(Math.random() * PAGES.length)];
    events.push({ visitor, name: "view", page: page.page, element: "", arms: {}, synthetic: true });
    for (const [label, rate] of page.clicks) {
      if (Math.random() < rate) events.push({ visitor, name: "click", page: page.page, element: label, arms: {}, synthetic: true });
    }
  }

  // Each simulated visitor is assigned to every running experiment exactly as a real browser would
  // be (same hashing, same layers), so overlapping and mutually exclusive experiments behave as in
  // production.
  const flags = (await listFlags()).filter((f) => f.status === "running");
  for (const experiment of running) {
    const spec = experiment.metricSpec!;
    const flag = flags.find((f) => f.key === experiment.flag);
    if (!flag) continue;
    // A hidden "true" effect per experiment: some ideas help, some hurt, some do nothing.
    const baseline = 0.08 + seeded(experiment.flag + "base") * 0.12;
    const trueLift = -0.3 + seeded(experiment.flag + "lift") * 0.9;
    let reached = 0;
    for (let tries = 0; reached < VISITORS_PER_EXPERIMENT && tries < VISITORS_PER_EXPERIMENT * 10; tries++) {
      const visitor = visitorId();
      const arm = armFor(visitor, flag);
      if (!arm) continue;
      reached++;
      const arms: Record<string, Arm> = {};
      for (const other of flags) {
        const otherArm = armFor(visitor, other);
        if (otherArm) arms[other.key] = otherArm;
      }
      const page = experiment.page || (spec.kind === "visit" ? "/dashboard" : "/features");
      events.push({ visitor, name: "view", page, element: "", arms, synthetic: true });
      const rate = arm === "treatment" ? baseline * (1 + trueLift) : baseline;
      if (Math.random() < rate) {
        events.push(
          spec.kind === "click"
            ? { visitor, name: "click", page, element: spec.text, arms, synthetic: true }
            : { visitor, name: "view", page: spec.path, element: "", arms, synthetic: true }
        );
      }
    }
  }

  await addEvents(events);
  return running.length ? `Simulated traffic for ${running.length} running experiment(s).` : null;
}
