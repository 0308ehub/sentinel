import "server-only";

import { currentAccountId } from "@/lib/connections/current";
import { deleteConnection, getConnection, saveConnection } from "@/lib/connections/store";
import type { FiledEvidence } from "@/lib/autopilot/workspace-evidence";
import {
  CALENDAR_READONLY,
  DOCS_READONLY,
  GMAIL_READONLY,
  GOOGLE_SCOPES,
  googleRedirectUri,
  docEvidence,
  eventEvidence,
  grantsScope,
  mailEvidence,
} from "@/lib/google/read-core";
import type { GoogleDoc, GoogleEvent, GoogleMessage, GooglePreview, GoogleStatus } from "@/lib/google/types";

interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

interface StoredToken {
  refreshToken: string;
  accessToken?: string;
  expiresAt?: number;
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

interface AccountProfile {
  email?: string;
  hd?: string;
}

export function googleScopes(): string[] {
  return GOOGLE_SCOPES;
}

export function readGoogleConfig(origin?: string): GoogleConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  const redirectUri = googleRedirectUri(origin, process.env.GOOGLE_REDIRECT_URI) || "https://app.sentinelai.one/api/google/callback";
  return { clientId, clientSecret, redirectUri };
}

export function googleAuthUrl(state: string, origin: string): string | null {
  const config = readGoogleConfig(origin);
  if (!config) return null;
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_SCOPES.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "select_account consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function getGoogleStatus(origin?: string): Promise<GoogleStatus> {
  const config = readGoogleConfig(origin);
  if (!config) {
    return {
      configured: false,
      connected: false,
      error: "Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env, then restart the dev server.",
      redirectUri: googleRedirectUri(origin, process.env.GOOGLE_REDIRECT_URI) || undefined,
    };
  }
  const stored = await readToken();
  const redirectUri = googleRedirectUri(origin, process.env.GOOGLE_REDIRECT_URI);
  if (!stored?.refreshToken) return { configured: true, connected: false, redirectUri };
  const legacy = !stored.scopes;
  return {
    configured: true,
    connected: true,
    email: stored.email,
    hostedDomain: stored.hostedDomain,
    gmail: legacy || grantsScope(stored.scopes, GMAIL_READONLY),
    docs: legacy || grantsScope(stored.scopes, DOCS_READONLY),
    calendar: grantsScope(stored.scopes, CALENDAR_READONLY),
    redirectUri,
  };
}

export async function exchangeGoogleCode(code: string, origin: string): Promise<void> {
  const config = readGoogleConfig(origin);
  if (!config) throw new Error("Google OAuth is not configured.");
  const token = await requestToken(config, {
    code,
    grant_type: "authorization_code",
    redirect_uri: config.redirectUri,
  });
  if (!token.refresh_token && !(await readToken())?.refreshToken) {
    throw new Error(
      "Google did not return a refresh token. Remove Kismet's access in your Google Account and connect again.",
    );
  }
  const previous = await readToken();
  const refreshToken = token.refresh_token || previous?.refreshToken;
  if (!refreshToken || !token.access_token) {
    throw new Error(token.error_description || "Google did not return an access token.");
  }
  const profile = await fetchProfile(token.access_token);
  await writeToken({
    refreshToken,
    accessToken: token.access_token,
    expiresAt: Date.now() + (token.expires_in ?? 3600) * 1000,
    email: profile.email,
    hostedDomain: profile.hd,
    scopes: token.scope || GOOGLE_SCOPES.join(" "),
  });
}

export async function disconnectGoogle(): Promise<void> {
  const userId = await currentAccountId();
  if (!userId) throw new Error("Unauthorized");
  await deleteConnection(userId, "google");
}

