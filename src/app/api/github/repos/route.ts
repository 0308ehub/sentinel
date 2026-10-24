import { githubErrorResponse, listWritableRepos } from "@/lib/github/client";

export const maxDuration = 30;

export async function GET() {
  try {
    return Response.json({ repos: await listWritableRepos() });
  } catch (error) {
    return githubErrorResponse(error);
  }
}
