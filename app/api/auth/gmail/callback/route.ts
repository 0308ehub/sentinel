import { prisma } from "@/lib/db/prisma";
import { exchangeCode } from "@/server/services/connectors/gmail";

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
    const tokens = await exchangeCode(code);

    // Upsert connector
    const existing = await prisma.connector.findFirst({
      where: { workspaceId: state.workspaceId, type: "GMAIL" },
    });

    if (existing) {
      await prisma.connector.update({
        where: { id: existing.id },
        data: { config: tokens as Record<string, string | number>, status: "ACTIVE", errorMessage: null },
      });
    } else {
      await prisma.connector.create({
        data: {
          workspaceId: state.workspaceId,
          type: "GMAIL",
          name: `Gmail (${tokens.email})`,
          config: tokens as Record<string, string | number>,
          status: "ACTIVE",
        },
      });
    }

    return Response.redirect(
      new URL(`/workspaces/${state.workspaceId}/integrations?connected=gmail`, process.env.NEXT_PUBLIC_APP_URL!)
    );
  } catch (err) {
    console.error("Gmail OAuth error:", err);
    return Response.redirect(
      new URL(`/workspaces/${state.workspaceId}/integrations?error=gmail`, process.env.NEXT_PUBLIC_APP_URL!)
    );
  }
}
