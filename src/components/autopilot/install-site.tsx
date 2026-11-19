"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Loader2, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SiteDetails {
  key: string;
  snippet: string;
  eventsLast24h: number;
  siteUrl: string | null;
}

export function InstallSite() {
  const [details, setDetails] = useState<SiteDetails | null>(null);
  const [copied, setCopied] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [error, setError] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [savingUrl, setSavingUrl] = useState(false);
  const [urlSaved, setUrlSaved] = useState(false);

  useEffect(() => {
    fetch("/api/autopilot/site", { cache: "no-store" })
      .then(async (response) => {
        const body = (await response.json()) as SiteDetails & { error?: string };
        if (!response.ok) throw new Error(body.error || "Could not load the site SDK.");
        setDetails(body);
        setSiteUrl(body.siteUrl ?? "");
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Could not load the site SDK."));
  }, []);

  async function copy() {
    if (!details) return;
    await navigator.clipboard.writeText(details.snippet);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  async function saveSiteUrl() {
    setSavingUrl(true);
    setUrlSaved(false);
    setError("");
    try {
      const parsed = new URL(siteUrl.trim());
      if (parsed.protocol !== "https:") throw new Error("Enter a valid HTTPS URL.");
      const response = await fetch("/api/autopilot/site", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "site_url", siteUrl: parsed.toString() }),
      });
      const body = (await response.json()) as { siteUrl?: string; error?: string };
      if (!response.ok || !body.siteUrl) throw new Error(body.error || "Could not save the site URL.");
      setSiteUrl(body.siteUrl);
      setDetails((current) => current ? { ...current, siteUrl: body.siteUrl ?? null } : current);
      setUrlSaved(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save the site URL.");
    } finally {
      setSavingUrl(false);
    }
  }

  async function rotate() {
    if (!window.confirm("Rotate this site key? Sites using the current key will stop sending events until updated.")) return;
    setRotating(true);
    setError("");
    try {
      const response = await fetch("/api/autopilot/site", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rotate" }),
      });
      const body = (await response.json()) as Pick<SiteDetails, "key" | "snippet"> & { error?: string };
      if (!response.ok) throw new Error(body.error || "Could not rotate the site key.");
      setDetails((current) => ({ ...body, eventsLast24h: current?.eventsLast24h ?? 0, siteUrl: current?.siteUrl ?? null }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not rotate the site key.");
    } finally {
      setRotating(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <header>
        <h1 className="text-lg font-semibold">Install Kismet experiments</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Paste this tag into every page of your site, before &lt;/body&gt;. Kismet then measures experiments it ships
          to your repository.
        </p>
      </header>

      {error && <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
      {!details ? (
        !error && <p className="flex items-center text-sm text-muted-foreground"><Loader2 className="mr-2 animate-spin" /> Loading…</p>
      ) : (
        <section className="space-y-4 rounded-xl border border-border bg-card p-5">
          <div className="space-y-2 border-b border-border pb-4">
            <label htmlFor="site-url" className="text-sm font-medium">Your site&apos;s URL</label>
            <p className="text-xs text-muted-foreground">Kismet uses this HTTPS address to show both experiment versions side by side.</p>
            <div className="flex gap-2">
              <input
                id="site-url"
                type="url"
                inputMode="url"
                placeholder="https://example.com"
                value={siteUrl}
                onChange={(event) => { setSiteUrl(event.target.value); setUrlSaved(false); }}
                className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-ring"
              />
              <Button size="sm" variant="outline" disabled={savingUrl} onClick={() => void saveSiteUrl()}>
                {savingUrl ? "Saving…" : urlSaved ? "Saved" : "Save"}
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium">Site script</h2>
            <Button size="sm" variant="outline" onClick={() => void copy()}>
              {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <pre className="overflow-x-auto rounded-md border border-border bg-muted/50 p-3 text-xs">
            <code>{details.snippet}</code>
          </pre>
          <p className="text-sm text-muted-foreground">
            {details.eventsLast24h > 0
              ? `${details.eventsLast24h} ${details.eventsLast24h === 1 ? "event has" : "events have"} arrived in the last 24 hours.`
              : "No events have arrived in the last 24 hours."}
          </p>
          <div className="space-y-2 border-t border-border pt-4">
            <h2 className="text-sm font-medium">Report business events</h2>
            <p className="text-xs text-muted-foreground">
              The script records page views and clicks by itself. Report outcomes it can&apos;t see, like a purchase or a sign-up,
              where they happen. Kismet can then use them as goals.
            </p>
            <pre className="overflow-x-auto rounded-md border border-border bg-muted/50 p-3 text-xs">
              <code>{`window.kismet?.track("purchase");`}</code>
            </pre>
          </div>
          <div className="space-y-2 border-t border-border pt-4">
            <h2 className="text-sm font-medium">Server SDK</h2>
            <p className="text-xs text-muted-foreground">
              For experiments in server code, like an API, pricing, or an AI prompt. It puts each visitor in the same version as
              the script does. Add{" "}
              <a className="text-brand hover:underline" href="/sdk/kismet-server.mjs" target="_blank" rel="noreferrer">kismet-server.mjs</a>{" "}
              and{" "}
              <a className="text-brand hover:underline" href="/sdk/kismet-server.d.mts" target="_blank" rel="noreferrer">kismet-server.d.mts</a>{" "}
              to your project and set <code>KISMET_SITE_KEY={details.key}</code> on the server.
            </p>
            <pre className="overflow-x-auto rounded-md border border-border bg-muted/50 p-3 text-xs">
              <code>{`import { kismet } from "./kismet-server.mjs";

const visitor = kismet.visitorFrom(request.headers.get("cookie"));
const variant = await kismet.variant("my-flag", visitor.id);
await kismet.track("purchase", visitor.id);
await kismet.flush(); // before a serverless function returns`}</code>
            </pre>
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
            <p className="text-xs text-muted-foreground">Rotate the key if it has been exposed.</p>
            <Button size="sm" variant="outline" disabled={rotating} onClick={() => void rotate()}>
              <RotateCw className={rotating ? "animate-spin" : ""} /> {rotating ? "Rotating…" : "Rotate key"}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