export async function createGmailDraft(input: {
  to: string;
  subject: string;
  body: string;
}): Promise<{ id: string }> {
  const to = input.to.trim().replace(/[\r\n]/g, "");
  const subject = input.subject.trim().replace(/[\r\n]/g, "");
  const body = input.body.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new Error("Enter a valid recipient.");
  if (!subject) throw new Error("Add a subject.");
  if (!body) throw new Error("Add the draft body.");
  if (subject.length > 200 || body.length > 8000) throw new Error("That draft is too long.");
  const accessToken = await accessTokenOrThrow();
  const raw = Buffer.from(
    [`To: ${to}`, `Subject: ${subject}`, "Content-Type: text/plain; charset=\"UTF-8\"", "", body].join("\r\n"),
    "utf8",
  ).toString("base64url");
  const created = await googleSend<{ id?: string }>(
    accessToken,
    "https://gmail.googleapis.com/gmail/v1/users/me/drafts",
    { message: { raw } },
  );
  if (!created.id) throw new Error("Gmail did not return a draft.");
  return { id: created.id };
}

export async function loadGooglePreview(): Promise<GooglePreview> {
  const accessToken = await accessTokenOrThrow();
  const stored = await readToken();
  const [messages, docs, events] = await Promise.all([
    readSource(listInbox(accessToken)),
    readSource(listDocs(accessToken)),
    readSource(listEvents(accessToken)),
  ]);
  return {
    email: stored?.email,
    hostedDomain: stored?.hostedDomain,
    messages: messages.value,
    docs: docs.value,
    events: events.value,
    errors: { mail: messages.error, docs: docs.error, calendar: events.error },
  };
}

/** Docs, calendar events, and inbox mail for the autopilot to file. Empty when Google is not connected. */
export async function listGoogleWorkspaceEvidence(): Promise<FiledEvidence[]> {
  const stored = await readToken();
  if (!stored?.refreshToken) return [];
  const accessToken = await accessTokenOrThrow();
  const [messages, docs, events] = await Promise.all([
    listInbox(accessToken).catch(() => [] as GoogleMessage[]),
    listDocs(accessToken).catch(() => [] as GoogleDoc[]),
    listEvents(accessToken).catch(() => [] as GoogleEvent[]),
  ]);
  const items: FiledEvidence[] = [];
  for (const message of messages) {
    const item = mailEvidence(message);
    if (item) items.push(item);
  }
  for (const doc of docs) {
    const item = docEvidence(doc);
    if (item) items.push(item);
  }
  for (const event of events) {
    const item = eventEvidence({ ...event, description: event.snippet });
    if (item) items.push(item);
  }
  return items;
}

async function readSource<T>(work: Promise<T[]>): Promise<{ value: T[]; error?: string }> {
  try {
    return { value: await work };
  } catch (error) {
    return { value: [], error: error instanceof Error ? error.message : "Could not read this." };
  }
}

async function accessTokenOrThrow(): Promise<string> {
  const config = readGoogleConfig();
  const stored = await readToken();
  if (!config || !stored?.refreshToken) throw new Error("Connect Google Workspace first.");
  if (stored.accessToken && stored.expiresAt && stored.expiresAt > Date.now() + 60_000) {
    return stored.accessToken;
  }
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

async function fetchProfile(accessToken: string): Promise<AccountProfile> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return {};
  return (await res.json()) as AccountProfile;
}

