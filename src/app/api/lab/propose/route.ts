import { askForJson, readJson } from "@/lib/ai/respond";
import { PANTRY } from "@/lib/lab/company";
import type { Objective, Proposal } from "@/lib/lab/types";

export const maxDuration = 15;
function fallback(idea: string): Proposal {
  const lower = idea.toLowerCase();
  const objective: Objective = /pay|premium|trial/.test(lower)
    ? "conversion"
    : /ad|revenue/.test(lower)
      ? "monetization"
      : /ingredient|finish|complete/.test(lower)
        ? "engagement"
        : "retention";
  const page = /saved|bookmark/.test(lower) ? "/saved" : "/recipes/[slug]";
  const files = Object.keys(PANTRY.codebase)
    .filter((file) =>
      page === "/saved" ? file.includes("saved") || file.includes("SaveButton") : file.includes("recipe/RecipeView"),
    )
    .slice(0, 2);
  return {
    id: `custom-${idea
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 32)}`,
    title: idea.slice(0, 72),
    objective,
    hypothesis: `If Pantry ${idea.toLowerCase()}, ${objective} will improve because the change removes friction at the moment it matters.`,
    why: "This is the closest match to Pantry’s current goals and evidence.",
    evidenceIds: objective === "conversion" ? ["e13", "e14"] : ["e1", "e4"],
    page,
    files: files.length ? files : ["src/components/recipe/RecipeView.tsx"],
    expectedLift: 0.04,
    confidence: "low",
    impactScore: 45,
    risk: "The standard objective guardrails apply.",
    treatment: idea,
    followUp: "Try the same idea with new cooks only.",
  };
}
export async function POST(request: Request) {
  let idea = "";
  try {
    const body = (await request.json()) as { idea?: unknown };
    idea = typeof body.idea === "string" ? body.idea.trim() : "";
  } catch {
    return Response.json({ error: "Send a JSON body with idea." }, { status: 400 });
  }
  if (!idea || idea.length > 1000) return Response.json({ error: "Idea must be 1–1,000 characters." }, { status: 400 });
  const base = fallback(idea);
  try {
    const prompt = `Pantry context: ${PANTRY.goals.join("; ")}. Code: ${Object.entries(PANTRY.codebase)
      .map(([f, d]) => `${f}: ${d}`)
      .join("; ")}. Evidence: ${PANTRY.evidence.map((e) => `${e.id}: ${e.title}`).join("; ")}.`;
    const call = askForJson(
      [
        "Turn the idea into one conservative product experiment for Pantry.",
        "objective is one of retention, engagement, monetization, conversion.",
        "evidenceIds and files must come from the lists given. expectedLift is a relative change between 0.01 and 0.2.",
        "Do not invent measured results.",
      ].join("\n"),
      `${prompt}\nIdea: ${idea}`,
      false,
      PROPOSAL_SCHEMA,
      "experiment",
    );
    const text = await Promise.race([
      call,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 12000)),
    ]);
    return Response.json(merge(base, readJson<Record<string, unknown>>(text)));
  } catch {
    return Response.json(base);
  }
}

const OBJECTIVES: Objective[] = ["retention", "engagement", "monetization", "conversion"];

const PROPOSAL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "objective", "hypothesis", "why", "treatment", "risk", "expectedLift", "evidenceIds", "files"],
  properties: {
    title: { type: "string" },
    objective: { type: "string", enum: OBJECTIVES },
    hypothesis: { type: "string" },
    why: { type: "string" },
    treatment: { type: "string" },
    risk: { type: "string" },
    expectedLift: { type: "number" },
    evidenceIds: { type: "array", items: { type: "string" } },
    files: { type: "array", items: { type: "string" } },
  },
};

/** Takes only known fields from the model, checked, so a bad answer can never break the engine. */
function merge(base: Proposal, model: Record<string, unknown>): Proposal {
  const text = (value: unknown, max: number, fallbackText: string) =>
    typeof value === "string" && value.trim() ? value.trim().slice(0, max) : fallbackText;
  const list = (value: unknown) =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  const objective = OBJECTIVES.find((item) => item === model.objective) ?? base.objective;
  const lift =
    typeof model.expectedLift === "number" && Number.isFinite(model.expectedLift)
      ? model.expectedLift
      : base.expectedLift;
  const evidenceIds = list(model.evidenceIds)
    .filter((id) => PANTRY.evidence.some((e) => e.id === id))
    .slice(0, 3);
  const files = list(model.files)
    .filter((file) => file in PANTRY.codebase)
    .slice(0, 3);
  return {
    ...base,
    objective,
    title: text(model.title, 90, base.title),
    hypothesis: text(model.hypothesis, 400, base.hypothesis),
    why: text(model.why, 400, base.why),
    treatment: text(model.treatment, 240, base.treatment),
    risk: text(model.risk, 240, base.risk),
    expectedLift: Math.min(0.2, Math.max(0.01, lift)),
    evidenceIds: evidenceIds.length ? evidenceIds : base.evidenceIds,
    files: files.length ? files : base.files,
  };
}
