import { AppShell } from "@/components/layout/app-shell";
import { privatePage } from "@/lib/page-meta";

export const metadata = privatePage("Members", "People in this workspace.");
import { MembersSettingsView } from "@/components/settings/members-settings-view";

export default function MembersSettingsPage() {
  return (
    <AppShell>
      <MembersSettingsView />
    </AppShell>
  );
}
