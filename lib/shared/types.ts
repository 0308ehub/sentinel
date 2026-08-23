import { z } from "zod";

export const TUTOR_ACTIONS = [
  "CONNECT",
  "PROBE",
  "EXPLAIN",
  "GIVE_EXAMPLE",
  "ASK_CHILD_TO_EXPLAIN",
  "REINFORCE",
  "REVIEW",
  "ADVANCE",
  "CHANGE_REPRESENTATION",
] as const;

export const tutorActionSchema = z.enum(TUTOR_ACTIONS);
export type TutorAction = z.infer<typeof tutorActionSchema>;

/** A candidate belief the planner proposes about the child. */
export const hypothesisCandidateSchema = z.object({
  type: z.string(),
  description: z.string(),
  confidence: z.number().min(0).max(1),
  /** true = this turn supports it, false = this turn contradicts it */
  supported: z.boolean().default(true),
  conceptId: z.string().nullable().optional(),
});
export type HypothesisCandidate = z.infer<typeof hypothesisCandidateSchema>;

export const memoryUpdateSchema = z.object({
  type: z.enum([
    "INTEREST",
    "CONCEPT",
    "SKILL",
    "MISCONCEPTION",
    "REASONING_PATTERN",
    "TEACHING_STRATEGY",
    "EXPERIENCE",
    "GOAL",
    "CONVERSATION_MEMORY",
    "PERSON",
    "BOOK",
    "STORY",
  ]),
  label: z.string(),
  description: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1).default(0.5),
  importance: z.number().min(0).max(1).default(0.5),
  relationship: z
    .enum([
      "STRUGGLES_WITH",
      "MASTERED",
      "INTERESTED_IN",
      "RESPONDS_WELL_TO",
      "CONFUSES_WITH",
      "PREREQUISITE_OF",
      "EXPLAINED_BY",
      "IMPROVED_BY",
      "AVOIDS",
      "PREFERS",
      "RETAINED_AFTER",
      "CAUSED_BY",
    ])
    .nullable()
    .optional(),
  relatedLabel: z.string().nullable().optional(),
});
export type MemoryUpdate = z.infer<typeof memoryUpdateSchema>;

/** The planner's structured output contract (spec §27). */
export const plannerOutputSchema = z.object({
  observation: z.string().default(""),
  correctness: z.boolean().nullable().optional(),
  reasoning_pattern: z.string().nullable().optional(),
  reasoning_evidence: z.array(z.string()).default([]),
  updated_hypotheses: z.array(hypothesisCandidateSchema).default([]),
  next_action: tutorActionSchema,
  target: z.string().nullable().optional(),
  strategy: z.string().nullable().optional(),
  reason: z.string().default(""),
  response_goal: z.string().default("Continue the activity naturally."),
  /** Validated individually in the planner so one bad entry cannot discard the turn. */
  memory_updates: z.array(z.unknown()).default([]),
  /** Set only when the child has just chosen a name for their mentor. */
  mentor_name: z.string().max(30).nullable().optional(),
});
type RawPlannerOutput = z.infer<typeof plannerOutputSchema>;
export type PlannerOutput = Omit<RawPlannerOutput, "memory_updates"> & {
  memory_updates: MemoryUpdate[];
};

export interface SkillStateView {
  conceptId: string;
  label: string;
  masteryProbability: number;
  confidence: number;
  lastTestedAt: Date | null;
}

export interface HypothesisView {
  id: string;
  type: string;
  description: string;
  confidence: number;
  conceptId: string | null;
}

export interface MemoryView {
  id: string;
  type: string;
  label: string;
  description: string | null;
  confidence: number;
  importance: number;
  lastObservedAt: Date;
}

export interface StrategyView {
  strategy: string;
  attempts: number;
  successes: number;
  successRate: number;
}

/** The compact context passed to the planner each turn (spec §11, §26). */
export interface LearnerContext {
  childId: string;
  childName: string;
  /** Null until the child names their mentor. */
  mentorName: string | null;
  ageYears: number;
  gradeLabel: string | null;
  interests: string[];
  activeSkills: SkillStateView[];
  activeHypotheses: HypothesisView[];
  relevantMemories: MemoryView[];
  successfulStrategies: StrategyView[];
  recentTranscript: { role: string; content: string }[];
}

export interface TutorDecision {
  action: TutorAction;
  targetConcept: string | null;
  strategy: string | null;
  rationale: string;
  responseGoal: string;
}
