import { privatePage } from "@/lib/page-meta";

export const metadata = privatePage("Jira", "Jira connected to this workspace.");
import { JiraIssuesView } from "@/components/settings/jira-issues-view";

export default function JiraSettingsPage() {
  return (
    <JiraIssuesView />
  );
}
