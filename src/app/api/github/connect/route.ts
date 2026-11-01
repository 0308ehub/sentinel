import { currentUserId } from "@/lib/connections/current";
import { saveConnection } from "@/lib/connections/store";
import { githubAccount } from "@/lib/github/client";
import { connectErrorMessage } from "@/lib/connections/errors";

export async function POST(request: Request) {
  const userId = await currentUserId();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });

  try {
    const body = (await request.json()) as { token?: unknown };
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!token) throw new Error("Token is required.");

    const account = await githubAccount(token);
    await saveConnection(userId, "github", { token }, { login: account.login });
    return Response.json({ connected: true, login: account.login });
  } catch (error) {
    return Response.json({ error: connectErrorMessage(error, "Could not connect GitHub.") }, { status: 400 });
  }
}
