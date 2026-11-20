import { AutopilotView } from "@/components/autopilot/autopilot-view";
import { privatePage } from "@/lib/page-meta";

export const metadata = privatePage("Dashboard", "Suggestions Kismet is ready to ship.");

export default function AutopilotPage() {
  return (
    <AutopilotView />
  );
}
