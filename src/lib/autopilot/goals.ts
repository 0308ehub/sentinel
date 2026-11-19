import "server-only";

import { askForJson, readJson } from "@/lib/ai/respond";
import { parseMetricSpec } from "@/lib/autopilot/assign";
import { addGoal, interviewContext, listGoals, log, metricBaseline, popularUsage } from "@/lib/autopilot/store";
import { minPageVisitors } from "@/lib/autopilot/thresholds";

interface GoalAnswer { goals?: Array<{ name?: unknown; metric?: unknown }> }

export async function inferGoals(): Promise<string | null> {
  if ((await listGoals()).length) return null;
  const usage = await popularUsage();
  if (usage.visitors < minPageVisitors()) return null;
  const context = await interviewContext();
  const product = process.env.AUTOPILOT_PRODUCT_CONTEXT?.trim() || "A web product using Kismet to improve its customer experience.";
  const text = await askForJson(
    "Propose 1–3 measurable product goals: outcomes that mean this product delivered value. Prefer a tracked business event such as a purchase or sign-up when one is listed, then reaching a core page or clicking a completion control such as Connect, Save, or Create. Return JSON {goals:[{name,metric}]}; metric must be {kind:'event',name} with a name from TRACKED EVENTS, {kind:'click',text}, or {kind:'visit',path}.",
    [`PRODUCT\n${product}`, `SETUP CONTEXT\n${context.map((e) => `${e.title}: ${e.body}`).join("\n") || "None"}`,
      `TRACKED EVENTS\n${usage.events.map((p) => `${p.label}: ${p.visitors}`).join("\n") || "None"}`,
      `TOP PAGES\n${usage.pages.map((p) => `${p.label}: ${p.visitors}`).join("\n")}`,
      `TOP CLICKS\n${usage.clicks.map((p) => `${p.label}: ${p.visitors}`).join("\n")}`].join("\n\n"),
    false, undefined, "experiment"
  );
  const answer = readJson<GoalAnswer>(text);
  let saved = 0;
  for (const proposed of answer.goals?.slice(0, 3) ?? []) {
    const spec = parseMetricSpec(proposed.metric);
    const name = typeof proposed.name === "string" ? proposed.name.trim() : "";
    if (!spec || !name) continue;
    const baseline = await metricBaseline(spec);
    const rate = baseline.visitors ? baseline.conversions / baseline.visitors : 0;
    if (!baseline.conversions || rate >= 0.95) continue;
    if (await addGoal({ name, spec, source: "inferred" })) saved++;
  }
  if (!saved) return null;
  await log("goals", `Kismet inferred ${saved} product goal${saved === 1 ? "" : "s"}.`);
  return `Inferred ${saved} product goal${saved === 1 ? "" : "s"}.`;
}
