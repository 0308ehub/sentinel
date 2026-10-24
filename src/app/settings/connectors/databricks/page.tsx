import { AppShell } from "@/components/layout/app-shell";
import { DatabricksView } from "@/components/settings/databricks-view";

export default function DatabricksSettingsPage() {
  return (
    <AppShell>
      <DatabricksView />
    </AppShell>
  );
}
