import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { currentUserId } from "@/lib/connections/current";

const SCOPES = [
  "channels:read",
  "channels:history",
  "groups:read",
  "groups:history",
  "users:read",
  "chat:write",
].join(",");

export async function GET(request: Request) {
  if (!(await currentUserId())) return Response.json({ error: "Sign in required." }, { status: 401 });

  const requestUrl = new URL(request.url);
  if (!process.env.SLACK_CLIENT_ID?.trim() || !process.env.SLACK_CLIENT_SECRET?.trim()) {
    return NextResponse.redirect(new URL("/settings/connectors/slack?error=not_configured", requestUrl.origin));
  }

  const redirectUri = process.env.SLACK_REDIRECT_URI?.trim()
    || `${requestUrl.origin}/api/slack/oauth/callback`;
  const state = randomBytes(32).toString("base64url");
  const authorize = new URL("https://slack.com/oauth/v2/authorize");
  authorize.searchParams.set("client_id", process.env.SLACK_CLIENT_ID.trim());
  authorize.searchParams.set("scope", SCOPES);
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("state", state);

  const response = NextResponse.redirect(authorize);
  response.headers.append(
    "Set-Cookie",
    `kismet_slack_state=${encodeURIComponent(state)}; HttpOnly; Path=/; Max-Age=600; SameSite=Lax${requestUrl.protocol === "https:" ? "; Secure" : ""}`,
  );
  return response;
}
