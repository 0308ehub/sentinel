import { AppShell } from "@/components/layout/app-shell";
import { ExperimentList } from "@/components/lab/experiment-list";

export default function ExperimentsPage() {
  return (
    <AppShell>
      <ExperimentList />
    </AppShell>
  );
}
