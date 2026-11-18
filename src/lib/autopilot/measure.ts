import "server-only";

import { stop } from "@/lib/autopilot/lifecycle";
import { describeMetric } from "@/lib/autopilot/assign";
import { directionalNote } from "@/lib/autopilot/directional";
import { findInteraction } from "@/lib/autopilot/overlap";
import { countArms, listExperiments, listFlags, log, metricWindow, setSignalStatus, updateExperiment } from "@/lib/autopilot/store";
import { compareRates, sequentialDecreasePValue, sequentialPValue, srmCheck } from "@/lib/autopilot/stats";
import type { Experiment, Readout } from "@/lib/autopilot/types";

const MIN_VISITORS = Number(process.env.AUTOPILOT_MIN_VISITORS) || 200;
const MAX_VISITORS = Number(process.env.AUTOPILOT_MAX_VISITORS) || 2000;
const MAX_DAYS = 14;
const configuredMinDays = Number(process.env.AUTOPILOT_MIN_DAYS);
const MIN_DAYS = Number.isFinite(configuredMinDays) && configuredMinDays > 0 ? configuredMinDays : 7;

const armResult = (arm: Awaited<ReturnType<typeof countArms>>[number]) => ({
  arm: arm.arm,
  visitors: arm.visitors,
  conversions: arm.conversions,
  rate: arm.visitors ? arm.conversions / arm.visitors : null,
});

function mixingVariance(experiment: Experiment): number {
  const estimate = experiment.estimate;
  if (!estimate || estimate.baselineRate <= 0 || estimate.relativeMde <= 0) return 0.0001;
  return (estimate.baselineRate * estimate.relativeMde) ** 2;
}

async function readout(experiment: Experiment, expectedTreatmentShare: number): Promise<Readout | null> {
  if (!experiment.metricSpec || !experiment.startedAt) return null;
  const arms = await countArms(experiment.flag, experiment.startedAt, experiment.metricSpec);
  const [control, treatment] = arms;
  const { lift, pValue } = compareRates(control, treatment);
  const visitors = control.visitors + treatment.visitors;
  const enough = Math.min(control.visitors, treatment.visitors) >= MIN_VISITORS;
  const ageDays = (Date.now() - new Date(experiment.startedAt).getTime()) / 86_400_000;
  const runtimeMet = ageDays >= MIN_DAYS;
  const tauSquared = mixingVariance(experiment);
  const currentSequentialP = sequentialPValue(control, treatment, tauSquared);
  const sequentialP = currentSequentialP == null
    ? experiment.readout?.sequentialP ?? null
    : Math.min(experiment.readout?.sequentialP ?? 1, currentSequentialP);
  const srm = srmCheck(control.visitors, treatment.visitors, expectedTreatmentShare);
  const brokenSplit = visitors >= 100 && srm.pValue < 0.001;

  let guardrail: Readout["guardrail"];
  if (experiment.guardrailSpec) {
    const [guardrailControl, guardrailTreatment] = await countArms(experiment.flag, experiment.startedAt, experiment.guardrailSpec);
    const currentGuardrailP = sequentialDecreasePValue(guardrailControl, guardrailTreatment, tauSquared);
    const guardrailP = currentGuardrailP == null
      ? experiment.readout?.guardrail?.pValue ?? null
      : Math.min(experiment.readout?.guardrail?.pValue ?? 1, currentGuardrailP);
    guardrail = {
      control: armResult(guardrailControl),
      treatment: armResult(guardrailTreatment),
      pValue: guardrailP,
      worse: runtimeMet && guardrailP != null && guardrailP < 0.05,
    };
  }

  let verdict: Readout["verdict"] = "collecting";
  if (!brokenSplit && runtimeMet && guardrail?.worse) verdict = "lost";
  else if (!brokenSplit && runtimeMet && enough && sequentialP != null && sequentialP < 0.05 && lift != null) verdict = lift > 0 ? "won" : "lost";
  else if (!brokenSplit && runtimeMet && (Math.min(control.visitors, treatment.visitors) >= MAX_VISITORS || (ageDays > MAX_DAYS && enough))) verdict = "flat";

  return {
    arms: arms.map(armResult),
    lift,
    pValue,
    sequentialP,
    ...(brokenSplit ? { srm } : {}),
    srmLogged: experiment.readout?.srmLogged || brokenSplit,
    ...(guardrail ? { guardrail } : {}),
    minimumDays: MIN_DAYS,
    verdict,
    interaction: null,
    syntheticShare: visitors ? (control.syntheticVisitors + treatment.syntheticVisitors) / visitors : 0,
    at: new Date().toISOString(),
  };
}

const pct = (n: number | null) => (n == null ? "?" : `${n > 0 ? "+" : ""}${(n * 100).toFixed(1)}%`);
const ratePct = (n: number | null) => (n == null ? "?" : `${(n * 100).toFixed(1)}%`);

