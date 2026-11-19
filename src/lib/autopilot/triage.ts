import "server-only";

import { askForJson, readJson } from "@/lib/ai/respond";
import { listSignals, log, setSignalTriage } from "@/lib/autopilot/store";
import { parseTriageResults } from "@/lib/autopilot/triage-core";
import { triageInput, triageSystemPrompt } from "@/lib/autopilot/triage-prompt-core";

export async function triageSignals(): Promise<string | null> {
  const signals = (await listSignals()).filter((signal) => signal.status === "open" && signal.kind === null).slice(0, 10);
  if (!signals.length) return null;
  const parsed = readJson<unknown>(await askForJson(triageSystemPrompt(), triageInput(signals), false, undefined, "experiment"));
  const results = parseTriageResults(parsed, new Set(signals.map((signal) => signal.id)));
  for (const result of results) await setSignalTriage(result.id, result.kind, result.reason);
  if (!results.length) return null;
  await log("triage", `Classified ${results.length} problem${results.length === 1 ? "" : "s"} as bugs or ideas.`);
  return `Triaged ${results.length} problem${results.length === 1 ? "" : "s"}.`;
}
