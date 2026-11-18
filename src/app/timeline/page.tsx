import { AppShell } from "@/components/layout/app-shell";
import { TimelineView } from "@/components/timeline/timeline-view";
import { privatePage } from "@/lib/page-meta";

export const metadata = privatePage("Timeline", "Experiments shipping across the year.");

export default function TimelinePage() {
  return (
    <AppShell>
      <TimelineView />
    </AppShell>
  );
}
