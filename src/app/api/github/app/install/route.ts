import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/connections/current";
import { githubAppConfigured } from "@/lib/github/app";
import { githubAppInstallUrl, githubAuthorizeUrl } from "@/lib/github/app-core";
import { validOAuthReturnPath } from "@/lib/slack/oauth-return";

export async function GET(request: Request) {
  if (!(await currentUserId())) return Response.json({ error: "Sign in required." }, { status: 401 });
  const requestUrl = new URL(request.url);
  if (!githubAppConfigured()) {
    return NextResponse.redirect(new URL("/settings/connectors/github?error=not_configured", requestUrl.origin));
  }
  const state = randomBytes(32).toString("base64url");
  const returnPath = requestUrl.searchParams.get("return");
  const popup = requestUrl.searchParams.get("popup") === "1";
  // Like Vercel: by default ask GitHub who this is first. The callback connects every installation they
  // can already reach and only sends them on to the install page when there are none.
  // target=install goes straight to GitHub's install/configure page (used to add repositories).
  const destination = requestUrl.searchParams.get("target") === "install"
    ? githubAppInstallUrl(process.env.GITHUB_APP_SLUG!.trim(), state)
    : githubAuthorizeUrl(process.env.GITHUB_APP_CLIENT_ID!.trim(), state, `${requestUrl.origin}/api/github/app/callback`);
  const response = NextResponse.redirect(destination);
  const secure = requestUrl.protocol === "https:" ? "; Secure" : "";
  response.headers.append(
    "Set-Cookie",
    `kismet_github_state=${encodeURIComponent(state)}; HttpOnly; Path=/; Max-Age=600; SameSite=Lax${secure}`,
  );
  if (validOAuthReturnPath(returnPath)) {
    response.headers.append(
      "Set-Cookie",
      `kismet_github_return=${encodeURIComponent(returnPath)}; HttpOnly; Path=/; Max-Age=600; SameSite=Lax${secure}`,
    );
  } else {
    response.headers.append("Set-Cookie", "kismet_github_return=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax");
  }
  if (popup) {
    response.headers.append(
      "Set-Cookie",
      `kismet_github_popup=1; HttpOnly; Path=/; Max-Age=600; SameSite=Lax${secure}`,
    );
  } else {
    response.headers.append("Set-Cookie", "kismet_github_popup=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax");
  }
  return response;
}
