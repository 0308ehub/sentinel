import { AppShell } from "@/components/layout/app-shell";
import { FleetPage } from "@/components/agents/fleet-page";
import { LabClock } from "@/components/lab/lab-clock";

export default function AgentsPage() {
  return (
    <AppShell>
      <LabClock><FleetPage /></LabClock>
    </AppShell>
  );
}
