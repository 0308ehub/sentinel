import { errorStatus, ModelError } from "@/lib/ai/orchestrate";
import { githubErrorResponse, isUiPath, repoName } from "@/lib/github/client";
import { shipExperimentPullRequest } from "@/lib/github/ship-experiment";

export const maxDuration = 120;

export async function POST(request: Request) {
  let repo = "";
  let title = "";
  let hypothesis = "";
  let metric = "";
  let control = "";
  let treatment = "";
  let guardrail = "";
  let path = "";
  let design = "";
  try {
    const body = (await request.json()) as Record<string, unknown>;
    repo = typeof body.repo === "string" ? body.repo.trim() : "";
    title = typeof body.title === "string" ? body.title.trim().slice(0, 160) : "";
    hypothesis = typeof body.hypothesis === "string" ? body.hypothesis.trim().slice(0, 1000) : "";
    metric = typeof body.metric === "string" ? body.metric.trim().slice(0, 400) : "";
    control = typeof body.control === "string" ? body.control.trim().slice(0, 800) : "";
    treatment = typeof body.treatment === "string" ? body.treatment.trim().slice(0, 800) : "";
    guardrail = typeof body.guardrail === "string" ? body.guardrail.trim().slice(0, 400) : "";
    path = typeof body.path === "string" && isUiPath(body.path) ? body.path : "";
    design = typeof body.design === "string" ? body.design.trim().slice(0, 4000) : "";
  } catch {
    return Response.json({ error: "Send the experiment and a repository." }, { status: 400 });
  }
  if (!repoName(repo)) return Response.json({ error: "Choose a repository like owner/name." }, { status: 400 });
  if (!title) return Response.json({ error: "The experiment needs a title." }, { status: 400 });

  try {
    const pull = await shipExperimentPullRequest(repo, { title, hypothesis, metric, control, treatment, guardrail, path, design });
    return Response.json(pull);
  } catch (error) {
    if (error instanceof ModelError) return Response.json({ error: error.message }, { status: errorStatus(error) });
    return githubErrorResponse(error);
  }
}
