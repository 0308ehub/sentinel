import "server-only";

import { askForJson, readJson } from "@/lib/ai/respond";
import { fallbackLearning, outcomeFor } from "@/lib/autopilot/learning-core";
import { experimentsNeedingLearnings, insertLearning, listSignals, log } from "@/lib/autopilot/store";

interface LearningAnswer { learning?: string }

export async function learnFromFinished(): Promise<string | null> {
  const [experiments, signals] = await Promise.all([experimentsNeedingLearnings(), listSignals()]);
  if (experiments.length === 0) return null;
  const learned: string[] = [];
  for (const experiment of experiments) {
    const outcome = outcomeFor(experiment);
    const visitors = experiment.kind === "change"
      ? experiment.directional?.after.visitors ?? null
      : experiment.readout?.arms.reduce((sum, arm) => sum + arm.visitors, 0) ?? null;
    const problem = signals.find((signal) => signal.id === experiment.signalId)?.title ?? "Unknown problem";
    let learning: string;
    try {
      const system = [
        "Write one or two sentences a product manager would keep as an experiment learning.",
        "Say what changed, what happened to the metric including the numeric result and certainty when available,",
        "and what this suggests trying or avoiding next. Return JSON: {learning}.",
        experiment.kind === "change" ? "This was shipped to everyone and followed up with a directional before/after, not a controlled test. Say that plainly and do not claim causation." : "",
        experiment.kind === "fix" ? "This was a bug fix verified by whether complaints continued, not a controlled test. Say that plainly and do not discuss lift or causation." : "",
      ].join(" ");
      const user = JSON.stringify({ problem, experiment: {
        title: experiment.title, hypothesis: experiment.hypothesis, control: experiment.control,
        treatment: experiment.treatment, metric: experiment.metric, page: experiment.page,
        guardrail: experiment.guardrail, note: experiment.note, outcome,
        readout: experiment.readout, directional: experiment.directional, estimate: experiment.estimate,
      } });
      const answer = readJson<LearningAnswer>(await askForJson(system, user, false, undefined, "experiment"));
      if (!answer.learning?.trim()) throw new Error("The learning was empty.");
      learning = answer.learning.trim();
    } catch {
      learning = fallbackLearning(experiment, outcome);
    }
    await insertLearning({
      experimentId: experiment.id, signalId: experiment.signalId,
      kind: outcome === "rejected" ? "rejected" : "result", outcome,
      title: experiment.title, page: experiment.page, metric: experiment.metric, change: experiment.treatment,
      lift: experiment.readout?.lift ?? null, pValue: experiment.readout?.pValue ?? null, visitors, learning,
    });
    await log("learn", `Learned from “${experiment.title}”: ${outcome}.`, experiment.id);
    learned.push(`Learned from “${experiment.title}”.`);
  }
  return learned.join(" ");
}
