import { labDemoEnabled } from "@/lib/lab/demo-mode";
import { askForJson, readJson } from "@/lib/ai/respond";
import type { Design, Readout } from "@/lib/lab/types";
export const maxDuration = 15;
const MAX_BODY = 60_000;
export async function POST(request: Request) {
  if (!labDemoEnabled()) return Response.json({ error: "Not found." }, { status: 404 });
  let body: { readout?: Readout; design?: Design };
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY) return Response.json({ error: "Request is too large." }, { status: 413 });
    body = JSON.parse(raw) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }
  if (!body.readout?.headline || !Array.isArray(body.readout.summary) || !body.design?.proposalId)
    return Response.json({ error: "Readout and design are required." }, { status: 400 });
  const fallback = { headline: body.readout.headline, paragraphs: body.readout.summary, by: "rules" };
  try {
    const call = askForJson(
      "Explain this experiment result in short, plain English. Return headline and paragraphs. Do not overclaim.",
      JSON.stringify(body),
      false,
      {
        type: "object",
        additionalProperties: false,
        required: ["headline", "paragraphs"],
        properties: { headline: { type: "string" }, paragraphs: { type: "array", items: { type: "string" } } },
      },
      "experiment",
    );
    const text = await Promise.race([
      call,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 12000)),
    ]);
    const value = readJson<{ headline?: unknown; paragraphs?: unknown }>(text);
    const paragraphs = Array.isArray(value.paragraphs)
      ? value.paragraphs.filter((item): item is string => typeof item === "string").slice(0, 6)
      : [];
    if (typeof value.headline !== "string" || !paragraphs.length) return Response.json(fallback);
    return Response.json({ headline: value.headline.slice(0, 200), paragraphs, by: "model" });
  } catch {
    return Response.json(fallback);
  }
}
