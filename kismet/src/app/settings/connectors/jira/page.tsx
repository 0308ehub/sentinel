import { AppShell } from "@/components/layout/app-shell";
import { JiraIssuesView } from "@/components/settings/jira-issues-view";

export default function JiraSettingsPage() {
  return (
    <AppShell>
      <JiraIssuesView />
    </AppShell>
  );
}
