import { InstallSite } from "@/components/autopilot/install-site";
import { AppShell } from "@/components/layout/app-shell";
import { privatePage } from "@/lib/page-meta";

export const metadata = privatePage("Install Autopilot", "Run Autopilot experiments on your site.");

export default function InstallAutopilotPage() {
  return (
    <AppShell>
      <InstallSite />
    </AppShell>
  );
}
