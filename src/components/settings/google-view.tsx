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
import type { GoogleDoc, GoogleMessage, GooglePreview, GoogleStatus } from "@/lib/google/types";

const REDIRECT = "http://localhost:3000/api/google/callback";

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
    if (params.get("connected") === "1") setNotice("Google Workspace is connected.");
    else if (error) setNotice(errorMessage(error));
    void load();
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
    const body = (await res.json()) as GooglePreview & { error?: string };
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
    const body = (await res.json()) as { error?: string };
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
    <SettingsShell title="Google Workspace" description="Read Docs and Gmail, and save drafts">
      <Link href="/settings/connectors" className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
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
              Kismet asks Google for read access to Gmail and Docs, plus permission to save drafts. It does not request permission to delete mail.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs leading-relaxed text-muted-foreground">
            <p>1. Open Google Cloud Console, create a project, and enable the Gmail API, Google Docs API, and Google Drive API.</p>
            <p>2. Configure the OAuth consent screen. While it is in testing, add your own Gmail address as a test user.</p>
            <p>3. Create an OAuth client of type Web application. Set the authorized redirect URI to {REDIRECT}.</p>
            <p>4. Put the client ID and secret in .env as GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, then restart the dev server and come back here.</p>
          </CardContent>
        </Card>
      ) : !status.connected ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Sign in with Google</CardTitle>
            <CardDescription className="text-xs leading-relaxed">
              Google will show the account, then the permissions: read Gmail, read Docs and Drive, and create drafts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="sm">
              <a href="/api/google/auth">Connect Google</a>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
              <Badge variant="success">Connected</Badge>
              <span className="text-sm">{status.email}</span>
              <Button variant="outline" size="sm" className="ml-auto" onClick={() => void disconnect()}>
                Disconnect
              </Button>
            </CardContent>
          </Card>
          {previewError && <p className="text-xs text-destructive">{previewError}</p>}
          {!preview && !previewError && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Reading inbox and Docs…
            </div>
          )}
          {preview && (
            <>
              <Section title="Inbox" empty="No inbox messages were returned.">
                {preview.messages.map((message) => (
                  <MessageRow key={message.id} message={message} />
                ))}
              </Section>
              <Section title="Docs" empty="No Google Docs were returned.">
                {preview.docs.map((doc) => (
                  <DocRow key={doc.id} doc={doc} />
                ))}
              </Section>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Save a draft</CardTitle>
                  <CardDescription className="text-xs">This writes a Gmail draft and leaves it unsent.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 p-4 pt-0">
                  <Input value={draftTo} onChange={(event) => setDraftTo(event.target.value)} placeholder="Recipient" className="h-9" />
                  <Input value={draftSubject} onChange={(event) => setDraftSubject(event.target.value)} placeholder="Subject" className="h-9" />
                  <Textarea value={draftBody} onChange={(event) => setDraftBody(event.target.value)} placeholder="Message" rows={4} />
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

function Section({ title, empty, children }: { title: string; empty: string; children: ReactNode }) {
  const list = Array.isArray(children) ? children : [children];
  const items = list.filter(Boolean);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0">
        {items.length === 0 ? <p className="text-xs text-muted-foreground">{empty}</p> : items}
      </CardContent>
    </Card>
  );
}

function MessageRow({ message }: { message: GoogleMessage }) {
  return (
    <div className="border-b border-border pb-3 last:border-0 last:pb-0">
      <p className="text-sm font-medium">{message.subject}</p>
      <p className="text-[11px] text-muted-foreground">{message.from}</p>
      {message.snippet && <p className="mt-1 text-xs text-muted-foreground">{message.snippet}</p>}
    </div>
  );
}

function DocRow({ doc }: { doc: GoogleDoc }) {
  return (
    <div className="border-b border-border pb-3 last:border-0 last:pb-0">
      {doc.link ? (
        <a href={doc.link} target="_blank" rel="noreferrer" className="text-sm font-medium text-[#0571d3] hover:underline">
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
