import { AppShell } from "@/components/layout/app-shell";
import { AIWorkspaceView } from "@/components/ai/ai-workspace-view";

export default function AIPage() {
  return (
    <AppShell header={false}>
      <AIWorkspaceView />
    </AppShell>
  );
}
