import { githubErrorResponse, listUiFiles, repoDefaultBranch, repoName } from "@/lib/github/client";

export const maxDuration = 30;

export async function GET(request: Request) {
  const repo = new URL(request.url).searchParams.get("repo")?.trim() ?? "";
  if (!repoName(repo)) return Response.json({ error: "Choose a repository like owner/name." }, { status: 400 });
  try {
    const branch = await repoDefaultBranch(repo);
    const files = await listUiFiles(repo, branch, 40);
    return Response.json({ branch, files });
  } catch (error) {
    return githubErrorResponse(error);
  }
}
