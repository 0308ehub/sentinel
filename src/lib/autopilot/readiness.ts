import type { Evidence } from "./types";

export interface ReadinessInput {
  kind?: "bug" | "idea" | null;
  distinctEvidence: number;
  distinctSources: number;
  evidence: Pick<Evidence, "source" | "author">[];
  minEvidence: number;
  minSources: number;
}

/** Qualitative-only problems need corroboration from at least two named people. */
export function signalIsReady(input: ReadinessInput): boolean {
  if (input.kind === "bug") {
    const qualitativePeople = new Set(
      input.evidence
        .filter((item) => item.source !== "analytics")
        .map((item) => item.author.trim().toLowerCase())
        .filter((author) => author.length > 0 && author !== "kismet analytics"),
    );
    return qualitativePeople.size >= 2 ||
      (input.distinctEvidence >= 3 && input.distinctSources >= 1 && input.evidence.some((item) => item.source === "ticket"));
  }
  if (input.distinctEvidence < input.minEvidence || input.distinctSources < input.minSources) return false;
  if (input.evidence.some((item) => item.source === "analytics")) return true;
  const people = new Set(
    input.evidence
      .map((item) => item.author.trim())
      .filter((author) => author.length > 0 && author.toLowerCase() !== "kismet analytics"),
  );
  return people.size >= 2;
}
