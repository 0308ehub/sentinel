import { createSign, timingSafeEqual } from "node:crypto";

export function normalizePrivateKey(value: string): string {
  return value.replace(/\\n/g, "\n");
}

function base64url(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

export function createAppJwt(appId: string, privateKey: string, now = Math.floor(Date.now() / 1000)): string {
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(JSON.stringify({ iat: now - 60, exp: now + 540, iss: appId }));
  const unsigned = `${header}.${claims}`;
  const signature = createSign("RSA-SHA256").update(unsigned).end().sign(normalizePrivateKey(privateKey));
  return `${unsigned}.${base64url(signature)}`;
}

export function githubAppInstallUrl(slug: string, state: string): URL {
  const url = new URL(`https://github.com/apps/${encodeURIComponent(slug)}/installations/new`);
  url.searchParams.set("state", state);
  return url;
}

export function githubAuthorizeUrl(clientId: string, state: string, redirectUri: string): URL {
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("state", state);
  url.searchParams.set("redirect_uri", redirectUri);
  return url;
}

export function githubStateMatches(expected: string | null | undefined, received: string | null | undefined): boolean {
  if (!expected || !received) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(received);
  return left.length === right.length && timingSafeEqual(left, right);
}

export interface GitHubInstallation {
  id: number;
  account: string;
}

export function normalizeGitHubInstallations(secret: {
  installations?: unknown;
  installationId?: unknown;
}): GitHubInstallation[] {
  if (Array.isArray(secret.installations)) {
    return secret.installations.flatMap((value) => {
      if (!value || typeof value !== "object") return [];
      const row = value as { id?: unknown; account?: unknown };
      if (typeof row.id !== "number" || !Number.isSafeInteger(row.id) || row.id <= 0) return [];
      return [{ id: row.id, account: typeof row.account === "string" ? row.account : "" }];
    });
  }
  return typeof secret.installationId === "number" && Number.isSafeInteger(secret.installationId) && secret.installationId > 0
    ? [{ id: secret.installationId, account: "" }]
    : [];
}

export function chooseGitHubInstallation(
  secret: { installations?: unknown; installationId?: unknown },
  repo?: string | null,
): GitHubInstallation | undefined {
  const installations = normalizeGitHubInstallations(secret);
  const owner = repo?.split("/", 1)[0]?.trim();
  if (!owner) return installations[0];
  return installations.find((item) => item.account.toLowerCase() === owner.toLowerCase()) ?? installations[0];
}

export function githubPopupHtml(status: "connected" | "pending" | "error", error?: string): string {
  const payload = JSON.stringify({ type: "kismet-github", status, error: error ?? null }).replaceAll("<", "\\u003c");
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>GitHub connection</title></head>
<body>
<p>${status === "connected" ? "GitHub connected." : status === "pending" ? "GitHub approval is pending." : "GitHub could not connect."}</p>
<p><a href="/settings/connectors/github">Return to GitHub settings</a></p>
<script>if (window.opener) { window.opener.postMessage(${payload}, window.location.origin); window.close(); }</script>
</body>
</html>`;
}
