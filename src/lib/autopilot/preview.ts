import type { Arm } from "@/lib/autopilot/assign";

export type PreviewOverrides = Record<string, Arm>;

export function parsePreviewOverrides(value: string | null | undefined): PreviewOverrides {
  const overrides: PreviewOverrides = {};
  if (!value || value === "off") return overrides;
  for (const item of value.split(",")) {
    const separator = item.lastIndexOf(":");
    if (separator <= 0) continue;
    const flag = item.slice(0, separator).trim();
    const arm = item.slice(separator + 1).trim();
    if (flag && (arm === "control" || arm === "treatment")) overrides[flag] = arm;
  }
  return overrides;
}

export function hasPreviewOverrides(overrides: PreviewOverrides): boolean {
  return Object.keys(overrides).length > 0;
}
