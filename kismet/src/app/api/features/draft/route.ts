import { askForJson, readJson, sourceBrief } from "@/lib/ai/respond";

export const maxDuration = 120;

interface DraftBody {
  title?: string;
  description?: string;
  problem?: string;
  priority?: string;
  prd?: string;
  goal?: string;
  metric?: string;
}

const PRIORITIES = new Set(["CRITICAL", "HIGH", "MEDIUM", "LOW"]);

export async function POST(request: Request) {
  let prompt = "";
  try {
    const body = (await request.json()) as { prompt?: string };
    prompt = typeof body.prompt === "string" ? body.prompt.trim().slice(0, 4000) : "";
  } catch {
    return Response.json({ error: "Send a JSON body with prompt." }, { status: 400 });
  }
  if (!prompt) return Response.json({ error: "Describe the feature first." }, { status: 400 });

  try {
    const sources = await sourceBrief();
    const text = await askForJson(
      [
        "You turn a product note into one feature request.",
        "Use the company sources when they are relevant. Do not invent a metric or a quote that is not in the sources.",
        "If the sources include Databricks and the note depends on a number, call query_databricks once, then finish.",
        "Return JSON only, with keys title, description, problem, priority, prd, goal, metric.",
        "priority is one of CRITICAL, HIGH, MEDIUM, LOW.",
        "description is two or three sentences. prd is a short requirements note. goal is the outcome. metric is how to know it worked.",
        sources,
      ]
        .filter(Boolean)
        .join("\n\n"),
      prompt,
      sources.includes("Databricks warehouse"),
      undefined,
      "feature-draft"
    );
    const parsed = readJson<DraftBody>(text);
    const title = parsed.title?.trim();
    if (!title) return Response.json({ error: "The draft had no title." }, { status: 502 });
    const priority = PRIORITIES.has(parsed.priority ?? "") ? parsed.priority : "MEDIUM";
    return Response.json({
      title,
      description: parsed.description?.trim() || prompt,
      problem: parsed.problem?.trim() || "",
      priority,
      prd: parsed.prd?.trim() || "",
      goal: parsed.goal?.trim() || "",
      metric: parsed.metric?.trim() || "",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not draft the feature.";
    return Response.json({ error: message }, { status: 502 });
  }
}
