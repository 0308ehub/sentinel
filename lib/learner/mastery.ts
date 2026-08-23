import { prisma } from "@/lib/db/prisma";
import { getConcept } from "@/lib/curriculum/graph";

export interface MasteryOutcome {
  correct: boolean;
  /** Did the child succeed without being walked through it? */
  independent: boolean;
  /** Did they explain their reasoning correctly? */
  reasonedCorrectly: boolean;
  /** Was this a delayed retention check? */
  isRetentionCheck?: boolean;
  /** Was this an unfamiliar problem form? */
  isTransfer?: boolean;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/**
 * Mastery is probabilistic and demanding (spec §16). Three-in-a-row is NOT mastery:
 * we require reasoning, independence, varied forms, and delayed retention.
 */
export async function updateSkillState(
  childId: string,
  conceptId: string,
  outcome: MasteryOutcome
) {
  const existing = await prisma.learnerSkillState.findUnique({
    where: { childId_conceptId: { childId, conceptId } },
  });

  const prior = existing?.masteryProbability ?? 0.1;
  const priorConfidence = existing?.confidence ?? 0.0;

  let delta = 0;
  if (outcome.correct) {
    delta = outcome.independent ? 0.15 : 0.07;
    if (outcome.reasonedCorrectly) delta += 0.08;
    if (outcome.isRetentionCheck) delta += 0.1;
    if (outcome.isTransfer) delta += 0.12;
  } else {
    delta = outcome.reasonedCorrectly ? -0.08 : -0.15;
  }

  const concept = getConcept(conceptId);
  const nextRetentionCheckAt =
    outcome.correct && concept
      ? new Date(Date.now() + concept.retentionIntervalDays * 86_400_000)
      : existing?.nextRetentionCheckAt ?? null;

  const data = {
    masteryProbability: clamp(prior + delta),
    // Confidence grows with evidence volume, asymptotically.
    confidence: clamp(priorConfidence + 0.08),
    independentSuccesses:
      (existing?.independentSuccesses ?? 0) + (outcome.correct && outcome.independent ? 1 : 0),
    promptedSuccesses:
      (existing?.promptedSuccesses ?? 0) + (outcome.correct && !outcome.independent ? 1 : 0),
    failures: (existing?.failures ?? 0) + (outcome.correct ? 0 : 1),
    retentionChecksPassed:
      (existing?.retentionChecksPassed ?? 0) + (outcome.correct && outcome.isRetentionCheck ? 1 : 0),
    transferSuccesses:
      (existing?.transferSuccesses ?? 0) + (outcome.correct && outcome.isTransfer ? 1 : 0),
    lastTestedAt: new Date(),
    nextRetentionCheckAt,
  };

  return prisma.learnerSkillState.upsert({
    where: { childId_conceptId: { childId, conceptId } },
    create: { childId, conceptId, ...data },
    update: data,
  });
}

/** True mastery requires all four legs, not just a high probability. */
export function isMastered(s: {
  masteryProbability: number;
  independentSuccesses: number;
  retentionChecksPassed: number;
  transferSuccesses: number;
}): boolean {
  return (
    s.masteryProbability >= 0.8 &&
    s.independentSuccesses >= 3 &&
    s.retentionChecksPassed >= 1 &&
    s.transferSuccesses >= 1
  );
}