/** Updates every running experiment's numbers and acts on any that have reached a result. */
export async function measureRunning(): Promise<string | null> {
  const running = (await listExperiments()).filter((e) => e.status === "running");
  const flags = new Map((await listFlags()).map((flag) => [flag.key, flag]));
  const results: string[] = [];
  for (const experiment of running) {
    if (experiment.kind === "change") {
      if (!experiment.metricSpec || !experiment.startedAt) continue;
      const started = Date.parse(experiment.startedAt);
      const ageDays = (Date.now() - started) / 86_400_000;
      if (ageDays < 7) continue;
      const after = await metricWindow(experiment.metricSpec, experiment.startedAt, new Date().toISOString());
      if (ageDays < 14 && after.visitors < 40) continue;
      const before = await metricWindow(
        experiment.metricSpec,
        new Date(started - 14 * 86_400_000).toISOString(),
        experiment.startedAt,
      );
      const directional = {
        before: { visitors: before.visitors, conversions: before.conversions },
        after: { visitors: after.visitors, conversions: after.conversions },
        at: new Date().toISOString(),
      };
      await updateExperiment(experiment.id, {
        status: "rolled_out", directional, endedAt: directional.at, note: directionalNote(before, after),
      });
      await setSignalStatus(experiment.signalId, "resolved");
      await log("measure", `Followed up on “${experiment.title}” with a directional before/after.`, experiment.id);
      results.push(`Followed up on “${experiment.title}” (directional only).`);
      continue;
    }
    // The experiment it interacted with has finished: start counting again, so the result reflects only
    // what people will actually see from now on.
    if (experiment.readout?.interaction && !(await findInteraction(experiment))) {
      await updateExperiment(experiment.id, {
        startedAt: new Date().toISOString(),
        readout: null,
        note: `Measuring again from now: “${experiment.readout.interaction}” no longer runs, so earlier numbers were mixed up with it.`,
      });
      await log("measure", `Restarted measuring “${experiment.title}” on clean traffic.`, experiment.id);
      continue;
    }
    const result = await readout(experiment, (flags.get(experiment.flag)?.treatmentPct ?? 50) / 100);
    if (!result) continue;
    if (result.srm) {
      const [controlVisitors, treatmentVisitors] = result.srm.observed;
      const note = `The visitor split looks broken (${controlVisitors} vs ${treatmentVisitors}, expected about even). Results are paused until it's fixed.`;
      await updateExperiment(experiment.id, { readout: result, note });
      if (!experiment.readout?.srmLogged) {
        await log("measure", `Paused “${experiment.title}”: its visitor split looks broken.`, experiment.id);
      }
      continue;
    }
    // A result that depends on another running experiment can't be trusted yet: hold it until the
    // other one finishes, then decide on clean data.
    if (result.verdict !== "collecting") {
      const other = await findInteraction(experiment);
      if (other) {
        result.interaction = other;
        result.verdict = "collecting";
        await updateExperiment(experiment.id, {
          readout: result,
          note: `Held: its effect changes depending on which version of “${other}” people saw. Once that one finishes, it measures again on clean traffic.`,
        });
        await log("measure", `Held “${experiment.title}”: it interacts with “${other}”.`, experiment.id);
        continue;
      }
    }
    await updateExperiment(experiment.id, { readout: result });
    const fake = result.syntheticShare > 0.5 ? " (mostly synthetic traffic)" : "";

    if (result.verdict === "won") {
      await updateExperiment(experiment.id, {
        status: "awaiting_rollout",
        note: `The new version won: ${pct(result.lift)} on ${experiment.metric}, peeking-safe p = ${result.sequentialP?.toFixed(3)}${fake}.`,
      });
      await log("measure", `“${experiment.title}” won (${pct(result.lift)}). Waiting for you to roll it out.`, experiment.id);
      results.push(`“${experiment.title}” won.`);
    } else if (result.verdict === "lost") {
      if (result.guardrail?.worse && experiment.guardrailSpec) {
        const controlRate = result.guardrail.control.rate;
        const treatmentRate = result.guardrail.treatment.rate;
        const note = `Stopped: the guardrail (${describeMetric(experiment.guardrailSpec)}) got worse: ${ratePct(controlRate)} → ${ratePct(treatmentRate)}.`;
        await stop(experiment, note, true);
      } else {
        await stop(experiment, `The new version did worse (${pct(result.lift)}, peeking-safe p = ${result.sequentialP?.toFixed(3)})${fake}. Trying another idea.`, true);
      }
      results.push(`“${experiment.title}” lost and was turned off.`);
    } else if (result.verdict === "flat") {
      await stop(experiment, `No clear difference after ${result.arms[0].visitors + result.arms[1].visitors} visitors${fake}. Trying another idea.`, true);
      results.push(`“${experiment.title}” made no difference and was turned off.`);
    }
  }
  return results.length ? results.join(" ") : running.length ? `Updated ${running.length} running experiment(s).` : null;
}
