import { AppShell } from "@/components/layout/app-shell";
import { ExperimentRouter } from "@/components/lab/experiment-router";
import { ExperimentDetail } from "@/components/work/experiment-detail";
import { labDemoEnabled } from "@/lib/lab/demo-mode";

export default async function ExperimentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AppShell>{labDemoEnabled() ? <ExperimentRouter id={id} /> : <ExperimentDetail />}</AppShell>;
}
