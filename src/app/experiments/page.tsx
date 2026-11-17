import { AppShell } from "@/components/layout/app-shell";
import { GraphExperimentsPage } from "@/components/experiments/graph-experiments-page";
import { ExperimentList } from "@/components/lab/experiment-list";
import { labDemoEnabled } from "@/lib/lab/demo-mode";
import { privatePage } from "@/lib/page-meta";

export const metadata = privatePage("Experiments", "Experiments in this workspace.");

export default function ExperimentsPage() {
  if (!labDemoEnabled()) return <GraphExperimentsPage />;
  return (
    <AppShell>
      <ExperimentList />
    </AppShell>
  );
}
