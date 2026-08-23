import { prisma } from "@/lib/db/prisma";
import type { LearnerContext, MemoryView, StrategyView } from "@/lib/shared/types";

const MAX_MEMORIES = 8;
const RECENCY_HALF_LIFE_DAYS = 21;

function recencyScore(lastObservedAt: Date): number {
  const days = (Date.now() - lastObservedAt.getTime()) / 86_400_000;
  return Math.pow(0.5, days / RECENCY_HALF_LIFE_DAYS);
}

/** relevance × confidence × recency × importance (spec §11). */
function rank(m: MemoryView, relevance: number): number {
  return relevance * m.confidence * recencyScore(m.lastObservedAt) * m.importance;
}

/**
 * Assembles the compact per-turn context. Deliberately capped — we never dump
 * full history into the model.
 */
export async function buildLearnerContext(
  childId: string,
  sessionId?: string,
  focusConceptIds: string[] = []
): Promise<LearnerContext> {
  const child = await prisma.child.findUniqueOrThrow({
    where: { id: childId },
    include: { mentorProfile: true },
  });

  const [skillStates, hypotheses, memories, interventions, messages] = await Promise.all([
    prisma.learnerSkillState.findMany({
      where: { childId },
      include: { concept: true },
      orderBy: { updatedAt: "desc" },
      take: 12,
    }),
    prisma.hypothesis.findMany({
      where: { childId, status: "ACTIVE" },
      orderBy: { confidence: "desc" },
      take: 6,
    }),
    prisma.memoryNode.findMany({
      where: { childId },
      orderBy: { lastObservedAt: "desc" },
      take: 40,
    }),
    prisma.intervention.findMany({
      where: { childId, successful: { not: null } },
      select: { strategy: true, successful: true },
    }),
    sessionId
      ? prisma.message.findMany({
          where: { sessionId },
          orderBy: { createdAt: "asc" },
          take: 12,
          select: { role: true, content: true },
        })
      : Promise.resolve([]),
  ]);

  const memoryViews: MemoryView[] = memories.map((m) => ({
    id: m.id,
    type: m.type,
    label: m.label,
    description: m.description,
    confidence: m.confidence,
    importance: m.importance,
    lastObservedAt: m.lastObservedAt,
  }));

  // Relevance: boost memories whose label mentions a focus concept, and always
  // keep interests in play — they are how we make problems feel personal.
  const focusText = focusConceptIds.join(" ").toLowerCase();
  const relevant = memoryViews
    .map((m) => {
      const label = m.label.toLowerCase();
      let relevance = 0.5;
      if (focusText && focusText.includes(label.replace(/\s+/g, "_"))) relevance = 1;
      else if (m.type === "MISCONCEPTION" || m.type === "TEACHING_STRATEGY") relevance = 0.85;
      else if (m.type === "INTEREST") relevance = 0.7;
      return { m, score: rank(m, relevance) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_MEMORIES)
    .map((x) => x.m);

  const byStrategy = new Map<string, { attempts: number; successes: number }>();
  for (const i of interventions) {
    const cur = byStrategy.get(i.strategy) ?? { attempts: 0, successes: 0 };
    cur.attempts += 1;
    if (i.successful) cur.successes += 1;
    byStrategy.set(i.strategy, cur);
  }
  const successfulStrategies: StrategyView[] = [...byStrategy.entries()]
    .map(([strategy, v]) => ({ strategy, ...v, successRate: v.successes / v.attempts }))
    .sort((a, b) => b.successRate - a.successRate)
    .slice(0, 5);

  return {
    childId,
    childName: child.name,
    mentorName: child.mentorProfile?.mentorName ?? null,
    ageYears: child.ageYears,
    gradeLabel: child.gradeLabel,
    interests: child.interests,
    activeSkills: skillStates.map((s) => ({
      conceptId: s.conceptId,
      label: s.concept.label,
      masteryProbability: s.masteryProbability,
      confidence: s.confidence,
      lastTestedAt: s.lastTestedAt,
    })),
    activeHypotheses: hypotheses.map((h) => ({
      id: h.id,
      type: h.type,
      description: h.description,
      confidence: h.confidence,
      conceptId: h.conceptId,
    })),
    relevantMemories: relevant,
    successfulStrategies,
    recentTranscript: messages.map((m) => ({ role: m.role, content: m.content })),
  };
}
