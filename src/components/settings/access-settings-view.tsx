"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsShell } from "@/components/settings/settings-shell";
import { Saved, ToggleRow, useSavedFlag } from "@/components/settings/settings-form";
import { Button } from "@/components/ui/button";
import { updateWorkspace, useWorkspaceSettings } from "@/lib/settings/workspace";

export function AccessSettingsView() {
  const settings = useWorkspaceSettings();
  const clerk = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  const [domain, setDomain] = useState(settings.allowedDomain);
  const [sourceDomain, setSourceDomain] = useState(settings.allowedDomain);
  const [saved, markSaved] = useSavedFlag();

  if (settings.allowedDomain !== sourceDomain) {
    setSourceDomain(settings.allowedDomain);
    setDomain(settings.allowedDomain);
  }

  function saveDomain() {
    updateWorkspace({ allowedDomain: domain.trim().replace(/^@/, "") });
    markSaved();
  }

  return (
    <SettingsShell title="Access & SSO" description="Who can join, and how they sign in">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Sign-in</CardTitle>
            <CardDescription>
              {clerk
                ? "This workspace signs in with Clerk. SSO, just-in-time provisioning, and the allowed domain are saved here and applied once the identity provider is connected in Clerk."
                : "Sign-in is open until a Clerk publishable key is set. These rules are saved for when an identity provider is connected."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-0 divide-y divide-border p-0">
            <ToggleRow
              title="Require SSO"
              description="People sign in through the identity provider. Turn this on after SSO works."
              checked={settings.requireSso}
              onCheckedChange={(requireSso) => updateWorkspace({ requireSso })}
            />
            <ToggleRow
              title="Just-in-time provisioning"
              description="A person who signs in with the identity provider joins the organization."
              checked={settings.jit}
              onCheckedChange={(jit) => updateWorkspace({ jit })}
            />
            <ToggleRow
              title="Allow access requests"
              description="Someone with a work email can ask to join from the sign-in page."
              checked={settings.accessRequests}
              onCheckedChange={(accessRequests) => updateWorkspace({ accessRequests })}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Allowed email domain</CardTitle>
            <CardDescription>Invites and access requests use this domain when it is set.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="allowed-domain">Domain</Label>
              <Input
                id="allowed-domain"
                value={domain}
                placeholder="company.com"
                onChange={(event) => setDomain(event.target.value)}
                className="h-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" onClick={saveDomain}>
                Save domain
              </Button>
              <Saved show={saved} />
            </div>
          </CardContent>
        </Card>
      </div>
    </SettingsShell>
  );
}
