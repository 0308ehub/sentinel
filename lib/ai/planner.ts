import Anthropic from "@anthropic-ai/sdk";
import { jsonrepair } from "jsonrepair";
import {
  plannerOutputSchema,
  memoryUpdateSchema,
  type PlannerOutput,
  type LearnerContext,
  type MemoryUpdate,
} from "@/lib/shared/types";
import { getConcept, getUnlockedConcepts } from "@/lib/curriculum/graph";
import { CONCEPTS } from "@/lib/curriculum/concepts";

const PLANNER_MODEL = "claude-sonnet-5";

const SYSTEM = `You are the pedagogical planner for an AI mentor that teaches children aged 5-9.

You never speak to the child. You decide what should happen next, and a separate
conversational model turns your decision into child-facing words.

Your job each turn:
1. Observe what the child's response reveals — about process, not just correctness.
2. Update hypotheses about how this child thinks. Hypotheses are revisable beliefs
   with confidence, never permanent labels. A single wrong answer is weak evidence;
   children are noisy.
3. Choose the next action with the HIGHEST INFORMATION VALUE — the one that best
   discriminates between competing hypotheses. This is usually NOT simply the next
   curriculum problem.
4. Propose durable memories worth keeping.

Critical distinction you must make when a child answers incorrectly:
- correct answer + correct reasoning
- correct answer + weak reasoning (possible guess)
- arithmetic slip
- conceptual misunderstanding
- guessing
- language misunderstanding
- attention failure
These demand different responses. Diagnose before you teach.

Actions available:
PROBE — ask a discriminating question to test between hypotheses
EXPLAIN — teach the idea directly
GIVE_EXAMPLE — offer a worked example
ASK_CHILD_TO_EXPLAIN — get the child to narrate their reasoning
REINFORCE — consolidate something just done well
REVIEW — revisit an earlier concept
ADVANCE — move to the next concept
CHANGE_REPRESENTATION — switch to a different model (number line, counters, story)

BE CONCISE. You are writing machine-readable JSON, not prose. Hard limits:
- observation: max 30 words
- reason and response_goal: max 25 words each
- reasoning_evidence: max 3 short items
- updated_hypotheses: max 3
- memory_updates: max 3
Exceeding these truncates your output and the turn is lost.

Reply with ONLY a JSON object. Emit the keys in EXACTLY this order — the decision
fields come first so they always survive:
{
  "next_action": one of the actions above,
  "target": conceptId | null,
  "strategy": string | null,
  "reason": string,
  "response_goal": string,
  "observation": string,
  "correctness": boolean | null,
  "reasoning_pattern": string | null,
  "reasoning_evidence": string[],
  "updated_hypotheses": [{"type": string, "description": string, "confidence": number, "supported": boolean, "conceptId": string | null}],
  "memory_updates": [{"type": string, "label": string, "description": string | null, "confidence": number, "importance": number, "relationship": string | null, "relatedLabel": string | null}]
}

"target" MUST be one of the concept ids listed under CURRICULUM STATE, or null.
Never invent a concept id.

Hypothesis "type" MUST be a specific snake_case slug naming the SPECIFIC belief,
e.g. "digitwise_subtraction", "loses_track_crossing_ten", "guesses_when_unsure",
"counts_all_not_on". NEVER use vague types like "skill", "foundation", or "math" —
those collapse distinct beliefs together and destroy the model of the child.

Always propose at least one memory_update when you learn something durable about
this child — an interest, a misconception, a reasoning pattern, or a strategy that
worked. Use relationship + relatedLabel to link it to something already known.`;


/** Near-miss labels the model reaches for, mapped onto the real enum. */
const NODE_TYPE_ALIASES: Record<string, string> = {
  SKILL_SIGNAL: "SKILL",
  SKILL_OBSERVATION: "SKILL",
  OBSERVATION: "EXPERIENCE",
  EVENT: "EXPERIENCE",
  STRATEGY: "TEACHING_STRATEGY",
  TEACHING_APPROACH: "TEACHING_STRATEGY",
  ERROR_PATTERN: "REASONING_PATTERN",
  PATTERN: "REASONING_PATTERN",
  ERROR: "MISCONCEPTION",
  TOPIC: "CONCEPT",
  PREFERENCE: "INTEREST",
};

const RELATIONSHIP_ALIASES: Record<string, string> = {
  OBSERVED_IN: "STRUGGLES_WITH",
  RELATED_TO: "EXPLAINED_BY",
  APPLIES_TO: "EXPLAINED_BY",
  HELPED_WITH: "IMPROVED_BY",
  LIKES: "INTERESTED_IN",
};

const VALID_RELATIONSHIPS = new Set([
  "STRUGGLES_WITH", "MASTERED", "INTERESTED_IN", "RESPONDS_WELL_TO", "CONFUSES_WITH",
  "PREREQUISITE_OF", "EXPLAINED_BY", "IMPROVED_BY", "AVOIDS", "PREFERS",
  "RETAINED_AFTER", "CAUSED_BY",
]);

/**
 * Salvages memory updates rather than discarding them. The model reliably produces
 * good content with slightly-off enum labels; dropping the whole entry over a label
 * would throw away the knowledge graph.
 */
function coerceMemoryUpdates(raw: unknown[]): MemoryUpdate[] {
  const out: MemoryUpdate[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = { ...(item as Record<string, unknown>) };

    if (typeof rec.type === "string") {
      const upper = rec.type.toUpperCase().replace(/\s+/g, "_");
      rec.type = NODE_TYPE_ALIASES[upper] ?? upper;
    }

    if (typeof rec.relationship === "string") {
      const upper = rec.relationship.toUpperCase().replace(/\s+/g, "_");
      const mapped = RELATIONSHIP_ALIASES[upper] ?? upper;
      // An unrecognised relationship costs us the edge, never the node.
      rec.relationship = VALID_RELATIONSHIPS.has(mapped) ? mapped : null;
    }

    const parsed = memoryUpdateSchema.safeParse(rec);
    if (parsed.success) out.push(parsed.data);
    else if (process.env.PLANNER_DEBUG) {
      console.error("[planner] dropped memory update:", JSON.stringify(rec));
    }
  }
  return out;
}

