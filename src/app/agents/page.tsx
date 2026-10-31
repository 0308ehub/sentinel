import { AppShell } from "@/components/layout/app-shell";
import { FleetPage } from "@/components/agents/fleet-page";
import { LabClock } from "@/components/lab/lab-clock";
import { labDemoEnabled } from "@/lib/lab/demo-mode";

export default function AgentsPage() {
  if (!labDemoEnabled()) {
    return (
      <AppShell>
        <FleetPage showLoop={false} />
      </AppShell>
    );
  }
  return (
    <AppShell>
      <LabClock>
        <FleetPage showLoop />
      </LabClock>
    </AppShell>
  );
}
