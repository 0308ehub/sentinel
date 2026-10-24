"use client";

import { ConnectorCatalog } from "@/components/connectors/connector-catalog";
import { SettingsShell } from "@/components/settings/settings-shell";

export function ConnectorsSettingsView() {
  return (
    <SettingsShell
      title="Connected apps"
      description="Connect the tools the company already uses. Kismet asks for the URL or key each one needs, then files what that source produces onto the product graph."
    >
      <ConnectorCatalog />
    </SettingsShell>
  );
}
