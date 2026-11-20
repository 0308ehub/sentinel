import { privatePage } from "@/lib/page-meta";

export const metadata = privatePage("Retention", "How long workspace data is kept.");
import { RetentionSettingsView } from "@/components/settings/retention-settings-view";

export default function RetentionSettingsPage() {
  return (
    <RetentionSettingsView />
  );
}
