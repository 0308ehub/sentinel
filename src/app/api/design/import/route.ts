import { errorStatus } from "@/lib/ai/orchestrate";
import { GitHubApiError, githubErrorResponse, isUiPath, readFile, repoDefaultBranch, repoName } from "@/lib/github/client";
import { layoutFromCode } from "@/lib/design/from-code";
import { newId, screenWith } from "@/lib/design/scene";
import { connectFigma, FigmaApiError, importFigma } from "@/lib/figma/client";

export const maxDuration = 60;

export async function POST(request: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Send a screen to import." }, { status: 400 });
  }
  if (body.source === "figma") return importFrame(body);
  if (body.source === "app") return importApp(body);
  return Response.json({ error: "Choose your app or a Figma file." }, { status: 400 });
}

async function importApp(body: Record<string, unknown>) {
  const repo = text(body.repo, 140);
  const path = text(body.path, 220);
  if (!repoName(repo)) return Response.json({ error: "Choose a repository like owner/name." }, { status: 400 });
  if (!isUiPath(path)) return Response.json({ error: "Choose a page or component file." }, { status: 400 });
  try {
    const branch = await repoDefaultBranch(repo);
    const file = await readFile(repo, path, branch);
    if (!file) return Response.json({ error: "That file is missing or too large to place on the canvas." }, { status: 422 });
    const layout = await layoutFromCode(file.path, file.content);
    const screen = screenWith(layout, {
      id: newId("screen"),
      source: "app",
      sourceLabel: `${repo} · ${path}`,
      repo,
      path,
    });
    return Response.json({ screen });
  } catch (error) {
    return githubErrorResponse(error);
  }
}

async function importFrame(body: Record<string, unknown>) {
  const url = text(body.url, 500);
  const nodeId = text(body.nodeId, 80);
  const token = text(body.token, 200);
  try {
    let saved: boolean | undefined;
    if (token) saved = (await connectFigma(token)).saved;
    const result = await importFigma(url, nodeId, token);
    if ("frames" in result) return Response.json({ file: result.file, frames: result.frames, saved });
    const screen = screenWith(result.layout, {
      id: newId("screen"),
      source: "figma",
      sourceLabel: `${result.file} · ${result.frame}`,
      figmaUrl: result.url,
    });
    return Response.json({ screen, saved });
  } catch (error) {
    if (error instanceof FigmaApiError) return Response.json({ error: error.hint }, { status: error.status });
    if (error instanceof GitHubApiError) return githubErrorResponse(error);
    const message = error instanceof Error ? error.message : "Could not import that frame.";
    return Response.json({ error: message }, { status: errorStatus(error) });
  }
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
