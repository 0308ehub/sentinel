import { privatePage } from "@/lib/page-meta";

export const metadata = privatePage("Access", "Who can open this workspace.");
import { AccessSettingsView } from "@/components/settings/access-settings-view";

export default function AccessSettingsPage() {
  return (
    <AccessSettingsView />
  );
}
