import { prisma } from "@/lib/db/prisma";
import type { HypothesisCandidate } from "@/lib/shared/types";

/** A single observation may never swing a belief more than this (spec §9). */
const MAX_SWING = 0.2;
const CONFIRM_AT = 0.85;
const REFUTE_AT = 0.15;

function clamp(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/**
 * Nudges belief toward the evidence rather than replacing it. Children are noisy —
 * one wrong answer must not permanently relabel them.
 */
function nudge(current: number, towards: number): number {
  const delta = towards - current;
  return clamp(current + Math.sign(delta) * Math.min(Math.abs(delta), MAX_SWING));
}

export async function updateHypotheses(
  childId: string,
  observationId: string,
  candidates: HypothesisCandidate[]
): Promise<void> {
  for (const c of candidates) {
    const existing = await prisma.hypothesis.findFirst({
      where: { childId, type: c.type, status: { in: ["ACTIVE", "DORMANT"] } },
    });

    if (!existing) {
      // First sighting — start deliberately uncertain regardless of how confident
      // the planner sounded.
      const created = await prisma.hypothesis.create({
        data: {
          childId,
          type: c.type,
          description: c.description,
          conceptId: c.conceptId ?? null,
          confidence: clamp(Math.min(c.confidence, 0.5)),
          status: "ACTIVE",
          ...(c.supported
            ? { supportingEvidence: { connect: { id: observationId } } }
            : { contradictingEvidence: { connect: { id: observationId } } }),
        },
      });
      await prisma.hypothesisRevision.create({
        data: {
          hypothesisId: created.id,
          before: 0,
          after: created.confidence,
          reason: "First time we noticed this",
          observationId,
        },
      });
      continue;
    }

    const target = c.supported ? c.confidence : 1 - c.confidence;
    const next = nudge(existing.confidence, target);
    const status = next >= CONFIRM_AT ? "CONFIRMED" : next <= REFUTE_AT ? "REFUTED" : "ACTIVE";

    await prisma.hypothesisRevision.create({
      data: {
        hypothesisId: existing.id,
        before: existing.confidence,
        after: next,
        reason: c.supported ? "Saw it again" : "Saw the opposite",
        observationId,
      },
    });

    await prisma.hypothesis.update({
      where: { id: existing.id },
      data: {
        confidence: next,
        status,
        description: c.description || existing.description,
        ...(c.supported
          ? { supportingEvidence: { connect: { id: observationId } } }
          : { contradictingEvidence: { connect: { id: observationId } } }),
      },
    });
  }
}
