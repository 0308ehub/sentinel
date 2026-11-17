import { chosenAutopilotRepo } from "@/lib/autopilot/repo";
import { withAutopilotUser } from "@/lib/autopilot/scope";
import { coderConfigured } from "@/lib/coder/sessions";
import { currentUserId } from "@/lib/connections/current";
import { getConnection } from "@/lib/connections/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });
  try {
    const [connection, repo] = await Promise.all([
      getConnection<{ token?: unknown }>(userId, "github"),
      withAutopilotUser(userId, chosenAutopilotRepo),
    ]);
    return Response.json({
      configured: coderConfigured(),
      repo,
      github: typeof connection?.secret.token === "string" && Boolean(connection.secret.token.trim()),
    });
  } catch (error) {
    console.error("[coder] status", error);
    return Response.json({ error: "Could not load Code mode status." }, { status: 500 });
  }
}
