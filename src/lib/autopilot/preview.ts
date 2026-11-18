import type { Arm } from "@/lib/autopilot/assign";

export type PreviewOverrides = Record<string, Arm>;
export const PREVIEW_MAX_AGE_MS = 30 * 60 * 1000;

export type StoredPreview = { value: string; at: number };

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

export function parseStoredPreview(value: string | null | undefined, now = Date.now()): StoredPreview | null {
  if (!value) return null;
  try {
    const stored = JSON.parse(value) as Partial<StoredPreview>;
    if (typeof stored.value !== "string" || typeof stored.at !== "number") return null;
    if (stored.at > now || now - stored.at > PREVIEW_MAX_AGE_MS) return null;
    return { value: stored.value, at: stored.at };
  } catch {
    return null;
  }
}

export function previewOverridesForPage(
  requested: string | null,
  embedded: boolean,
  storedValue: string | null,
  now = Date.now(),
): { overrides: PreviewOverrides; stored: StoredPreview | null } {
  if (embedded) return { overrides: parsePreviewOverrides(requested), stored: null };
  if (requested === "off") return { overrides: {}, stored: null };
  const stored = parseStoredPreview(storedValue, now);
  const existing = parsePreviewOverrides(stored?.value);
  if (!requested) return { overrides: existing, stored };
  const overrides = { ...existing, ...parsePreviewOverrides(requested) };
  const value = Object.entries(overrides).map(([flag, arm]) => `${flag}:${arm}`).join(",");
  return { overrides, stored: value ? { value, at: now } : null };
}
