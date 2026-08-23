import { CONCEPTS } from "./concepts";

export interface PrerequisiteEdge {
  sourceId: string;
  targetId: string;
}

/** source is a prerequisite of target. */
export const PREREQUISITE_EDGES: PrerequisiteEdge[] = [
  // Math spine
  { sourceId: "counting_to_20", targetId: "number_magnitude" },
  { sourceId: "number_magnitude", targetId: "addition_within_10" },
  { sourceId: "addition_within_10", targetId: "subtraction_within_10" },
  { sourceId: "subtraction_within_10", targetId: "addition_within_20" },
  { sourceId: "addition_within_20", targetId: "subtraction_within_20" },
  { sourceId: "subtraction_within_20", targetId: "cross_ten_subtraction" },
  { sourceId: "cross_ten_subtraction", targetId: "place_value_tens_ones" },
  // Making ten underpins crossing ten
  { sourceId: "addition_within_20", targetId: "cross_ten_subtraction" },

  // Reading spine
  { sourceId: "letter_recognition", targetId: "phonemic_awareness" },
  { sourceId: "phonemic_awareness", targetId: "cvc_decoding" },
  { sourceId: "cvc_decoding", targetId: "sight_words" },
  { sourceId: "sight_words", targetId: "sentence_comprehension" },
  { sourceId: "cvc_decoding", targetId: "sentence_comprehension" },

  // Reasoning spine
  { sourceId: "evidence_giving", targetId: "counterexample_finding" },
  { sourceId: "counterexample_finding", targetId: "belief_updating" },
  { sourceId: "counterexample_finding", targetId: "categorical_claims" },
  { sourceId: "evidence_giving", targetId: "explanation_quality" },
];

const CONCEPT_IDS = new Set(CONCEPTS.map((c) => c.id));

/** Guards against typos in the edge list at module load. */
for (const edge of PREREQUISITE_EDGES) {
  if (!CONCEPT_IDS.has(edge.sourceId) || !CONCEPT_IDS.has(edge.targetId)) {
    throw new Error(`Unknown concept in prerequisite edge: ${edge.sourceId} -> ${edge.targetId}`);
  }
}

export function getPrerequisites(conceptId: string): string[] {
  return PREREQUISITE_EDGES.filter((e) => e.targetId === conceptId).map((e) => e.sourceId);
}

export function getNextConcepts(conceptId: string): string[] {
  return PREREQUISITE_EDGES.filter((e) => e.sourceId === conceptId).map((e) => e.targetId);
}

/** Concepts whose prerequisites are all mastered, and which are not themselves mastered. */
export function getUnlockedConcepts(masteredIds: string[]): string[] {
  const mastered = new Set(masteredIds);
  return CONCEPTS.filter((c) => !mastered.has(c.id))
    .filter((c) => getPrerequisites(c.id).every((p) => mastered.has(p)))
    .sort((a, b) => a.sequence - b.sequence)
    .map((c) => c.id);
}

export function getConcept(conceptId: string) {
  return CONCEPTS.find((c) => c.id === conceptId);
}
