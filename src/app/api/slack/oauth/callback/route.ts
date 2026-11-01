import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/connections/current";
import { saveConnection } from "@/lib/connections/store";

interface SlackOAuthResponse {
  ok: boolean;
  error?: string;
  access_token?: string;
  bot_user_id?: string;
  team?: { id?: string; name?: string };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const destination = new URL("/settings/connectors/slack", url.origin);
  const finish = (error?: string, connected = false) => {
    if (error) destination.searchParams.set("error", error);
    if (connected) destination.searchParams.set("connected", "1");
    const response = NextResponse.redirect(destination);
    response.headers.append("Set-Cookie", "kismet_slack_state=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax");
    return response;
  };

  const userId = await currentUserId();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });
  const oauthError = url.searchParams.get("error");
  if (oauthError) return finish(oauthError);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookie = readCookie(request.headers.get("cookie"), "kismet_slack_state");
  if (!code || !state || !cookie || state !== cookie) return finish("state");

  const clientId = process.env.SLACK_CLIENT_ID?.trim();
  const clientSecret = process.env.SLACK_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return finish("not_configured");
  const redirectUri = process.env.SLACK_REDIRECT_URI?.trim()
    || `${url.origin}/api/slack/oauth/callback`;

  try {
    const response = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
      cache: "no-store",
    });
    const result = (await response.json()) as SlackOAuthResponse;
    if (!result.ok || !result.access_token) return finish(result.error || "connect_failed");
    await saveConnection(
      userId,
      "slack",
      { botToken: result.access_token },
      {
        teamId: result.team?.id,
        teamName: result.team?.name,
        botUserId: result.bot_user_id,
      },
    );
    return finish(undefined, true);
  } catch {
    return finish("connect_failed");
  }
}

function readCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}
