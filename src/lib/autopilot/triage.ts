import "server-only";

import { askForJson, readJson } from "@/lib/ai/respond";
import { listSignals, log, setSignalTriage } from "@/lib/autopilot/store";
import { parseTriageResults } from "@/lib/autopilot/triage-core";

export async function triageSignals(): Promise<string | null> {
  const signals = (await listSignals()).filter((signal) => signal.status === "open" && signal.kind === null).slice(0, 10);
  if (!signals.length) return null;
  const system = [
    "Classify each product problem as bug or idea.",
    "bug means something is broken or behaves wrongly: errors, actions that do nothing, wrong data, crashes, or broken flows.",
    "idea means it works as built but could be better: discoverability, copy, layout, or a new capability.",
    "Return JSON {results:[{id,kind,reason}]}. Classify every id once and give a one-sentence reason.",
  ].join(" ");
  const input = signals.map((signal) => ({
    id: signal.id,
    title: signal.title,
    problem: signal.problem,
    evidence: signal.evidence.slice(0, 5).map((item) => item.title),
  }));
  const parsed = readJson<unknown>(await askForJson(system, JSON.stringify(input), false, undefined, "experiment"));
  const results = parseTriageResults(parsed, new Set(signals.map((signal) => signal.id)));
  for (const result of results) await setSignalTriage(result.id, result.kind, result.reason);
  if (!results.length) return null;
  await log("triage", `Classified ${results.length} problem${results.length === 1 ? "" : "s"} as bugs or ideas.`);
  return `Triaged ${results.length} problem${results.length === 1 ? "" : "s"}.`;
}
