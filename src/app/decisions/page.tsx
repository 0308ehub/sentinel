import { AppShell } from "@/components/layout/app-shell";
import { DecisionsView } from "@/components/decisions/decisions-view";
import { privatePage } from "@/lib/page-meta";

export const metadata = privatePage("Decisions", "Decisions recorded in this workspace.");

export default function DecisionsPage() {
  return (
    <AppShell>
      <DecisionsView />
    </AppShell>
  );
}
