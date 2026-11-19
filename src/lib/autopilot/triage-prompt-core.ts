export interface TriagePromptSignal {
  id: string;
  title: string;
  problem: string;
  evidence: Array<{ title: string }>;
}

export function triageSystemPrompt(): string {
  return [
    "Classify each product problem as bug or idea.",
    "bug means something is broken or behaves wrongly: errors, actions that do nothing, wrong data, crashes, or broken flows.",
    "idea means it works as built but could be better: discoverability, copy, layout, or a new capability.",
    "Return JSON {results:[{id,kind,reason}]}. Classify every id once and give a one-sentence reason.",
  ].join(" ");
}

export function triageInput(signals: TriagePromptSignal[]): string {
  return JSON.stringify(signals.map((signal) => ({
    id: signal.id,
    title: signal.title,
    problem: signal.problem,
    evidence: signal.evidence.slice(0, 5).map((item) => item.title),
  })));
}
