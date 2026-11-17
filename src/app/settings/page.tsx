import { AppShell } from "@/components/layout/app-shell";
import { GeneralSettingsView } from "@/components/settings/general-settings-view";
import { privatePage } from "@/lib/page-meta";

export const metadata = privatePage("Settings", "Workspace settings.");

export default function SettingsPage() {
  return (
    <AppShell>
      <GeneralSettingsView />
    </AppShell>
  );
}
