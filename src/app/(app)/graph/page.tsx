import { Suspense } from "react";
import { GraphView } from "@/components/graph/graph-view";
import { Skeleton } from "@/components/ui/skeleton";
import { privatePage } from "@/lib/page-meta";

export const metadata = privatePage("Graph", "How the product pieces connect.");

export default function GraphPage() {
  return (
    <Suspense fallback={<Skeleton className="h-full w-full" />}>
      <GraphView />
    </Suspense>
  );
}
