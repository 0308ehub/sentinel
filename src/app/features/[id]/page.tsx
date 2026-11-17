import { AppShell } from "@/components/layout/app-shell";
import { FeatureWorkspaceView } from "@/components/feature-workspace/feature-workspace-view";
import { privatePage } from "@/lib/page-meta";

export const metadata = privatePage("Feature", "One feature in this workspace.");

export default function FeaturePage() {
  return (
    <AppShell>
      <FeatureWorkspaceView />
    </AppShell>
  );
}
