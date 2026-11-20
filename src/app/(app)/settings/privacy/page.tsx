import { privatePage } from "@/lib/page-meta";

export const metadata = privatePage("Privacy settings", "Privacy controls for this workspace.");
import { PrivacySettingsView } from "@/components/settings/privacy-settings-view";

export default function PrivacySettingsPage() {
  return (
    <PrivacySettingsView />
  );
}
