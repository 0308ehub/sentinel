import { AppShell } from "@/components/layout/app-shell";
import { ExplorerView } from "@/components/explorer/explorer-view";
import { privatePage } from "@/lib/page-meta";

export const metadata = privatePage("Explorer", "Look through the sources connected to this workspace.");

export default function ExplorerPage() {
  return (
    <AppShell>
      <ExplorerView />
    </AppShell>
  );
}
