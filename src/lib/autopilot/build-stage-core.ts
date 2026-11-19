import type { CoderItem } from "../coder/view.ts";

export const STALL_MINUTES = 12;
export const MAX_BUILD_MINUTES = 40;
export const MAX_ATTEMPTS = 2;

export type BuildStage = "starting" | "reading" | "writing" | "checking" | "pushing" | "opening_pr";

const READ_TOOL = /(?:^|_)(?:read|view|glob|grep|search|find|ls)(?:$|_)/i;
const WRITE_TOOL = /(?:^|_)(?:edit|write|str_replace|replace|patch|create)(?:$|_)/i;
const CHECK_COMMAND = /(?:npm\s+(?:test|run\s+(?:test|lint|build|typecheck))|pnpm\s+(?:test|run\s+(?:test|lint|build|typecheck))|yarn\s+(?:test|(?:run\s+)?(?:test|lint|build|typecheck))|\btsc\b|\beslint\b|\bnext\s+build\b|\bnode\s+--test\b|\bvitest\b|\bjest\b)/i;
const PUSH_COMMAND = /\bgit\s+(?:commit|push)\b/i;

export function buildStage(items: readonly CoderItem[], options: { hasBranch: boolean }): BuildStage {
  if (options.hasBranch) return "opening_pr";
  let stage: BuildStage = "starting";
  for (const item of items) {
    if (item.kind !== "step") continue;
    const tool = item.tool.trim();
    if (READ_TOOL.test(tool)) stage = "reading";
    else if (WRITE_TOOL.test(tool)) stage = "writing";
    else if (tool.toLowerCase() === "bash") {
      if (PUSH_COMMAND.test(item.summary)) stage = "pushing";
      else if (CHECK_COMMAND.test(item.summary)) stage = "checking";
      else if (stage === "starting") stage = "reading";
    }
  }
  return stage;
}

export function stageLabel(stage: BuildStage): string {
  return {
    starting: "Starting",
    reading: "Reading the code",
    writing: "Writing the change",
    checking: "Running checks",
    pushing: "Pushing the branch",
    opening_pr: "Opening the PR",
  }[stage];
}

export function stallDecision(input: {
  status: string;
  stageAt: string | null;
  startedAt: string | null;
  attempts: number;
  now: string | number | Date;
}): "ok" | "retry" | "give_up" {
  if (input.status !== "running" && input.status !== "rescheduling") return "ok";
  const now = new Date(input.now).getTime();
  const startedAt = input.startedAt ? Date.parse(input.startedAt) : Number.NaN;
  const stageAt = input.stageAt ? Date.parse(input.stageAt) : startedAt;
  const stalled = Number.isFinite(stageAt) && now - stageAt >= STALL_MINUTES * 60_000;
  const expired = Number.isFinite(startedAt) && now - startedAt >= MAX_BUILD_MINUTES * 60_000;
  // The total limit covers every attempt, so a build past it stops instead of starting over.
  if (expired) return "give_up";
  if (!stalled) return "ok";
  return input.attempts >= MAX_ATTEMPTS ? "give_up" : "retry";
}
