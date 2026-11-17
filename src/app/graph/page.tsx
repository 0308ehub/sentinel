import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { GraphView } from "@/components/graph/graph-view";
import { Skeleton } from "@/components/ui/skeleton";
import { privatePage } from "@/lib/page-meta";

export const metadata = privatePage("Graph", "How the product pieces connect.");

export default function GraphPage() {
  return (
    <AppShell>
      <Suspense fallback={<Skeleton className="h-full w-full" />}>
        <GraphView />
      </Suspense>
    </AppShell>
  );
}
