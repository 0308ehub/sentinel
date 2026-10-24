import { GitHubApiError, githubAccount, githubErrorResponse } from "@/lib/github/client";

export const maxDuration = 30;

export async function GET() {
  try {
    const account = await githubAccount();
    return Response.json({ connected: true, login: account.login });
  } catch (error) {
    if (error instanceof GitHubApiError && (error.status === 401 || error.status === 503)) {
      return Response.json({ connected: false, hint: error.hint });
    }
    return githubErrorResponse(error);
  }
}
