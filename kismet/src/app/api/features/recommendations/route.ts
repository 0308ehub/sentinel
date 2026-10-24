import { askForJson, readJson, sourceBrief } from "@/lib/ai/respond";

export const maxDuration = 120;

interface Recommendation {
  title?: string;
  description?: string;
  problem?: string;
  priority?: string;
  why?: string;
  prd?: string;
  goal?: string;
  metric?: string;
}

const PRIORITIES = new Set(["CRITICAL", "HIGH", "MEDIUM", "LOW"]);

const store = globalThis as unknown as {
  kismetFeatureRecommendations?: { at: number; recommendations: Recommendation[] };
};
let cache = store.kismetFeatureRecommendations ?? null;
if (cache && cache.recommendations.length === 0) cache = null;

export async function GET() {
  try {
    const sources = await sourceBrief();
    if (!sources.trim()) {
      return Response.json({ recommendations: [], error: "Connect Slack, Jira, or Databricks first." });
    }
    if (cache && Date.now() - cache.at < 10 * 60_000) {
      return Response.json({ recommendations: cache.recommendations });
    }
    const text = await askForJson(
      [
        "Propose three product features for this company.",
        "Read the Slack excerpts, Jira issues, and Databricks tables below. Call query_databricks when a recommendation depends on a number.",
        "Each recommendation needs evidence from those sources. Do not invent a metric or a quote.",
        "Return JSON only: {\"recommendations\":[{\"title\",\"description\",\"problem\",\"priority\",\"why\",\"prd\",\"goal\",\"metric\"}]}",
        "priority is one of CRITICAL, HIGH, MEDIUM, LOW. why names the Slack channel, Jira key, or table.",
        sources,
      ].join("\n\n"),
      "What should this product build next?",
      sources.includes("Databricks warehouse"),
      {
        type: "object",
        properties: {
          recommendations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                description: { type: "string" },
                problem: { type: "string" },
                priority: { type: "string" },
                why: { type: "string" },
                prd: { type: "string" },
                goal: { type: "string" },
                metric: { type: "string" },
              },
              required: ["title", "description", "problem", "priority", "why", "prd", "goal", "metric"],
              additionalProperties: false,
            },
          },
        },
        required: ["recommendations"],
        additionalProperties: false,
      },
      "recommendations"
    );
    const parsed = readJson<Record<string, unknown>>(text);
    const recommendations = collectRecommendations(parsed).slice(0, 3);
    if (recommendations.length === 0) {
      return Response.json({ recommendations: [], error: "No recommendations came back. Refresh to try again." });
    }
    cache = { at: Date.now(), recommendations };
    store.kismetFeatureRecommendations = cache;
    return Response.json({ recommendations });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not propose features.";
    return Response.json({ recommendations: [], error: message }, { status: 502 });
  }
}

function collectRecommendations(parsed: Record<string, unknown>) {
  const arrays = [parsed.recommendations, parsed.features, parsed.items, parsed.secondary_recommendations].filter(
    Array.isArray
  ) as unknown[][];
  const values = [...arrays.flat(), parsed.recommendation].filter((item) => item != null);
  const sharedWhy = textValue(parsed.why);
  const sharedDescription = textValue(parsed.product_concept);
  const seen = new Set<string>();
  const recommendations = [];
  for (const value of values) {
    const item = asRecommendation(value, sharedWhy, sharedDescription);
    if (!item || seen.has(item.title)) continue;
    seen.add(item.title);
    recommendations.push(item);
  }
  return recommendations;
}

function asRecommendation(value: unknown, sharedWhy: string, sharedDescription: string) {
  if (typeof value === "string") {
    const title = value.trim();
    if (!title) return null;
    return draft(title, sharedDescription, "", "MEDIUM", sharedWhy, "", "", "");
  }
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const fallback = Object.values(record).find((item): item is string => typeof item === "string" && item.trim().length > 0);
  const title =
    textValue(record.title) ||
    textValue(record.recommendation) ||
    textValue(record.name) ||
    textValue(record.feature) ||
    textValue(record.summary) ||
    fallback ||
    "";
  if (!title) return null;
  const priority = textValue(record.priority).toUpperCase();
  return draft(
    title,
    textValue(record.description) || textValue(record.product_concept) || sharedDescription,
    textValue(record.problem),
    PRIORITIES.has(priority) ? priority : "MEDIUM",
    textValue(record.why) || sharedWhy,
    textValue(record.prd),
    textValue(record.goal),
    textValue(record.metric)
  );
}

function draft(
  title: string,
  description: string,
  problem: string,
  priority: string,
  why: string,
  prd: string,
  goal: string,
  metric: string
) {
  return { title, description, problem, priority, why, prd, goal, metric };
}

function textValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
