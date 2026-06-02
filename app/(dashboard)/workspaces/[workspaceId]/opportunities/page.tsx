import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { GenerateOpportunitiesButton } from "./generate-button";
import { OpportunitiesClient } from "./opportunities-client";
import { cn } from "@/lib/utils";

type SortKey = "totalScore" | "impactScore" | "urgencyScore";
type StatusFilter = "all" | "PROPOSED" | "ACCEPTED" | "IN_PROGRESS" | "SHIPPED" | "REJECTED";

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: "All",
  PROPOSED: "Proposed",
  ACCEPTED: "Accepted",
  IN_PROGRESS: "In Progress",
  SHIPPED: "Shipped",
  REJECTED: "Rejected",
};

export default async function OpportunitiesPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{ sort?: string; status?: string }>;
}) {
  const { workspaceId } = await params;
  const { sort, status } = await searchParams;

  try {
    await requireWorkspaceAccess(workspaceId);
  } catch {
    redirect("/sign-in");
  }

  const sortKey: SortKey =
    sort === "impact"
      ? "impactScore"
      : sort === "urgency"
        ? "urgencyScore"
        : "totalScore";

  const statusFilter = (status as StatusFilter) ?? "all";
  const whereStatus = statusFilter !== "all" ? { status: statusFilter } : {};

  const [opportunities, statusCounts] = await Promise.all([
    prisma.opportunity.findMany({
      where: { workspaceId, ...whereStatus },
      orderBy: { [sortKey]: "desc" },
    }),
    prisma.opportunity.groupBy({
      by: ["status"],
      where: { workspaceId },
      _count: true,
    }),
  ]);

  const countByStatus: Record<string, number> = { all: 0 };
  for (const row of statusCounts) {
    countByStatus[row.status] = row._count;
    countByStatus.all = (countByStatus.all ?? 0) + row._count;
  }

  const sortLinks: { label: string; key: string }[] = [
    { label: "Total Score", key: "total" },
    { label: "Impact", key: "impact" },
    { label: "Urgency", key: "urgency" },
  ];

  const activeSort = sort ?? "total";
  const statusTabs: StatusFilter[] = ["all", "PROPOSED", "ACCEPTED", "IN_PROGRESS", "SHIPPED", "REJECTED"];

  return (
    <div>

      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Opportunities</h1>
            <p className="text-sm text-gray-500 mt-1">
              {opportunities.length} {statusFilter !== "all" ? STATUS_LABELS[statusFilter].toLowerCase() : "ranked"} opportunities
            </p>
          </div>
          <GenerateOpportunitiesButton workspaceId={workspaceId} />
        </div>

        {/* Status pipeline tabs */}
        <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {statusTabs.map((s) => {
            const count = countByStatus[s] ?? 0;
            const isActive = statusFilter === s;
            const href = s === "all"
              ? `/workspaces/${workspaceId}/opportunities?sort=${activeSort}`
              : `/workspaces/${workspaceId}/opportunities?sort=${activeSort}&status=${s}`;
            if (s !== "all" && count === 0) return null;
            return (
              <Link key={s} href={href}>
                <button className={cn(
                  "text-xs px-3 py-1.5 rounded-full border font-medium transition-colors whitespace-nowrap flex items-center gap-1.5",
                  isActive
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-700"
                )}>
                  {STATUS_LABELS[s]}
                  {count > 0 && <span className={cn("text-[10px] font-bold rounded-full px-1", isActive ? "bg-white/20" : "bg-gray-100 text-gray-500")}>{count}</span>}
                </button>
              </Link>
            );
          })}
        </div>

        {/* Sort controls */}
        <div className="flex items-center gap-2 mb-6">
          <span className="text-xs font-medium text-gray-500 mr-1">Sort by:</span>
          {sortLinks.map(({ label, key }) => (
            <Link
              key={key}
              href={`/workspaces/${workspaceId}/opportunities?sort=${key}${statusFilter !== "all" ? `&status=${statusFilter}` : ""}`}
            >
              <button
                className={cn(
                  "text-xs px-3 py-1.5 rounded-full border font-medium transition-colors",
                  activeSort === key
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-700"
                )}
              >
                {label}
              </button>
            </Link>
          ))}
        </div>

        <OpportunitiesClient
          initialOpportunities={opportunities}
          workspaceId={workspaceId}
        />
      </div>
    </div>
  );
}
