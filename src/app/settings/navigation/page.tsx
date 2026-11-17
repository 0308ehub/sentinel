import { AppShell } from "@/components/layout/app-shell";
import { privatePage } from "@/lib/page-meta";

export const metadata = privatePage("Navigation", "Which pages show in the sidebar.");
import { NavigationSettingsView } from "@/components/settings/navigation-settings-view";

export default function NavigationSettingsPage() {
  return (
    <AppShell>
      <NavigationSettingsView />
    </AppShell>
  );
}
