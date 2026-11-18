import "server-only";

import { getConnection } from "@/lib/connections/store";
import { chooseGitHubInstallation, createAppJwt, normalizeGitHubInstallations, normalizePrivateKey } from "@/lib/github/app-core";
import { GitHubApiError } from "@/lib/github/errors";

const API = "https://api.github.com";
const tokenCache = new Map<number, { token: string; expiresAt: number }>();

interface GitHubSecret {
  installationId?: unknown;
  installations?: unknown;
  token?: unknown;
}

export function githubAppConfigured(): boolean {
  return [
    process.env.GITHUB_APP_ID,
    process.env.GITHUB_APP_SLUG,
    process.env.GITHUB_APP_PRIVATE_KEY,
    process.env.GITHUB_APP_CLIENT_ID,
    process.env.GITHUB_APP_CLIENT_SECRET,
  ].every((value) => Boolean(value?.trim()));
}

export function appJwt(): string {
  const appId = process.env.GITHUB_APP_ID?.trim();
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY?.trim();
  if (!appId || !privateKey) {
    throw new GitHubApiError("app_not_configured", "The Kismet GitHub App is not configured.", 503);
  }
  return createAppJwt(appId, normalizePrivateKey(privateKey));
}

export async function installationToken(installationId: number): Promise<string> {
  const cached = tokenCache.get(installationId);
  if (cached && cached.expiresAt - Date.now() > 5 * 60_000) return cached.token;

  const response = await fetch(`${API}/app/installations/${installationId}/access_tokens`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${appJwt()}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "kismet",
    },
    cache: "no-store",
  });
  if (response.status === 404) {
    tokenCache.delete(installationId);
    throw new GitHubApiError(
      "app_uninstalled",
      "Kismet's GitHub App was removed from this account. Install it again in Settings → Connectors → GitHub.",
      401,
    );
  }
  const body = (await response.json().catch(() => ({}))) as {
    token?: string;
    expires_at?: string;
    message?: string;
  };
  if (!response.ok || !body.token || !body.expires_at) {
    throw new GitHubApiError("github_error", body.message || "GitHub could not create an installation token.", response.status);
  }
  tokenCache.set(installationId, { token: body.token, expiresAt: Date.parse(body.expires_at) });
  return body.token;
}

export async function githubTokenFor(userId: string, repo?: string): Promise<string> {
  const connection = await getConnection<GitHubSecret>(userId, "github");
  if (connection) {
    const installations = normalizeGitHubInstallations(connection.secret);
    if (installations.length) {
      const owner = repo?.split("/", 1)[0];
      const ownerInstalled = owner
        ? installations.some((item) => item.account && item.account.toLowerCase() === owner.toLowerCase())
        : true;
      const accountsKnown = installations.some((item) => item.account);
      if (owner && accountsKnown && !ownerInstalled) {
        throw new GitHubApiError(
          "app_not_installed",
          `Kismet's GitHub App isn't installed on ${owner}. Add it in Settings → Connectors → GitHub.`,
          403,
        );
      }
      const installation = chooseGitHubInstallation(connection.secret, repo);
      return installationToken((installation ?? installations[0]).id);
    }
  }
  const token = connection?.secret.token;
  return typeof token === "string" ? token.trim() : "";
}

export async function githubConnectionKind(userId: string): Promise<"app" | "token" | null> {
  const connection = await getConnection<GitHubSecret>(userId, "github");
  if (connection && normalizeGitHubInstallations(connection.secret).length) return "app";
  if (typeof connection?.secret.token === "string" && connection.secret.token.trim()) return "token";
  return null;
}

export async function githubInstallationsFor(userId: string) {
  const connection = await getConnection<GitHubSecret>(userId, "github");
  return connection ? normalizeGitHubInstallations(connection.secret) : [];
}
