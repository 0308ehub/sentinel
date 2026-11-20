import { privatePage } from "@/lib/page-meta";

export const metadata = privatePage("Security", "Security settings for this workspace.");
import { SecuritySettingsView } from "@/components/settings/security-settings-view";

export default function SecuritySettingsPage() {
  return (
    <SecuritySettingsView />
  );
}
