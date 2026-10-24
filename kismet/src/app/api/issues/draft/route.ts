import { askForJson, readJson } from "@/lib/ai/respond";

export const maxDuration = 60;

const PLATFORMS = new Set(["Web", "iOS", "Android", "Backend"]);

interface DraftBody {
  title?: string;
  repro?: string;
  platform?: string;
}

export async function POST(request: Request) {
  let note = "";
  let page = "";
  try {
    const body = (await request.json()) as { note?: string; page?: string };
    note = typeof body.note === "string" ? body.note.trim().slice(0, 4000) : "";
    page = typeof body.page === "string" ? body.page.trim().slice(0, 6000) : "";
  } catch {
    return Response.json({ error: "Send a JSON body with note." }, { status: 400 });
  }
  if (!note && !page) return Response.json({ error: "Describe the bug first." }, { status: 400 });

  try {
    const text = await askForJson(
      [
        "Turn a note from someone using the product into one bug report.",
        "Use only the note and the page context. Do not invent steps, screens, or errors that are not there.",
        "Return JSON only with keys title, repro, platform.",
        "title is a short defect name. repro is the steps or what they saw, as plain lines.",
        "platform is one of Web, iOS, Android, Backend.",
      ].join(" "),
      `Note:\n${note || "Use the page context."}\n\nPage context:\n${page || "No page context."}`,
      false,
      undefined,
      "feature-draft",
    );
    const parsed = readJson<DraftBody>(text);
    const title = parsed.title?.trim();
    if (!title) return Response.json({ error: "The draft had no title." }, { status: 502 });
    return Response.json({
      title,
      repro: parsed.repro?.trim() || note,
      platform: PLATFORMS.has(parsed.platform ?? "") ? parsed.platform : "Web",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not draft the bug.";
    return Response.json({ error: message }, { status: 502 });
  }
}
