import { createGmailDraft } from "@/lib/google/client";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { to?: string; subject?: string; body?: string } | null;
  if (!body) return Response.json({ error: "Send a recipient, subject, and body." }, { status: 400 });
  try {
    const draft = await createGmailDraft({
      to: body.to ?? "",
      subject: body.subject ?? "",
      body: body.body ?? "",
    });
    return Response.json({ id: draft.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save the draft.";
    return Response.json({ error: message }, { status: 502 });
  }
}
