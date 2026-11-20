import { privatePage } from "@/lib/page-meta";

export const metadata = privatePage("Agent settings", "How agents behave in this workspace.");
import { InboxSettingsView } from "@/components/inbox/inbox-settings-view";

export default function AgentsSettingsPage() {
  return (
    <InboxSettingsView />
  );
}
