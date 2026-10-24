"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Copy, Check, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SettingsShell } from "@/components/settings/settings-shell";
import { ORG, ORG_PROJECTS } from "@/lib/settings";
import { applyTheme, readTheme, type ThemeName } from "@/lib/theme";

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
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
  const [orgName, setOrgName] = useState(ORG.name);
  const [orgUrl, setOrgUrl] = useState(ORG.url);
  const [saved, setSaved] = useState(false);
  const [theme, setTheme] = useState<ThemeName>("light");

  useEffect(() => {
    setTheme(readTheme());
  }, []);

  function chooseTheme(next: ThemeName) {
    setTheme(next);
    applyTheme(next);
  }

  function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <SettingsShell
      title="General"
      description="Organization details, subscription, and projects"
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>Light or dark. The choice stays in this browser.</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button type="button" size="sm" variant={theme === "light" ? "default" : "outline"} onClick={() => chooseTheme("light")}>
              <Sun className="h-3.5 w-3.5" />
              Light
            </Button>
            <Button type="button" size="sm" variant={theme === "dark" ? "default" : "outline"} onClick={() => chooseTheme("dark")}>
              <Moon className="h-3.5 w-3.5" />
              Dark
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Organization</CardTitle>
            <CardDescription>How your company appears across Kismet</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="org-name">Organization name</Label>
                <Input
                  id="org-name"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="org-url">Organization URL</Label>
                <div className="flex items-center gap-0">
                  <span className="flex h-9 items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-xs text-muted-foreground">
                    https://
                  </span>
                  <Input
                    id="org-url"
                    value={orgUrl}
                    onChange={(e) => setOrgUrl(e.target.value)}
                    className="h-9 rounded-l-none"
                  />
                </div>
              </div>
              <CopyField label="Organization ID" value={ORG.id} />
              <div className="flex items-center gap-2 pt-1">
                <Button type="submit" size="sm">
                  Save changes
                </Button>
                {saved && <span className="text-xs text-muted-foreground">Saved</span>}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Subscription</CardTitle>
            <CardDescription>Plan and seat usage for this organization</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2.5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{ORG.plan} plan</span>
                  <Badge variant="success">Active</Badge>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Renews {new Date(ORG.planRenewsAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
              <Button variant="outline" size="sm" type="button">
                Manage billing
              </Button>
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Seats used</span>
                <span className="font-medium">
                  {ORG.seatsUsed} / {ORG.seats}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${(ORG.seatsUsed / ORG.seats) * 100}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Projects</CardTitle>
            <CardDescription>Products in this organization</CardDescription>
          </CardHeader>
          <CardContent className="space-y-0 divide-y divide-border p-0">
            {ORG_PROJECTS.map((project) => (
              <div key={project.id} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{project.name}</span>
                    <Badge variant={project.status === "active" ? "success" : "muted"}>
                      {project.status}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{project.description}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {project.members} members
                </span>
              </div>
            ))}
            <Separator />
            <div className="px-4 py-3">
              <Button variant="outline" size="sm" type="button">
                Add project
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </SettingsShell>
  );
}
