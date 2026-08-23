import { prisma } from "@/lib/db/prisma";
import { getUnlockedConcepts } from "@/lib/curriculum/graph";
import { isMastered } from "./mastery";

export type MasteryLabel = "Not started" | "Beginning" | "Developing" | "Secure" | "Mastered";

export function masteryLabel(s: {
  masteryProbability: number;
  independentSuccesses: number;
  retentionChecksPassed: number;
  transferSuccesses: number;
}): MasteryLabel {
  if (isMastered(s)) return "Mastered";
  if (s.masteryProbability >= 0.6) return "Secure";
  if (s.masteryProbability >= 0.3) return "Developing";
  if (s.masteryProbability > 0) return "Beginning";
  return "Not started";
}

/** How much a parent should trust a stated belief about their child. */
export function confidenceLabel(confidence: number): string {
  if (confidence >= 0.8) return "Confident";
  if (confidence >= 0.5) return "Fairly sure";
  return "Still checking";
}

export async function buildParentReport(childId: string) {
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);

  const [child, skills, hypotheses, memories, interventions, sessions, weekSessions, events] =
    await Promise.all([
      prisma.child.findUniqueOrThrow({
        where: { id: childId },
        include: { mentorProfile: true },
      }),
      prisma.learnerSkillState.findMany({
        where: { childId },
        include: { concept: true },
        orderBy: [{ concept: { domain: "asc" } }, { concept: { sequence: "asc" } }],
      }),
      prisma.hypothesis.findMany({
        where: { childId, status: { in: ["ACTIVE", "CONFIRMED"] } },
        include: { _count: { select: { supportingEvidence: true } } },
        orderBy: { confidence: "desc" },
      }),
      prisma.memoryNode.findMany({
        where: { childId },
        orderBy: { evidenceCount: "desc" },
        take: 30,
      }),
      prisma.intervention.findMany({
        where: { childId, successful: true },
        select: { strategy: true },
      }),
      prisma.session.findMany({
        where: { childId },
        orderBy: { startedAt: "desc" },
        include: { _count: { select: { messages: true } } },
      }),
      prisma.session.findMany({
        where: { childId, startedAt: { gte: weekAgo } },
        select: { startedAt: true, endedAt: true },
      }),
      prisma.learningEvent.findMany({
        where: { childId },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
    ]);

  // Sessions rarely get an explicit end, so fall back to a nominal length rather
  // than reporting zero minutes for real conversations.
  const minutesThisWeek = weekSessions.reduce((acc, s) => {
    const end = s.endedAt?.getTime() ?? s.startedAt.getTime() + 8 * 60_000;
    return acc + Math.max(0, Math.round((end - s.startedAt.getTime()) / 60_000));
  }, 0);

  const strategyCounts = new Map<string, number>();
  for (const i of interventions) {
    strategyCounts.set(i.strategy, (strategyCounts.get(i.strategy) ?? 0) + 1);
  }
  const bestStrategies = [...strategyCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([strategy, count]) => ({ strategy, count }));

  const masteredIds = skills.filter((s) => isMastered(s)).map((s) => s.conceptId);

  // What's next means what we're actually working on, not just the frontier.
  // A concept already underway matters more to a parent than one that is unlocked
  // but untouched — and it can be underway while its prerequisites are still short
  // of full mastery, which is exactly where most real learning sits.
  const attempts = (s: { independentSuccesses: number; promptedSuccesses: number; failures: number }) =>
    s.independentSuccesses + s.promptedSuccesses + s.failures;

  const inProgress = skills
    .filter((s) => !isMastered(s) && s.masteryProbability > 0)
    // Most-worked first: the concept a child keeps running into is the one a
    // parent cares about, not whichever happens to have the lowest score.
    .sort((a, b) => attempts(b) - attempts(a) || a.masteryProbability - b.masteryProbability)
    .map((s) => s.conceptId);

  const nextConceptIds = [...new Set([...inProgress, ...getUnlockedConcepts(masteredIds)])].slice(0, 3);

  /**
   * A parent should never be shown a claim about their child that rests on one
   * observation. Children are noisy and transcription is imperfect; a single
   * misheard turn must not become "what we noticed about your child".
   */
  const reportableHypotheses = hypotheses
    .filter((h) => h._count.supportingEvidence >= 2 || h.confidence >= 0.75)
    .slice(0, 8);

  return {
    child,
    skills,
    hypotheses: reportableHypotheses,
    provisionalCount: hypotheses.length - reportableHypotheses.length,
    interests: memories.filter((m) => m.type === "INTEREST"),
    misconceptions: memories.filter((m) => m.type === "MISCONCEPTION"),
    patterns: memories.filter((m) => m.type === "REASONING_PATTERN"),
    bestStrategies,
    sessions,
    events,
    stats: {
      sessionsThisWeek: weekSessions.length,
      minutesThisWeek,
      totalSessions: sessions.length,
      conceptsTouched: skills.length,
      conceptsMastered: masteredIds.length,
    },
    nextConceptIds,
  };
}