export interface PlannerInput {
  context: LearnerContext;
  childResponse: string;
  goal?: string;
  /** Concepts the caller already believes are in play this turn. */
  focusConceptIds?: string[];
}

function renderContext(
  ctx: LearnerContext,
  goal: string,
  childResponse: string,
  focusConceptIds: string[] = []
): string {
  const mastered = ctx.activeSkills.filter((s) => s.masteryProbability > 0.8).map((s) => s.conceptId);
  // The frontier, plus anything already in play, plus explicit focus — a child can
  // demonstrate a concept well before its prerequisites are formally mastered.
  const unlocked = Array.from(
    new Set([
      ...getUnlockedConcepts(mastered),
      ...ctx.activeSkills.map((s) => s.conceptId),
      ...focusConceptIds,
    ])
  ).slice(0, 10);

  const lines: string[] = [];
  lines.push(`GOAL: ${goal}`);
  lines.push(`\nCHILD: ${ctx.childName}, age ${ctx.ageYears}${ctx.gradeLabel ? `, ${ctx.gradeLabel}` : ""}`);
  if (ctx.interests.length) lines.push(`INTERESTS: ${ctx.interests.join(", ")}`);

  lines.push(`\nCURRICULUM STATE:`);
  if (ctx.activeSkills.length === 0) {
    lines.push("  (no skills assessed yet — this is early in the relationship)");
  } else {
    for (const s of ctx.activeSkills.slice(0, 8)) {
      lines.push(
        `  ${s.label}: mastery ${s.masteryProbability.toFixed(2)} (confidence ${s.confidence.toFixed(2)})`
      );
    }
  }
  lines.push(`  CANDIDATE NEXT CONCEPTS: ${unlocked.join(", ") || "none unlocked"}`);
  lines.push(`  ALL CONCEPT IDS: ${CONCEPTS.map((c) => c.id).join(", ")}`);

  for (const id of unlocked.slice(0, 2)) {
    const c = getConcept(id);
    if (!c) continue;
    lines.push(`\n  CONCEPT ${c.id} — ${c.label}`);
    lines.push(`    misconceptions: ${c.commonMisconceptions.join(" | ")}`);
    lines.push(`    diagnostics: ${c.diagnosticQuestions.join(" | ")}`);
    lines.push(`    strategies: ${c.teachingStrategies.join(", ")}`);
  }

  lines.push(`\nACTIVE HYPOTHESES:`);
  lines.push(
    ctx.activeHypotheses.length
      ? ctx.activeHypotheses
          .map((h) => `  [${h.confidence.toFixed(2)}] ${h.type}: ${h.description}`)
          .join("\n")
      : "  (none yet)"
  );

  lines.push(`\nRELEVANT MEMORY:`);
  lines.push(
    ctx.relevantMemories.length
      ? ctx.relevantMemories
          .map((m) => `  (${m.type}) ${m.label}${m.description ? ` — ${m.description}` : ""}`)
          .join("\n")
      : "  (none yet)"
  );

  lines.push(`\nWHAT HAS WORKED FOR THIS CHILD:`);
  lines.push(
    ctx.successfulStrategies.length
      ? ctx.successfulStrategies
          .map((s) => `  ${s.strategy}: ${s.successes}/${s.attempts} successful`)
          .join("\n")
      : "  (no intervention history yet)"
  );

  lines.push(`\nRECENT TRANSCRIPT:`);
  lines.push(ctx.recentTranscript.map((m) => `  ${m.role}: ${m.content}`).join("\n") || "  (new session)");

  lines.push(`\nLAST CHILD RESPONSE: ${childResponse}`);
  return lines.join("\n");
}

export async function runPlanner(input: PlannerInput): Promise<PlannerOutput> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const goal =
    input.goal ??
    "Learn how this child thinks. Diagnose before teaching. Choose the highest-information next step.";
  const prompt = renderContext(input.context, goal, input.childResponse, input.focusConceptIds ?? []);

  const call = async () => {
    const res = await client.messages.create({
      model: PLANNER_MODEL,
      max_tokens: 4000,
      system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
    });
    const block = res.content.find((b) => b.type === "text");
    return block && "text" in block ? block.text : "";
  };

  let text = await call();
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      const slice = start !== -1 && end > start ? text.slice(start, end + 1) : text;
      const raw = plannerOutputSchema.parse(JSON.parse(jsonrepair(slice)));
      return { ...raw, memory_updates: coerceMemoryUpdates(raw.memory_updates) };
    } catch (err) {
      if (process.env.PLANNER_DEBUG) {
        console.error("[planner] parse failure:", err instanceof Error ? err.message : err);
        console.error("[planner] raw output:\n", text.slice(0, 2000));
      }
      if (attempt === 0) text = await call();
    }
  }

  // Planner failed twice — degrade to a safe, information-seeking default
  // rather than blocking the session.
  const fallback = plannerOutputSchema.parse({
    observation: "Planner output could not be parsed.",
    next_action: "ASK_CHILD_TO_EXPLAIN",
    reason: "Falling back to eliciting the child's reasoning after a planner failure.",
    response_goal: "Ask the child to describe how they worked it out.",
  });
  return { ...fallback, memory_updates: [] };
}
