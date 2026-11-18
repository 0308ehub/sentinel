import "server-only";

import { decideFixVerification } from "@/lib/autopilot/fix-verification";
import { listExperiments, listSignals, log, setSignalStatus, updateExperiment } from "@/lib/autopilot/store";

export async function verifyFixes(): Promise<string | null> {
  const [experiments, signals] = await Promise.all([listExperiments(), listSignals()]);
  const now = new Date().toISOString();
  const messages: string[] = [];
  for (const experiment of experiments.filter((item) => item.kind === "fix" && item.status === "rolled_out" && !item.verifiedAt && item.startedAt)) {
    const signal = signals.find((item) => item.id === experiment.signalId);
    if (!signal) continue;
    const complaints = signal.evidence.filter((item) => item.source !== "analytics" && Date.parse(item.occurredAt) > Date.parse(experiment.startedAt!));
    const decision = decideFixVerification({ startedAt: experiment.startedAt!, now, complaints });
    if (!decision) continue;
    const note = decision.verdict === "not_fixed"
      ? `Complaints continued after the fix: ${decision.complaints} new reports.`
      : "No new complaints in 14 days after the fix.";
    await updateExperiment(experiment.id, { verifiedAt: now, verdict: decision.verdict, endedAt: now, note });
    await setSignalStatus(signal.id, decision.verdict === "fixed" ? "resolved" : "open");
    await log("verify-fix", note, experiment.id);
    messages.push(note);
  }
  return messages.length ? messages.join(" ") : null;
}
