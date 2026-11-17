import { AppShell } from "@/components/layout/app-shell";
import { privatePage } from "@/lib/page-meta";

export const metadata = privatePage("Year", "A look back at the year in this workspace.");
import { YearReviewView } from "@/components/settings/year-review-view";

export default function YearReviewPage() {
  return (
    <AppShell>
      <YearReviewView />
    </AppShell>
  );
}
