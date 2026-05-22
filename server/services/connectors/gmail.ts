import { google } from "googleapis";
import type { GmailConfig, ImportedDocument } from "./types";

export function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/gmail/callback`
  );
}

export function getAuthUrl(state: string) {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/userinfo.email",
    ],
    state,
  });
}

export async function exchangeCode(code: string) {
  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const { data } = await oauth2.userinfo.get();

  return {
    accessToken: tokens.access_token!,
    refreshToken: tokens.refresh_token!,
    expiresAt: tokens.expiry_date!,
    email: data.email!,
  };
}

async function getAuthenticatedClient(config: GmailConfig) {
  const client = getOAuthClient();
  client.setCredentials({
    access_token: config.accessToken,
    refresh_token: config.refreshToken,
    expiry_date: config.expiresAt,
  });

  // Auto-refresh if expired
  if (config.expiresAt < Date.now() + 60_000) {
    const { credentials } = await client.refreshAccessToken();
    client.setCredentials(credentials);
  }

  return client;
}

export async function syncGmail(config: GmailConfig, maxMessages = 50): Promise<ImportedDocument[]> {
  const auth = await getAuthenticatedClient(config);
  const gmail = google.gmail({ version: "v1", auth });

  const q = config.labelFilter ? `label:${config.labelFilter}` : "in:inbox";
  const listRes = await gmail.users.messages.list({
    userId: "me",
    q,
    maxResults: maxMessages,
  });

  const messages = listRes.data.messages ?? [];
  const docs: ImportedDocument[] = [];

  for (const msg of messages) {
    if (!msg.id) continue;
    try {
      const full = await gmail.users.messages.get({
        userId: "me",
        id: msg.id,
        format: "full",
      });

      const headers = full.data.payload?.headers ?? [];
      const subject = headers.find((h) => h.name === "Subject")?.value ?? "No subject";
      const from = headers.find((h) => h.name === "From")?.value ?? "";
      const date = headers.find((h) => h.name === "Date")?.value ?? "";

      const body = extractBody(full.data.payload);
      if (!body.trim()) continue;

      docs.push({
        title: subject,
        externalId: msg.id,
        text: `From: ${from}\nDate: ${date}\nSubject: ${subject}\n\n${body}`,
        sourceType: "EMAIL",
        metadata: { from, date, threadId: full.data.threadId ?? "" },
      });
    } catch {
      // skip individual message errors
    }
  }

  return docs;
}

function extractBody(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const p = payload as Record<string, unknown>;

  if (p.mimeType === "text/plain" && p.body) {
    const body = p.body as Record<string, unknown>;
    if (body.data) return Buffer.from(body.data as string, "base64").toString("utf-8");
  }

  if (Array.isArray(p.parts)) {
    for (const part of p.parts) {
      const text = extractBody(part);
      if (text) return text;
    }
  }

  return "";
}
