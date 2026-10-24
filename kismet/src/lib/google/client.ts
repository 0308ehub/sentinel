import "server-only";

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { GoogleDoc, GoogleMessage, GooglePreview, GoogleStatus } from "@/lib/google/types";

const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/documents.readonly",
  "https://www.googleapis.com/auth/drive.readonly",
];

const TOKEN_PATH = path.join(process.cwd(), ".data", "google-oauth.json");

interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

interface StoredToken {
  refreshToken: string;
  accessToken?: string;
  expiresAt?: number;
  email?: string;
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

export function googleScopes(): string[] {
  return SCOPES;
}

export function readGoogleConfig(): GoogleConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim() || "http://localhost:3000/api/google/callback";
  return { clientId, clientSecret, redirectUri };
}

export function googleAuthUrl(state: string): string | null {
  const config = readGoogleConfig();
  if (!config) return null;
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function getGoogleStatus(): Promise<GoogleStatus> {
  const config = readGoogleConfig();
  if (!config) {
    return {
      configured: false,
      connected: false,
      error: "Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env, then restart the dev server.",
    };
  }
  const stored = await readToken();
  if (!stored?.refreshToken) return { configured: true, connected: false };
  return { configured: true, connected: true, email: stored.email };
}

export async function exchangeGoogleCode(code: string): Promise<void> {
  const config = readGoogleConfig();
  if (!config) throw new Error("Google OAuth is not configured.");
  const token = await requestToken(config, {
    code,
    grant_type: "authorization_code",
    redirect_uri: config.redirectUri,
  });
  if (!token.refresh_token && !(await readToken())?.refreshToken) {
    throw new Error("Google did not return a refresh token. Remove Kismet's access in your Google Account and connect again.");
  }
  const previous = await readToken();
  const refreshToken = token.refresh_token || previous?.refreshToken;
  if (!refreshToken || !token.access_token) throw new Error(token.error_description || "Google did not return an access token.");
  const email = await fetchEmail(token.access_token);
  await writeToken({
    refreshToken,
    accessToken: token.access_token,
    expiresAt: Date.now() + (token.expires_in ?? 3600) * 1000,
    email,
  });
}

export async function disconnectGoogle(): Promise<void> {
  await rm(TOKEN_PATH, { force: true });
}

export async function createGmailDraft(input: { to: string; subject: string; body: string }): Promise<{ id: string }> {
  const to = input.to.trim().replace(/[\r\n]/g, "");
  const subject = input.subject.trim().replace(/[\r\n]/g, "");
  const body = input.body.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new Error("Enter a valid recipient.");
  if (!subject) throw new Error("Add a subject.");
  if (!body) throw new Error("Add the draft body.");
  if (subject.length > 200 || body.length > 8000) throw new Error("That draft is too long.");
  const accessToken = await accessTokenOrThrow();
  const raw = Buffer.from(
    [`To: ${to}`, `Subject: ${subject}`, 'Content-Type: text/plain; charset="UTF-8"', "", body].join("\r\n"),
    "utf8"
  ).toString("base64url");
  const created = await googleSend<{ id?: string }>(accessToken, "https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
    message: { raw },
  });
  if (!created.id) throw new Error("Gmail did not return a draft.");
  return { id: created.id };
}

export async function loadGooglePreview(): Promise<GooglePreview> {
  const accessToken = await accessTokenOrThrow();
  const email = (await readToken())?.email;
  const [messages, docs] = await Promise.all([listInbox(accessToken), listDocs(accessToken)]);
  return { email, messages, docs };
}

async function accessTokenOrThrow(): Promise<string> {
  const config = readGoogleConfig();
  const stored = await readToken();
  if (!config || !stored?.refreshToken) throw new Error("Connect Google Workspace first.");
  if (stored.accessToken && stored.expiresAt && stored.expiresAt > Date.now() + 60_000) return stored.accessToken;
  const token = await requestToken(config, {
    grant_type: "refresh_token",
    refresh_token: stored.refreshToken,
  });
  if (!token.access_token) throw new Error(token.error_description || "Google refused to refresh the connection.");
  await writeToken({
    ...stored,
    accessToken: token.access_token,
    expiresAt: Date.now() + (token.expires_in ?? 3600) * 1000,
  });
  return token.access_token;
}

