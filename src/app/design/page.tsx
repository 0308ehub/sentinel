import { AppShell } from "@/components/layout/app-shell";
import { DesignView } from "@/components/design/design-view";
import { privatePage } from "@/lib/page-meta";

export const metadata = privatePage("Design", "A canvas for trying a screen before it ships. Alpha.");

export default function DesignPage() {
  return (
    <AppShell>
      <DesignView />
    </AppShell>
  );
}
