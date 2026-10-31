import { AppShell } from "@/components/layout/app-shell";
import { FleetPage } from "@/components/agents/fleet-page";

export default function AgentsPage() {
  return (
    <AppShell>
      <FleetPage />
    </AppShell>
  );
}