async function requestToken(config: GoogleConfig, fields: Record<string, string>): Promise<TokenResponse> {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    ...fields,
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  return (await res.json()) as TokenResponse;
}

async function fetchEmail(accessToken: string): Promise<string | undefined> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return undefined;
  const body = (await res.json()) as { email?: string };
  return body.email;
}

async function listInbox(accessToken: string): Promise<GoogleMessage[]> {
  const list = await googleGet<{ messages?: { id: string }[] }>(
    accessToken,
    "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=6&q=in:inbox"
  );
  const messages = await Promise.all(
    (list.messages ?? []).map(async (item) => {
      const full = await googleGet<{
        id: string;
        snippet?: string;
        payload?: { headers?: { name: string; value: string }[] };
      }>(
        accessToken,
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${item.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`
      );
      const headers = full.payload?.headers ?? [];
      const header = (name: string) => headers.find((entry) => entry.name.toLowerCase() === name.toLowerCase())?.value ?? "";
      return {
        id: full.id,
        from: header("From"),
        subject: header("Subject") || "(no subject)",
        date: header("Date"),
        snippet: full.snippet ?? "",
      };
    })
  );
  return messages;
}

async function listDocs(accessToken: string): Promise<GoogleDoc[]> {
  const query = encodeURIComponent("mimeType='application/vnd.google-apps.document' and trashed=false");
  const listed = await googleGet<{ files?: { id: string; name: string; modifiedTime?: string; webViewLink?: string }[] }>(
    accessToken,
    `https://www.googleapis.com/drive/v3/files?q=${query}&orderBy=modifiedTime desc&pageSize=6&fields=files(id,name,modifiedTime,webViewLink)`
  );
  const files = listed.files ?? [];
  const first = files[0];
  const excerpt = first ? await docExcerpt(accessToken, first.id) : undefined;
  return files.map((file) => ({
    id: file.id,
    name: file.name,
    modified: file.modifiedTime ?? "",
    link: file.webViewLink,
    excerpt: file.id === first?.id ? excerpt : undefined,
  }));
}

async function docExcerpt(accessToken: string, id: string): Promise<string | undefined> {
  const doc = await googleGet<{ body?: { content?: DocElement[] } }>(
    accessToken,
    `https://docs.googleapis.com/v1/documents/${id}`
  );
  const text = collectText(doc.body?.content ?? []).replace(/\s+/g, " ").trim();
  return text ? text.slice(0, 280) : undefined;
}

interface DocElement {
  paragraph?: { elements?: { textRun?: { content?: string } }[] };
  content?: DocElement[];
}

function collectText(elements: DocElement[]): string {
  let text = "";
  for (const element of elements) {
    for (const run of element.paragraph?.elements ?? []) text += run.textRun?.content ?? "";
    if (element.content) text += collectText(element.content);
  }
  return text;
}

async function googleSend<T>(accessToken: string, url: string, payload: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok) throw new Error(body.error?.message || `Google returned ${res.status}.`);
  return body;
}

async function googleGet<T>(accessToken: string, url: string): Promise<T> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const body = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok) throw new Error(body.error?.message || `Google returned ${res.status}.`);
  return body;
}

async function readToken(): Promise<StoredToken | null> {
  try {
    return JSON.parse(await readFile(TOKEN_PATH, "utf8")) as StoredToken;
  } catch {
    return null;
  }
}

async function writeToken(token: StoredToken): Promise<void> {
  await mkdir(path.dirname(TOKEN_PATH), { recursive: true });
  await writeFile(TOKEN_PATH, JSON.stringify(token), { mode: 0o600 });
}
