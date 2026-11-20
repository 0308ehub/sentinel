import type { CoderItem } from "../coder/view.ts";

export type SnapshotStage = "setting_up" | "rendering_current" | "rendering_new" | "checking" | "ready";

const CHECK = /(?:\bgrep\b|\bdiff\b|\bcheck|assert|validate)/i;
const RUN_RENDERER = /node\s+\S*render\.mjs/i;
const PREPARE_RENDERER = /(?:render\.mjs|control\.html|current[ -]?version|\bcontrol\b)/i;

export function snapshotStage(items: readonly CoderItem[], ready = false): SnapshotStage {
  if (ready) return "ready";
  let stage: SnapshotStage = "setting_up";
  for (const item of items) {
    if (item.kind !== "step") continue;
    const detail = `${item.tool} ${item.summary} ${item.command ?? ""}`;
    if (CHECK.test(detail)) stage = "checking";
    else if (RUN_RENDERER.test(detail)) stage = "rendering_new";
    else if (PREPARE_RENDERER.test(detail)) stage = "rendering_current";
  }
  return stage;
}

export function snapshotStageLabel(stage: SnapshotStage): string {
  return {
    setting_up: "Setting up",
    rendering_current: "Rendering current",
    rendering_new: "Rendering new version",
    checking: "Checking",
    ready: "Ready",
  }[stage];
}

export function elapsedMinutes(startedAt: string, now: string | number | Date = Date.now()): number {
  const elapsed = new Date(now).getTime() - Date.parse(startedAt);
  return Number.isFinite(elapsed) ? Math.max(0, Math.floor(elapsed / 60_000)) : 0;
}
