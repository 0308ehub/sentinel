import { auth } from "@clerk/nextjs/server";
import { getSlackAuthUrl } from "@/server/services/connectors/slack";

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.redirect(new URL("/sign-in", req.url));

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get("workspaceId");
  if (!workspaceId) return new Response("Missing workspaceId", { status: 400 });

  const state = Buffer.from(JSON.stringify({ workspaceId, userId })).toString("base64url");
  return Response.redirect(getSlackAuthUrl(state));
}
