"use client";

import { CreateOrganization, OrganizationProfile, useOrganization } from "@clerk/nextjs";
import { SettingsShell } from "@/components/settings/settings-shell";

export function MembersSettingsView() {
  const { organization, isLoaded } = useOrganization();
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return <SettingsShell wide title="Members" description="Enable Clerk Organizations to manage a shared workspace."><div /></SettingsShell>;
  }
  return (
    <SettingsShell wide title="Members" description="People, invites, and roles">
      {!isLoaded ? null : organization ? (
        <OrganizationProfile routing="hash" appearance={{ elements: { rootBox: "w-full", cardBox: "w-full shadow-none" } }} />
      ) : (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Create a shared workspace</h2>
            <p className="text-sm text-muted-foreground">Everything in Kismet except chat is shared with workspace members.</p>
          </div>
          <CreateOrganization routing="hash" afterCreateOrganizationUrl="/settings/members" />
        </div>
      )}
    </SettingsShell>
  );
}
