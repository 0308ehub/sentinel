import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { GraphView } from "@/components/graph/graph-view";
import { Skeleton } from "@/components/ui/skeleton";

export default function GraphPage() {
  return (
    <AppShell>
      <Suspense fallback={<Skeleton className="h-full w-full" />}>
        <GraphView />
      </Suspense>
    </AppShell>
  );
}
