"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsShell } from "@/components/settings/settings-shell";
import { Saved, useSavedFlag } from "@/components/settings/settings-form";
import { ORG } from "@/lib/settings";
import { updateWorkspace, useWorkspaceSettings } from "@/lib/settings/workspace";

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input value={value} readOnly className="h-9 font-mono text-xs" />
        <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={copy}>
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  );
}

export function GeneralSettingsView() {
  const settings = useWorkspaceSettings();
  const [orgName, setOrgName] = useState(settings.orgName);
  const [orgUrl, setOrgUrl] = useState(settings.orgUrl);
  const [saved, markSaved] = useSavedFlag();

  useEffect(() => {
    setOrgName(settings.orgName);
    setOrgUrl(settings.orgUrl);
  }, [settings.orgName, settings.orgUrl]);

  function handleSave(event: FormEvent) {
    event.preventDefault();
    updateWorkspace({
      orgName: orgName.trim() || ORG.name,
      orgUrl: orgUrl.trim() || ORG.url,
    });
    markSaved();
  }

  return (
    <SettingsShell title="General" description="Organization name, URL, and plan">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Organization</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="org-name">Organization name</Label>
                <Input id="org-name" value={orgName} onChange={(event) => setOrgName(event.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="org-url">Organization URL</Label>
                <div className="flex items-center">
                  <span className="flex h-9 items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-xs text-muted-foreground">
                    https://
                  </span>
                  <Input
                    id="org-url"
                    value={orgUrl}
                    onChange={(event) => setOrgUrl(event.target.value)}
                    className="h-9 rounded-l-none"
                  />
                </div>
              </div>
              <CopyField label="Organization ID" value={ORG.id} />
              <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/40 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{ORG.plan} plan</span>
                  <Badge variant="success">Active</Badge>
                </div>
                <Link href="/settings/billing" className="text-xs font-medium text-primary hover:underline">
                  Plan & billing
                </Link>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Button type="submit" size="sm">
                  Save changes
                </Button>
                <Saved show={saved} />
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </SettingsShell>
  );
}
