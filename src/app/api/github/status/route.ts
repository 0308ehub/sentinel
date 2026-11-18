import { currentUserId } from "@/lib/connections/current";
import { GitHubApiError, githubConnectionStatus, githubErrorResponse } from "@/lib/github/client";

export const maxDuration = 30;

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });
  try {
    return Response.json(await githubConnectionStatus(userId));
  } catch (error) {
    if (error instanceof GitHubApiError && (error.status === 401 || error.status === 503)) {
      return Response.json({ connected: false, hint: error.hint });
    }
    return githubErrorResponse(error);
  }
}
