import { AppShell } from "@/components/layout/app-shell";
import { privatePage } from "@/lib/page-meta";

export const metadata = privatePage("Notifications", "What this workspace tells you about.");
import { NotificationsSettingsView } from "@/components/settings/notifications-settings-view";

export default function NotificationsSettingsPage() {
  return (
    <AppShell>
      <NotificationsSettingsView />
    </AppShell>
  );
}
