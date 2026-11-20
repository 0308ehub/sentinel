import { privatePage } from "@/lib/page-meta";

export const metadata = privatePage("Connectors", "Tools connected to this workspace.");
import { ConnectorsSettingsView } from "@/components/settings/connectors-settings-view";

export default function ConnectorsSettingsPage() {
  return (
    <ConnectorsSettingsView />
  );
}
