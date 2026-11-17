import { AppShell } from "@/components/layout/app-shell";
import { privatePage } from "@/lib/page-meta";

export const metadata = privatePage("Usage", "How this workspace is using Kismet.");
import { UsageReportsView } from "@/components/settings/usage-reports-view";

export default function UsageReportsPage() {
  return (
    <AppShell>
      <UsageReportsView />
    </AppShell>
  );
}
