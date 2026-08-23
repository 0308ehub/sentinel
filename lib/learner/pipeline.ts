import { prisma } from "@/lib/db/prisma";
import { buildLearnerContext } from "./memory";
import { updateHypotheses } from "./hypothesis-engine";
import { updateSkillState } from "./mastery";
import { runPlanner } from "@/lib/ai/planner";
import { checkChildInput } from "@/lib/ai/safety";
import { embedText } from "@/lib/ai/openai-embeddings";
import type { LearnerContext, PlannerOutput } from "@/lib/shared/types";

const DEDUPE_THRESHOLD = 0.9;

export interface TurnResult {
  planner: PlannerOutput;
  context: LearnerContext;
  observationId: string;
  blocked?: { reason: string; category?: string };
}

/**
 * One full turn of observe → hypothesize → decide → remember (spec §14).
 * Returns the pedagogical decision; the caller streams the child-facing words.
 */
export async function processChildTurn(sessionId: string, childText: string): Promise<TurnResult> {
  const session = await prisma.session.findUniqueOrThrow({ where: { id: sessionId } });

  // 1. Safety gate — before anything is persisted or sent to the planner.
  const verdict = await checkChildInput(childText);

  await prisma.message.create({
    data: {
      sessionId,
      role: "CHILD",
      content: childText,
      safetyFlagged: !verdict.safe,
      safetyReason: verdict.reason ?? null,
    },
  });

  const context = await buildLearnerContext(session.childId, sessionId);

  if (!verdict.safe) {
    return {
      context,
      observationId: "",
      blocked: { reason: verdict.reason ?? "blocked", category: verdict.category },
      planner: {
        observation: "Child input was blocked by the safety layer.",
        reasoning_evidence: [],
        updated_hypotheses: [],
        next_action: "REINFORCE",
        reason: "Safety redirect.",
        response_goal:
          "Gently redirect back to learning without alarming the child, and do not engage with the flagged content.",
        memory_updates: [],
      },
    };
  }

  // 2. Plan.
  const planner = await runPlanner({ context, childResponse: childText });

  // 3. Record the raw evidence.
  const lastTutor = [...context.recentTranscript].reverse().find((m) => m.role === "TUTOR");
  const observation = await prisma.observation.create({
    data: {
      childId: session.childId,
      sessionId,
      conceptId: planner.target ?? null,
      prompt: lastTutor?.content ?? "(session start)",
      response: childText,
      correctness: planner.correctness ?? null,
      reasoningEvidence: planner.reasoning_evidence,
      reasoningPattern: planner.reasoning_pattern ?? null,
    },
  });

  // 4. Revise beliefs.
  await updateHypotheses(session.childId, observation.id, planner.updated_hypotheses);

  // 5. Update mastery when the turn actually tested a concept.
  if (planner.target && planner.correctness !== null && planner.correctness !== undefined) {
    await updateSkillState(session.childId, planner.target, {
      correct: planner.correctness,
      independent: planner.next_action !== "EXPLAIN" && planner.next_action !== "GIVE_EXAMPLE",
      reasonedCorrectly: planner.reasoning_evidence.length > 0,
    });
  }

  // 6. Record the intervention we are about to perform.
  await prisma.intervention.create({
    data: {
      childId: session.childId,
      sessionId,
      conceptId: planner.target ?? null,
      action: planner.next_action,
      strategy: planner.strategy ?? planner.next_action.toLowerCase(),
      rationale: planner.reason,
    },
  });

  // 7. Grow the knowledge graph. A memory write failure must not lose the turn.
  try {
    await persistMemories(session.childId, planner);
  } catch (err) {
    console.error("[pipeline] memory persistence failed:", err);
  }

  return { planner, context, observationId: observation.id };
}

/** Writes memory candidates, merging into existing nodes when semantically close. */
async function persistMemories(childId: string, planner: PlannerOutput): Promise<void> {
  for (const update of planner.memory_updates) {
    let embedding: number[] | null = null;
    try {
      embedding = await embedText(`${update.label}. ${update.description ?? ""}`);
    } catch {
      // Embedding failure must not lose the memory — store it unvectorised.
    }

    let nodeId: string | null = null;

    if (embedding) {
      const vec = `[${embedding.join(",")}]`;
      const near = await prisma.$queryRawUnsafe<{ id: string; similarity: number }[]>(
        `SELECT id, 1 - (embedding <=> $1::vector) AS similarity
         FROM "MemoryNode"
         WHERE "childId" = $2 AND embedding IS NOT NULL AND type = $3::"MemoryNodeType"
         ORDER BY embedding <=> $1::vector
         LIMIT 1`,
        vec,
        childId,
        update.type
      );
      if (near[0] && near[0].similarity >= DEDUPE_THRESHOLD) nodeId = near[0].id;
    }

    if (nodeId) {
      await prisma.memoryNode.update({
        where: { id: nodeId },
        data: {
          evidenceCount: { increment: 1 },
          lastObservedAt: new Date(),
          confidence: { set: Math.min(1, update.confidence + 0.1) },
        },
      });
    } else {
      const created = await prisma.memoryNode.create({
        data: {
          childId,
          type: update.type,
          label: update.label,
          description: update.description ?? null,
          confidence: update.confidence,
          importance: update.importance,
        },
      });
      nodeId = created.id;
      if (embedding) {
        await prisma.$executeRawUnsafe(
          `UPDATE "MemoryNode" SET embedding = $1::vector WHERE id = $2`,
          `[${embedding.join(",")}]`,
          nodeId
        );
      }
    }

    // Link into the graph when the planner named a relationship.
    if (update.relationship && update.relatedLabel) {
      const related = await prisma.memoryNode.findFirst({
        where: { childId, label: update.relatedLabel },
      });
      if (related && nodeId) {
        await prisma.memoryEdge.upsert({
          where: {
            sourceNodeId_targetNodeId_relationship: {
              sourceNodeId: nodeId,
              targetNodeId: related.id,
              relationship: update.relationship,
            },
          },
          create: {
            sourceNodeId: nodeId,
            targetNodeId: related.id,
            relationship: update.relationship,
          },
          update: { evidenceCount: { increment: 1 } },
        });
      }
    }
  }
}
