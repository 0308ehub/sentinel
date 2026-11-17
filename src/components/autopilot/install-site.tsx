"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Loader2, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SiteDetails {
  key: string;
  snippet: string;
  eventsLast24h: number;
}

export function InstallSite() {
  const [details, setDetails] = useState<SiteDetails | null>(null);
  const [copied, setCopied] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/autopilot/site", { cache: "no-store" })
      .then(async (response) => {
        const body = (await response.json()) as SiteDetails & { error?: string };
        if (!response.ok) throw new Error(body.error || "Could not load the site SDK.");
        setDetails(body);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Could not load the site SDK."));
  }, []);

  async function copy() {
    if (!details) return;
    await navigator.clipboard.writeText(details.snippet);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
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
      setDetails((current) => ({ ...body, eventsLast24h: current?.eventsLast24h ?? 0 }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not rotate the site key.");
    } finally {
      setRotating(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <header>
        <h1 className="text-lg font-semibold">Install Autopilot</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Paste this tag into every page of your site, before &lt;/body&gt;. Autopilot then measures experiments it ships
          to your repository.
        </p>
      </header>

      {error && <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
      {!details ? (
        !error && <p className="flex items-center text-sm text-muted-foreground"><Loader2 className="mr-2 animate-spin" /> Loading…</p>
      ) : (
        <section className="space-y-4 rounded-xl border border-border bg-card p-5">
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
