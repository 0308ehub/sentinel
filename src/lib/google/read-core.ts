export const GMAIL_READONLY = "https://www.googleapis.com/auth/gmail.readonly";
export const GMAIL_COMPOSE = "https://www.googleapis.com/auth/gmail.compose";
export const DOCS_READONLY = "https://www.googleapis.com/auth/documents.readonly";
export const DRIVE_READONLY = "https://www.googleapis.com/auth/drive.readonly";
export const CALENDAR_READONLY = "https://www.googleapis.com/auth/calendar.events.readonly";

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  GMAIL_READONLY,
  GMAIL_COMPOSE,
  DOCS_READONLY,
  DRIVE_READONLY,
  CALENDAR_READONLY,
];

export function grantsScope(scopes: string | undefined, scope: string): boolean {
  return (scopes ?? "").split(/\s+/).filter(Boolean).includes(scope);
}

/** The callback Google will accept is the one for the site the person is using. */
export function googleRedirectUri(origin: string | undefined, configured: string | undefined): string {
  const fromOrigin = origin ? `${origin.replace(/\/$/, "")}/api/google/callback` : "";
  const fromEnv = (configured ?? "").trim();
  if (!fromOrigin) return fromEnv;
  if (!fromEnv) return fromOrigin;
  try {
    if (new URL(fromEnv).origin === new URL(fromOrigin).origin) return fromEnv;
  } catch {
    return fromOrigin;
  }
  return fromOrigin;
}

export interface GoogleMessageInput {
  id: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
}

export interface GoogleDocInput {
  id: string;
  name: string;
  modified: string;
  link?: string;
  excerpt?: string;
}

export interface GoogleEventInput {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  status?: string;
  location?: string;
  description?: string;
  organizer?: string;
  link?: string;
}

export interface GoogleReadItem {
  source: "google";
  title: string;
  body: string;
  author: string;
  url: string;
  occurredAt: string;
}

function clean(value: string | undefined, max: number): string {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function when(value: string): string {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date(0).toISOString();
}

/** A recent inbox message, skipped when there is nothing to read. */
export function mailEvidence(message: GoogleMessageInput): GoogleReadItem | null {
  const subject = clean(message.subject, 180);
  const snippet = clean(message.snippet, 360);
  const titled = subject && subject !== "(no subject)" ? subject : snippet;
  if (!message.id || titled.length < 12) return null;
  const from = clean(message.from, 180) || "Gmail";
  return {
    source: "google",
    title: titled,
    body: clean(`Email from ${from}. ${snippet}`, 500),
    author: from,
    url: `https://mail.google.com/mail/u/0/#all/${encodeURIComponent(message.id)}`,
    occurredAt: when(message.date),
  };
}

/** A Google Doc, including ones that live on a shared drive. */
export function docEvidence(doc: GoogleDocInput): GoogleReadItem | null {
  const name = clean(doc.name, 180);
  if (!doc.id || !name) return null;
  const excerpt = clean(doc.excerpt, 360);
  return {
    source: "google",
    title: name,
    body: excerpt ? clean(`Google Doc. ${excerpt}`, 500) : "Google Doc.",
    author: "Google Docs",
    url: doc.link || `https://docs.google.com/document/d/${encodeURIComponent(doc.id)}/edit`,
    occurredAt: when(doc.modified),
  };
}

/** A calendar event on the connected account. Cancelled events are ignored. */
export function eventEvidence(event: GoogleEventInput): GoogleReadItem | null {
  if (event.status === "cancelled" || !event.id) return null;
  const title = clean(event.title, 180);
  if (title.length < 2) return null;
  const whenLabel = event.allDay ? `All day ${event.start.slice(0, 10)}` : event.start;
  const detail = [clean(event.location, 120), clean(event.description, 300)].filter(Boolean).join(". ");
  return {
    source: "google",
    title,
    body: clean(`Calendar. ${whenLabel}. ${detail}`, 500),
    author: clean(event.organizer, 180) || "Google Calendar",
    url: event.link || `https://calendar.google.com/calendar/event?eid=${encodeURIComponent(event.id)}`,
    occurredAt: when(event.start),
  };
}
