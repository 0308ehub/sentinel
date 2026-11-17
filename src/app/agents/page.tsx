import { AppShell } from "@/components/layout/app-shell";
import { InboxView } from "@/components/inbox/inbox-view";
import { privatePage } from "@/lib/page-meta";

export const metadata = privatePage("Agents", "Messages from the agents in this workspace.");

export default function AgentsPage() {
  return (
    <AppShell header={false}>
      <InboxView />
    </AppShell>
  );
}
