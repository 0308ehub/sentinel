import { askForJson, readJson } from "@/lib/ai/respond";

export const maxDuration = 60;

interface DraftBody {
  title?: string;
  hypothesis?: string;
  metric?: string;
  control?: string;
  treatment?: string;
  guardrail?: string;
}

export async function POST(request: Request) {
  let prompt = "";
  try {
    const body = (await request.json()) as { prompt?: string };
    prompt = typeof body.prompt === "string" ? body.prompt.trim().slice(0, 4000) : "";
  } catch {
    return Response.json({ error: "Send a JSON body with prompt." }, { status: 400 });
  }
  if (!prompt) return Response.json({ error: "Describe the experiment first." }, { status: 400 });

  try {
    const text = await askForJson(
      [
        "Turn a product note into one experiment a PM can ship.",
        "Return JSON with title, hypothesis, metric, control, treatment, and guardrail.",
        "hypothesis is one sentence. metric is the one number that decides the experiment.",
        "control is what users get today. treatment is the change. guardrail is the metric that must not get worse.",
        "Do not invent a measured result.",
      ].join("\n"),
      prompt,
      false,
      {
        type: "object",
        additionalProperties: false,
        required: ["title", "hypothesis", "metric", "control", "treatment", "guardrail"],
        properties: {
          title: { type: "string" },
          hypothesis: { type: "string" },
          metric: { type: "string" },
          control: { type: "string" },
          treatment: { type: "string" },
          guardrail: { type: "string" },
        },
      },
      "experiment"
    );
    const parsed = readJson<DraftBody>(text);
    const title = parsed.title?.trim();
    if (!title) return Response.json({ error: "The draft had no title." }, { status: 502 });
    return Response.json({
      title,
      hypothesis: parsed.hypothesis?.trim() || prompt,
      metric: parsed.metric?.trim() || "",
      control: parsed.control?.trim() || "Current experience",
      treatment: parsed.treatment?.trim() || "",
      guardrail: parsed.guardrail?.trim() || "",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not draft the experiment.";
    return Response.json({ error: message }, { status: 502 });
  }
}
