import type { Experiment } from "./types";

/** Midnight on the first day of the month that `now` falls in, in local time. */
export function startOfMonth(now: number): number {
  const date = new Date(now);
  return new Date(date.getFullYear(), date.getMonth(), 1).getTime();
}

/** True when the experiment's result was declared a winner at or after `since`. */
export function wonSince(experiment: Pick<Experiment, "readout">, since: number): boolean {
  return experiment.readout?.verdict === "won" && Date.parse(experiment.readout.at) >= since;
}
