import { currentUserId } from "@/lib/connections/current";
import { githubAppConfigured } from "@/lib/github/app";

export async function GET() {
  if (!(await currentUserId())) return Response.json({ error: "Sign in required." }, { status: 401 });
  return Response.json({ available: githubAppConfigured() });
}
