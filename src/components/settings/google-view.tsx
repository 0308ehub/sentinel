"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { SettingsShell } from "@/components/settings/settings-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { graphStore } from "@/lib/graph/graph-store";
import type { GoogleDoc, GoogleEvent, GoogleMessage, GooglePreview, GoogleStatus } from "@/lib/google/types";

const REDIRECTS = [
  "http://localhost:3000/api/google/callback",
  "https://app.sentinelai.one/api/google/callback",
];

export function GoogleView() {
  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [preview, setPreview] = useState<GooglePreview | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [draftTo, setDraftTo] = useState("");
  const [draftSubject, setDraftSubject] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [draftState, setDraftState] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    void Promise.resolve().then(() => {
      if (params.get("connected") === "1") setNotice("Google Workspace is connected.");
      else if (error) setNotice(errorMessage(error));
      return load();
    });
  }, []);

  async function load() {
    const next = await fetch("/api/google/status", { cache: "no-store" })
      .then((res) => res.json() as Promise<GoogleStatus>)
      .catch((): GoogleStatus => ({ configured: false, connected: false, error: "Could not check Google." }));
    setStatus(next);
    if (!next.connected) {
      setPreview(null);
      return;
    }
    const res = await fetch("/api/google/preview", { cache: "no-store" });
    const body = (await res.json()) as GooglePreview & { error?: string; };
    if (!res.ok) {
      setPreviewError(body.error ?? "Could not read Gmail or Docs.");
      return;
    }
    setPreview(body);
    setPreviewError(null);
  }

  async function saveDraft() {
    setSavingDraft(true);
    setDraftState(null);
    const res = await fetch("/api/google/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: draftTo, subject: draftSubject, body: draftBody }),
    });
    const body = (await res.json()) as { error?: string; };
    setSavingDraft(false);
    if (!res.ok) {
      setDraftState(body.error ?? "Could not save the draft.");
      return;
    }
    setDraftTo("");
    setDraftSubject("");
    setDraftBody("");
    setDraftState("Saved in Gmail drafts. It was not sent.");
  }

  async function disconnect() {
    await fetch("/api/google/disconnect", { method: "POST" });
    graphStore.getState().detachSource("google-workspace");
    setPreview(null);
    setNotice(null);
    await load();
  }

  return (
    <SettingsShell title="Google Workspace" description="Read Docs, Calendar, and Gmail">
      <Link
        href="/settings/connectors"
        className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" />
        Connected apps
      </Link>

      {notice && <p className="mb-3 text-xs text-muted-foreground">{notice}</p>}

      {!status ? (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking Google…
        </div>
      ) : !status.configured ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Create a Google OAuth client</CardTitle>
            <CardDescription className="text-xs leading-relaxed">
              Kismet asks Google for read access to Gmail, Docs, Drive, and Calendar, plus permission to save drafts.
              It does not request permission to delete mail or change the calendar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs leading-relaxed text-muted-foreground">
            <p>
              1. Open Google Cloud Console, create a project, and enable the Gmail API, Google Docs API,
              Google Drive API, and Google Calendar API.
            </p>
            <p>
              2. Configure the OAuth consent screen for External, or Internal if this Cloud project belongs
              to the same Workspace. While the app is in testing, add each person as a test user. A Workspace
              admin may also need to allow the app.
            </p>
            <p>
              3. Create an OAuth client of type Web application. Add both authorized redirect URIs:{" "}
              {REDIRECTS.join(" and ")}.
            </p>
            <p>
              4. Put the client ID and secret in .env as GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET,
              then restart the dev server and come back here.
            </p>
          </CardContent>
        </Card>
      ) : !status.connected ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Sign in with Google</CardTitle>
            <CardDescription className="text-xs leading-relaxed">
              Google opens the account list. Choose the Berkeley email you use for Kismet, even if this browser is signed into another Gmail.
              Google then asks to read Gmail, Docs, Drive, and Calendar, and to create drafts.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button asChild size="sm">
              <a href="/api/google/auth">Connect Google</a>
            </Button>
            {status.redirectUri && (
              <p className="text-xs leading-relaxed text-muted-foreground">
                If Google says the request is invalid, add this exact redirect URI to the OAuth client:{" "}
                <span className="font-mono text-foreground">{status.redirectUri}</span>
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
              <Badge variant="success">Connected</Badge>
              <span className="text-sm">{status.email}</span>
              {status.hostedDomain && <span className="text-xs text-muted-foreground">Workspace · {status.hostedDomain}</span>}
              <Button variant="outline" size="sm" className="ml-auto" onClick={() => void disconnect()}>
                Disconnect
              </Button>
            </CardContent>
          </Card>
          {status.calendar === false && (
            <p className="text-xs text-muted-foreground">
              Calendar is not on this connection yet.{" "}
              <a href="/api/google/auth" className="text-brand hover:underline">Add Calendar</a>
            </p>
          )}
          {previewError && <p className="text-xs text-destructive">{previewError}</p>}
          {!preview && !previewError && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Reading Docs, Calendar, and Gmail…
            </div>
          )}
          {preview && (
            <>
              <Section title="Docs" empty="No Google Docs were returned." error={preview.errors?.docs}>
                {preview.docs.map((doc) => (
                  <DocRow key={doc.id} doc={doc} />
                ))}
              </Section>
              <Section title="Calendar" empty="Nothing on the primary calendar in the last two weeks or the next three." error={preview.errors?.calendar}>
                {preview.events.map((event) => (
                  <EventRow key={event.id} event={event} />
                ))}
              </Section>
              <Section title="Inbox" empty="No recent inbox messages were returned." error={preview.errors?.mail}>
                {preview.messages.map((message) => (
                  <MessageRow key={message.id} message={message} />
                ))}
              </Section>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Save a draft</CardTitle>
                  <CardDescription className="text-xs">This writes a Gmail draft and leaves it unsent.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 p-4 pt-0">
                  <Input
                    value={draftTo}
                    onChange={(event) => setDraftTo(event.target.value)}
                    placeholder="Recipient"
                    className="h-9"
                  />
                  <Input
                    value={draftSubject}
                    onChange={(event) => setDraftSubject(event.target.value)}
                    placeholder="Subject"
                    className="h-9"
                  />
                  <Textarea
                    value={draftBody}
                    onChange={(event) => setDraftBody(event.target.value)}
                    placeholder="Message"
                    rows={4}
                  />
                  <Button type="button" size="sm" disabled={savingDraft} onClick={() => void saveDraft()}>
                    {savingDraft ? "Saving…" : "Save draft"}
                  </Button>
                  {draftState && <p className="text-xs text-muted-foreground">{draftState}</p>}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}
    </SettingsShell>
  );
}

function Section({
  title,
  empty,
  error,
  children,
}: {
  title: string;
  empty: string;
  error?: string;
  children: ReactNode;
}) {
  const list = Array.isArray(children) ? children : [children];
  const items = list.filter(Boolean);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0">
        {error && <p className="text-xs text-destructive">{error}</p>}
        {items.length === 0 && !error ? <p className="text-xs text-muted-foreground">{empty}</p> : items}
      </CardContent>
    </Card>
  );
}

