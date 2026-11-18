export interface RolloutPhase {
  at: string;
  pass: number;
}

/** The first phase is the share of visitors who see the new version now. Later phases must be in the future. */
export function normalizePhases(input: unknown, now = new Date()): RolloutPhase[] | string {
  if (!Array.isArray(input) || input.length < 1 || input.length > 6) return "Add between one and six phases.";
  const phases: RolloutPhase[] = [];
  for (let index = 0; index < input.length; index += 1) {
    const row = input[index];
    if (!row || typeof row !== "object") return "A phase is missing its date.";
    const pass = Number((row as { pass?: unknown }).pass);
    if (!Number.isInteger(pass) || pass < 1 || pass > 100) return "Each phase needs a whole percent from 1 to 100.";
    const at = index === 0 ? now : new Date(String((row as { at?: unknown }).at ?? ""));
    if (Number.isNaN(at.getTime())) return "A phase has a date Kismet cannot read.";
    if (index > 0 && at.getTime() <= now.getTime() + 60_000) return "Phases after the current one have to be in the future.";
    if (index > 0 && at.getTime() <= new Date(phases[index - 1].at).getTime()) return "Each phase has to come after the one before it.";
    phases.push({ at: at.toISOString(), pass });
  }
  return phases;
}

/** The latest phase whose time has arrived. */
export function duePhase(phases: RolloutPhase[], now = new Date()): RolloutPhase | null {
  const due = phases.filter((phase) => new Date(phase.at).getTime() <= now.getTime());
  return due.length ? due[due.length - 1] : null;
}
