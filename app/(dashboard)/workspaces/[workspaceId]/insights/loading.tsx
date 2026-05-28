import { Skeleton } from "@/components/ui/skeleton";

function InsightCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border p-4 animate-pulse">
      <div className="flex items-start justify-between gap-3 mb-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-5 w-10 rounded-full shrink-0" />
      </div>
      <Skeleton className="h-3 w-full mb-1.5" />
      <Skeleton className="h-3 w-5/6 mb-4" />
      <div className="space-y-1">
        <Skeleton className="h-1.5 w-full rounded-full" />
      </div>
    </div>
  );
}

export default function InsightsLoading() {
  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div className="space-y-2">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-4 w-52" />
        </div>
        <Skeleton className="h-9 w-44 rounded-lg" />
      </div>

      {/* Tab strip */}
      <div className="flex items-center gap-6 border-b border-gray-200 mb-6 pb-px">
        {["Pain Points", "Feature Requests", "Segments", "Workflow Issues", "Competitors", "Quotes"].map((label) => (
          <Skeleton key={label} className="h-4 w-20" />
        ))}
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <InsightCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
