import "server-only";

import { stop } from "@/lib/autopilot/lifecycle";
import { findInteraction } from "@/lib/autopilot/overlap";
import { countArms, listExperiments, log, updateExperiment } from "@/lib/autopilot/store";
import type { Experiment, Readout } from "@/lib/autopilot/types";

const MIN_VISITORS = Number(process.env.AUTOPILOT_MIN_VISITORS) || 200;
const MAX_VISITORS = Number(process.env.AUTOPILOT_MAX_VISITORS) || 2000;
const MAX_DAYS = 14;
const ALPHA = 0.05;

// Standard normal CDF (Abramowitz–Stegun 7.1.26), accurate to ~1e-7, plenty for a readout.
function normalCdf(z: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const erf =
    1 - (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t) * Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}

/** Two-sided two-proportion z-test. */
export function compareRates(c: { visitors: number; conversions: number }, t: { visitors: number; conversions: number }) {
  if (c.visitors === 0 || t.visitors === 0) return { lift: null, pValue: null };
  const pc = c.conversions / c.visitors;
  const pt = t.conversions / t.visitors;
  const pooled = (c.conversions + t.conversions) / (c.visitors + t.visitors);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / c.visitors + 1 / t.visitors));
  const lift = pc > 0 ? (pt - pc) / pc : null;
  if (se === 0) return { lift, pValue: null };
  const z = (pt - pc) / se;
  return { lift, pValue: 2 * (1 - normalCdf(Math.abs(z))) };
}

async function readout(experiment: Experiment): Promise<Readout | null> {
  if (!experiment.metricSpec || !experiment.startedAt) return null;
  const arms = await countArms(experiment.flag, experiment.startedAt, experiment.metricSpec);
  const [control, treatment] = arms;
  const { lift, pValue } = compareRates(control, treatment);
  const visitors = control.visitors + treatment.visitors;
  const enough = Math.min(control.visitors, treatment.visitors) >= MIN_VISITORS;
  const ageDays = (Date.now() - new Date(experiment.startedAt).getTime()) / 86_400_000;

  let verdict: Readout["verdict"] = "collecting";
  if (enough && pValue != null && pValue < ALPHA && lift != null) verdict = lift > 0 ? "won" : "lost";
  else if (Math.min(control.visitors, treatment.visitors) >= MAX_VISITORS || (ageDays > MAX_DAYS && enough)) verdict = "flat";

  return {
    arms: arms.map((a) => ({
      arm: a.arm,
      visitors: a.visitors,
      conversions: a.conversions,
      rate: a.visitors ? a.conversions / a.visitors : null,
    })),
    lift,
    pValue,
    verdict,
    interaction: null,
    syntheticShare: visitors ? (control.syntheticVisitors + treatment.syntheticVisitors) / visitors : 0,
    at: new Date().toISOString(),
  };
}

const pct = (n: number | null) => (n == null ? "?" : `${n > 0 ? "+" : ""}${(n * 100).toFixed(1)}%`);

/** Updates every running experiment's numbers and acts on any that have reached a result. */
export async function measureRunning(): Promise<string | null> {
  const running = (await listExperiments()).filter((e) => e.status === "running");
  const results: string[] = [];
  for (const experiment of running) {
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
    const result = await readout(experiment);
    if (!result) continue;
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
        note: `The new version won: ${pct(result.lift)} on ${experiment.metric}, p = ${result.pValue?.toFixed(3)}${fake}.`,
      });
      await log("measure", `“${experiment.title}” won (${pct(result.lift)}). Waiting for you to roll it out.`, experiment.id);
      results.push(`“${experiment.title}” won.`);
    } else if (result.verdict === "lost") {
      await stop(experiment, `The new version did worse (${pct(result.lift)}, p = ${result.pValue?.toFixed(3)})${fake}. Trying another idea.`, true);
      results.push(`“${experiment.title}” lost and was turned off.`);
    } else if (result.verdict === "flat") {
      await stop(experiment, `No clear difference after ${result.arms[0].visitors + result.arms[1].visitors} visitors${fake}. Trying another idea.`, true);
      results.push(`“${experiment.title}” made no difference and was turned off.`);
    }
  }
  return results.length ? results.join(" ") : running.length ? `Updated ${running.length} running experiment(s).` : null;
}
