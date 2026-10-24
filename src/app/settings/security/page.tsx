import { AppShell } from "@/components/layout/app-shell";
import { SecuritySettingsView } from "@/components/settings/security-settings-view";

export default function SecuritySettingsPage() {
  return (
    <AppShell>
      <SecuritySettingsView />
    </AppShell>
  );
}
