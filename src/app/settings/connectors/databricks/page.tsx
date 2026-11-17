import { AppShell } from "@/components/layout/app-shell";
import { privatePage } from "@/lib/page-meta";

export const metadata = privatePage("Databricks", "Databricks connected to this workspace.");
import { DatabricksView } from "@/components/settings/databricks-view";

export default function DatabricksSettingsPage() {
  return (
    <AppShell>
      <DatabricksView />
    </AppShell>
  );
}