async function listInbox(accessToken: string): Promise<GoogleMessage[]> {
  const list = await googleGet<{ messages?: { id: string }[] }>(
    accessToken,
    "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10&q=in:inbox%20newer_than:21d",
  );
  const messages = await Promise.all(
    (list.messages ?? []).map(async (item) => {
      const full = await googleGet<{
        id: string;
        snippet?: string;
        payload?: { headers?: { name: string; value: string }[] };
      }>(
        accessToken,
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${item.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
      );
      const headers = full.payload?.headers ?? [];
      const header = (name: string) =>
        headers.find((entry) => entry.name.toLowerCase() === name.toLowerCase())?.value ?? "";
      return {
        id: full.id,
        from: header("From"),
        subject: header("Subject") || "(no subject)",
        date: header("Date"),
        snippet: full.snippet ?? "",
      };
    }),
  );
  return messages;
}

interface DriveFile {
  id: string;
  name: string;
  modifiedTime?: string;
  webViewLink?: string;
}

async function listDocs(accessToken: string): Promise<GoogleDoc[]> {
  const query = "mimeType='application/vnd.google-apps.document' and trashed=false";
  const [mine, shared] = await Promise.all([
    driveFiles(accessToken, `${query}`, true),
    driveFiles(accessToken, `${query} and modifiedTime > '${daysAgo(45)}'`, false).catch(() => [] as DriveFile[]),
  ]);
  const files = [...mine, ...shared]
    .filter((file, index, all) => all.findIndex((item) => item.id === file.id) === index)
    .sort((a, b) => (b.modifiedTime ?? "").localeCompare(a.modifiedTime ?? ""))
    .slice(0, 8);
  const excerpts = await Promise.all(
    files.slice(0, 4).map(async (file) => [file.id, await docExcerpt(accessToken, file.id).catch(() => undefined)] as const),
  );
  const excerptFor = new Map(excerpts);
  return files.map((file) => ({
    id: file.id,
    name: file.name,
    modified: file.modifiedTime ?? "",
    link: file.webViewLink,
    excerpt: excerptFor.get(file.id),
  }));
}

async function driveFiles(accessToken: string, query: string, mine: boolean): Promise<DriveFile[]> {
  const params = new URLSearchParams({
    q: query,
    pageSize: "8",
    fields: "files(id,name,modifiedTime,webViewLink)",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  });
  if (mine) params.set("orderBy", "modifiedTime desc");
  else params.set("corpora", "allDrives");
  const listed = await googleGet<{ files?: DriveFile[] }>(
    accessToken,
    `https://www.googleapis.com/drive/v3/files?${params}`,
  );
  return listed.files ?? [];
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

async function listEvents(accessToken: string): Promise<GoogleEvent[]> {
  const params = new URLSearchParams({
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "12",
    timeMin: new Date(Date.now() - 14 * 86_400_000).toISOString(),
    timeMax: new Date(Date.now() + 21 * 86_400_000).toISOString(),
    fields: "items(id,summary,description,location,status,htmlLink,start,end,organizer(email,displayName))",
  });
  const listed = await googleGet<{
    items?: {
      id?: string;
      summary?: string;
      description?: string;
      location?: string;
      status?: string;
      htmlLink?: string;
      start?: { dateTime?: string; date?: string };
      end?: { dateTime?: string; date?: string };
      organizer?: { email?: string; displayName?: string };
    }[];
  }>(accessToken, `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`);
  return (listed.items ?? []).flatMap((item) => {
    if (!item.id || !item.summary || item.status === "cancelled") return [];
    const allDay = Boolean(item.start?.date && !item.start.dateTime);
    const start = item.start?.dateTime || item.start?.date;
    const end = item.end?.dateTime || item.end?.date || start;
    if (!start || !end) return [];
    return [{
      id: item.id,
      title: item.summary,
      start,
      end,
      allDay,
      location: item.location,
      snippet: item.description?.replace(/\s+/g, " ").trim().slice(0, 280),
      link: item.htmlLink,
      organizer: item.organizer?.displayName || item.organizer?.email,
    }];
  });
}

async function docExcerpt(accessToken: string, id: string): Promise<string | undefined> {
  const doc = await googleGet<{ body?: { content?: DocElement[] } }>(
    accessToken,
    `https://docs.googleapis.com/v1/documents/${id}`,
  );
  const text = collectText(doc.body?.content ?? []).replace(/\s+/g, " ").trim();
  return text ? text.slice(0, 280) : undefined;
}

interface DocElement {
  paragraph?: { elements?: { textRun?: { content?: string; }; }[]; };
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

interface StoredMeta {
  email?: string;
  hostedDomain?: string;
  scopes?: string;
}

async function readToken(): Promise<(StoredToken & StoredMeta) | null> {
  const userId = await currentAccountId();
  if (!userId) return null;
  const connection = await getConnection<StoredToken>(userId, "google");
  if (!connection) return null;
  const meta = connection.meta;
  return {
    ...connection.secret,
    email: typeof meta.email === "string" ? meta.email : undefined,
    hostedDomain: typeof meta.hostedDomain === "string" ? meta.hostedDomain : undefined,
    scopes: typeof meta.scopes === "string" ? meta.scopes : undefined,
  };
}

async function writeToken(token: StoredToken & StoredMeta): Promise<void> {
  const userId = await currentAccountId();
  if (!userId) throw new Error("Unauthorized");
  const { email, hostedDomain, scopes, ...secret } = token;
  await saveConnection(userId, "google", secret, { email, hostedDomain, scopes });
}