function MessageRow({ message }: { message: GoogleMessage; }) {
  return (
    <div className="border-b border-border pb-3 last:border-0 last:pb-0">
      <p className="text-sm font-medium">{message.subject}</p>
      <p className="text-[11px] text-muted-foreground">{message.from}</p>
      {message.snippet && <p className="mt-1 text-xs text-muted-foreground">{message.snippet}</p>}
    </div>
  );
}

function EventRow({ event }: { event: GoogleEvent }) {
  const label = eventTime(event);
  return (
    <div className="border-b border-border pb-3 last:border-0 last:pb-0">
      {event.link ? (
        <a href={event.link} target="_blank" rel="noreferrer" className="text-sm font-medium text-brand hover:underline">
          {event.title}
        </a>
      ) : (
        <p className="text-sm font-medium">{event.title}</p>
      )}
      <p className="text-[11px] text-muted-foreground">{label}{event.organizer ? ` · ${event.organizer}` : ""}</p>
      {event.location && <p className="mt-1 text-xs text-muted-foreground">{event.location}</p>}
      {event.snippet && <p className="mt-1 text-xs text-muted-foreground">{event.snippet}</p>}
    </div>
  );
}

function eventTime(event: GoogleEvent): string {
  if (event.allDay) return event.start.slice(0, 10);
  const start = new Date(event.start);
  const end = new Date(event.end);
  if (Number.isNaN(start.getTime())) return event.start;
  const day = start.toLocaleString(undefined, { month: "short", day: "numeric" });
  const from = start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const to = Number.isNaN(end.getTime()) ? "" : end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return to ? `${day}, ${from}–${to}` : `${day}, ${from}`;
}

function DocRow({ doc }: { doc: GoogleDoc; }) {
  return (
    <div className="border-b border-border pb-3 last:border-0 last:pb-0">
      {doc.link ? (
        <a href={doc.link} target="_blank" rel="noreferrer" className="text-sm font-medium text-brand hover:underline">
          {doc.name}
        </a>
      ) : (
        <p className="text-sm font-medium">{doc.name}</p>
      )}
      {doc.excerpt && <p className="mt-1 text-xs text-muted-foreground">{doc.excerpt}</p>}
    </div>
  );
}

function errorMessage(code: string): string {
  if (code === "missing_client") return "Add the Google client ID and secret to .env, then restart the server.";
  if (code === "access_denied") return "Google sign-in was cancelled.";
  if (code === "state") return "The Google sign-in expired. Connect again.";
  return code;
}
