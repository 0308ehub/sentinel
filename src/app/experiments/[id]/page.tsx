import { AppShell } from "@/components/layout/app-shell";
import { ExperimentRouter } from "@/components/lab/experiment-router";

export default async function ExperimentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AppShell>
      <ExperimentRouter id={id} />
    </AppShell>
  );
}
