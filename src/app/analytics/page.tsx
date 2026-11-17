import { AppShell } from "@/components/layout/app-shell";
import { AnalyticsView } from "@/components/analytics/analytics-view";
import { privatePage } from "@/lib/page-meta";

export const metadata = privatePage("Analytics", "Boards, funnels, and queries for this workspace.");

export default function AnalyticsPage() {
  return (
    <AppShell>
      <AnalyticsView />
    </AppShell>
  );
}
