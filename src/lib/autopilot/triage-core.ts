export interface TriageResult {
  id: string;
  kind: "bug" | "idea";
  reason: string;
}

export function parseTriageResults(value: unknown, allowedIds: ReadonlySet<string>): TriageResult[] {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const candidates = Array.isArray(value) ? value : Array.isArray(record.results) ? record.results : [];
  const seen = new Set<string>();
  const results: TriageResult[] = [];
  for (const item of candidates) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const id = typeof row.id === "string" ? row.id.trim() : "";
    const kind = row.kind === "bug" || row.kind === "idea" ? row.kind : null;
    const reason = typeof row.reason === "string" ? row.reason.trim() : "";
    if (!id || !allowedIds.has(id) || seen.has(id) || !kind || !reason) continue;
    seen.add(id);
    results.push({ id, kind, reason: reason.slice(0, 500) });
  }
  return results;
}
