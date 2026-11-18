import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/connections/current";
import { getConnection, saveConnection } from "@/lib/connections/store";
import { githubAppConfigured } from "@/lib/github/app";
import { githubPopupHtml, githubStateMatches, normalizeGitHubInstallations } from "@/lib/github/app-core";

type GitHubSecret = Parameters<typeof normalizeGitHubInstallations>[0];
import { validOAuthReturnPath } from "@/lib/slack/oauth-return";

interface OAuthTokenResponse {
  access_token?: string;
  error?: string;
}

interface InstallationRow {
  id?: number;
  account?: { login?: string } | null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const returnPath = readCookie(request.headers.get("cookie"), "kismet_github_return");
  const popup = readCookie(request.headers.get("cookie"), "kismet_github_popup") === "1";
  const defaultPath = "/settings/connectors/github";
  const destination = (path = validOAuthReturnPath(returnPath) ? returnPath : defaultPath) => new URL(path, url.origin);
  const finish = (params: Record<string, string>, path?: string) => {
    const status = params.connected ? "connected" : params.pending ? "pending" : "error";
    const error = params.error;
    if (popup) {
      const response = new Response(githubPopupHtml(status, error), {
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
      });
      clearCookies(response);
      return response;
    }
    const target = destination(path);
    for (const [key, value] of Object.entries(params)) target.searchParams.set(key, value);
    const response = NextResponse.redirect(target);
    clearCookies(response);
    return response;
  };
  const fail = (code: string, cause?: unknown) => {
    console.error("[github] app callback", code, cause);
    return finish({ error: code }, defaultPath);
  };

  const userId = await currentUserId();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });
  // Adding or removing repos on an installation this account already has can come back without a code.
  // Nothing is saved in that case (repos are read live), so it only needs to be an installation we know.
  if (url.searchParams.get("setup_action") === "update" && !url.searchParams.get("code")) {
    const known = normalizeGitHubInstallations((await getConnection<GitHubSecret>(userId, "github"))?.secret ?? {});
    const updated = Number(url.searchParams.get("installation_id"));
    return known.some((item) => item.id === updated) ? finish({ connected: "1" }) : fail("invalid_callback");
  }
  const state = url.searchParams.get("state");
  const stateCookie = readCookie(request.headers.get("cookie"), "kismet_github_state");
  if (!githubStateMatches(stateCookie, state)) return fail("state");
  if (url.searchParams.get("setup_action") === "request") return finish({ pending: "1" });
  if (!githubAppConfigured()) return fail("not_configured");

  const code = url.searchParams.get("code");
  const installationValue = url.searchParams.get("installation_id");
  const installationId = installationValue ? Number(installationValue) : undefined;
  if (!code || (installationId !== undefined && (!Number.isSafeInteger(installationId) || installationId <= 0))) {
    return fail("invalid_callback");
  }

  try {
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GITHUB_APP_CLIENT_ID!.trim(),
        client_secret: process.env.GITHUB_APP_CLIENT_SECRET!.trim(),
        code,
      }),
      cache: "no-store",
    });
    const tokenBody = (await tokenResponse.json()) as OAuthTokenResponse;
    if (!tokenResponse.ok || !tokenBody.access_token) throw new Error(tokenBody.error || "oauth_exchange_failed");
    const headers = {
      Authorization: `Bearer ${tokenBody.access_token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "kismet",
    };
    const [installationRows, userResponse] = await Promise.all([
      listUserInstallations(headers),
      fetch("https://api.github.com/user", { headers, cache: "no-store" }),
    ]);
    const userBody = (await userResponse.json()) as { login?: string };
    if (!userResponse.ok || !userBody.login) throw new Error("github_identity_failed");
    if (installationId !== undefined && !installationRows.some((item) => item.id === installationId)) {
      throw new Error("installation_not_owned");
    }
    const installations = installationRows.flatMap((item) =>
      typeof item.id === "number" && item.account?.login ? [{ id: item.id, account: item.account.login }] : [],
    );
    if (!installations.length) throw new Error("installation_account_missing");
    await saveConnection(
      userId,
      "github",
      { installations },
      { login: userBody.login, accounts: installations.map((item) => item.account), via: "app" },
    );
    return finish({ connected: "1" });
  } catch (error) {
    return fail("connect_failed", error);
  }
}

async function listUserInstallations(headers: Record<string, string>): Promise<InstallationRow[]> {
  const rows: InstallationRow[] = [];
  for (let page = 1; ; page += 1) {
    const response = await fetch(`https://api.github.com/user/installations?per_page=100&page=${page}`, {
      headers,
      cache: "no-store",
    });
    const body = (await response.json()) as { installations?: InstallationRow[] };
    if (!response.ok) throw new Error("github_installations_failed");
    const pageRows = body.installations ?? [];
    rows.push(...pageRows);
    if (pageRows.length < 100) return rows;
  }
}

function clearCookies(response: Response): void {
  for (const name of ["kismet_github_state", "kismet_github_return", "kismet_github_popup"]) {
    response.headers.append("Set-Cookie", `${name}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`);
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
