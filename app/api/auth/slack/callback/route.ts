import { prisma } from "@/lib/db/prisma";
import { exchangeSlackCode } from "@/server/services/connectors/slack";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const stateRaw = searchParams.get("state");

  if (!code || !stateRaw) return new Response("Missing code or state", { status: 400 });

  let state: { workspaceId: string; userId: string };
  try {
    state = JSON.parse(Buffer.from(stateRaw, "base64url").toString());
  } catch {
    return new Response("Invalid state", { status: 400 });
  }

  try {
    const tokens = await exchangeSlackCode(code);

    const existing = await prisma.connector.findFirst({
      where: { workspaceId: state.workspaceId, type: "SLACK" },
    });

    if (existing) {
      await prisma.connector.update({
        where: { id: existing.id },
        data: { config: tokens as Record<string, string | string[]>, status: "ACTIVE", errorMessage: null },
      });
    } else {
      await prisma.connector.create({
        data: {
          workspaceId: state.workspaceId,
          type: "SLACK",
          name: `Slack (${tokens.teamName})`,
          config: tokens as Record<string, string | string[]>,
          status: "ACTIVE",
        },
      });
    }

    const connectorId = existing ? existing.id : (
      await prisma.connector.findFirst({ where: { workspaceId: state.workspaceId, type: "SLACK" } })
    )?.id ?? "";
    // Redirect to channel setup so the user can pick which channels to import
    return Response.redirect(
      new URL(
        `/workspaces/${state.workspaceId}/integrations?connected=slack&setup=${connectorId}`,
        process.env.NEXT_PUBLIC_APP_URL!
      )
    );
  } catch (err) {
    console.error("Slack OAuth error:", err);
    return Response.redirect(
      new URL(`/workspaces/${state.workspaceId}/integrations?error=slack`, process.env.NEXT_PUBLIC_APP_URL!)
    );
  }
}
