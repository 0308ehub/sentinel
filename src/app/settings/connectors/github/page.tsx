import { AppShell } from "@/components/layout/app-shell";
import { privatePage } from "@/lib/page-meta";

export const metadata = privatePage("GitHub", "GitHub connected to this workspace.");
import { GitHubView } from "@/components/settings/github-view";

export default function GitHubSettingsPage() {
  return (
    <AppShell>
      <GitHubView />
    </AppShell>
  );
}
