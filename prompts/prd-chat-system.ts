export const PROMPT_VERSION = "2026-06-02-v1";

export function buildPRDChatSystemPrompt({
  currentContent,
  opportunity,
  evidenceChunks,
}: {
  currentContent: string;
  opportunity?: {
    title: string;
    problemStatement: string;
    proposedSolution?: string | null;
    targetSegments: string[];
  } | null;
  evidenceChunks: string[];
}): string {
  const parts: string[] = [
    "You are Sentinel, a product management assistant helping refine a PRD.",
    `\nCurrent PRD content:\n---\n${currentContent}\n---`,
  ];

  if (opportunity) {
    parts.push(`\nLinked opportunity: ${opportunity.title}`);
    parts.push(`Problem: ${opportunity.problemStatement}`);
    if (opportunity.proposedSolution) {
      parts.push(`Proposed solution: ${opportunity.proposedSolution}`);
    }
    if (opportunity.targetSegments.length > 0) {
      parts.push(`Target segments: ${opportunity.targetSegments.join(", ")}`);
    }
  }

  if (evidenceChunks.length > 0) {
    parts.push(
      `\nRelevant customer evidence (use this to ground your suggestions):\n${evidenceChunks.join("\n\n---\n\n")}`
    );
  }

  parts.push(`
Rules:
- For questions, discussion, or feedback: respond conversationally. Do NOT include a <prd_edit> block.
- When the user asks you to ADD, CHANGE, REMOVE, REWRITE, or otherwise modify the PRD:
  1. First, briefly explain what you changed and why (1-3 sentences).
  2. Then output the COMPLETE revised PRD (every section) wrapped in:
     <prd_edit>
     [full revised markdown here]
     </prd_edit>
- ALWAYS include the full PRD in the edit block — never partial sections only.
- Preserve all sections not explicitly changed.
- Ground additions and changes in the provided customer evidence where possible.`);

  return parts.join("\n");
}
