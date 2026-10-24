import { AppShell } from "@/components/layout/app-shell";
import { ConnectorsSettingsView } from "@/components/settings/connectors-settings-view";

export default function ConnectorsSettingsPage() {
  return (
    <AppShell>
      <ConnectorsSettingsView />
    </AppShell>
  );
}
