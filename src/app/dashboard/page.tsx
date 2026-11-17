import { AppShell } from "@/components/layout/app-shell";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { privatePage } from "@/lib/page-meta";

export const metadata = privatePage("Dashboard", "What is happening across the workspace.");

export default function DashboardPage() {
  return (
    <AppShell>
      <DashboardView />
    </AppShell>
  );
}
