import { Skeleton } from "@/components/ui/skeleton";

function OpportunityCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border p-5 animate-pulse">
      <div className="flex items-start gap-4">
        <div className="w-8 h-8 rounded-full bg-gray-100 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
            </div>
            <Skeleton className="h-14 w-[72px] rounded-xl shrink-0" />
          </div>
          <div className="mt-4 space-y-1.5">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </div>
          <div className="flex gap-4 mt-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-10 rounded" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OpportunitiesLoading() {
  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div className="space-y-2">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-36" />
        </div>
        <Skeleton className="h-9 w-48 rounded-lg" />
      </div>

      {/* Sort controls */}
      <div className="flex items-center gap-2 mb-6">
        <Skeleton className="h-4 w-12" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-7 w-24 rounded-full" />
        ))}
      </div>

      <div className="space-y-4">
        {[0, 1, 2, 3].map((i) => (
          <OpportunityCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
