import { AppShell } from "@/components/layout/app-shell";
import { GeneralSettingsView } from "@/components/settings/general-settings-view";

export default function SettingsPage() {
  return (
    <AppShell>
      <GeneralSettingsView />
    </AppShell>
  );
}
