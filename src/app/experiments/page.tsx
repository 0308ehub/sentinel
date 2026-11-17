import { AppShell } from "@/components/layout/app-shell";
import { AutopilotView } from "@/components/autopilot/autopilot-view";
import { privatePage } from "@/lib/page-meta";

export const metadata = privatePage("Experiments", "Work the agents are ready to take on.");

export default function AutopilotPage() {
  return (
    <AppShell>
      <AutopilotView />
    </AppShell>
  );
}
