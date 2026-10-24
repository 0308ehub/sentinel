import { createFeatureIssue, jiraErrorResponse, listRecentIssues } from "@/lib/jira/client";

export async function GET(request: Request) {
  const limit = Number(new URL(request.url).searchParams.get("limit") ?? "20");
  try {
    const issues = await listRecentIssues(Number.isFinite(limit) ? limit : 20);
    return Response.json({ issues });
  } catch (error) {
    return jiraErrorResponse(error);
  }
}

export async function POST(request: Request) {
  let title = "";
  let description = "";
  try {
    const body = (await request.json()) as { title?: string; description?: string };
    title = typeof body.title === "string" ? body.title.trim().slice(0, 240) : "";
    description = typeof body.description === "string" ? body.description.trim().slice(0, 8000) : "";
  } catch {
    return Response.json({ error: "Send a JSON body with title." }, { status: 400 });
  }
  if (!title) return Response.json({ error: "The feature needs a title." }, { status: 400 });

  try {
    return Response.json(await createFeatureIssue({ title, description: description || title }));
  } catch (error) {
    return jiraErrorResponse(error);
  }
}
