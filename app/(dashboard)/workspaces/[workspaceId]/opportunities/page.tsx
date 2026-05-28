import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { GenerateOpportunitiesButton } from "./generate-button";
import { OpportunitiesClient } from "./opportunities-client";
import { cn } from "@/lib/utils";

type SortKey = "totalScore" | "impactScore" | "urgencyScore";

export default async function OpportunitiesPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{ sort?: string }>;
}) {
  const { workspaceId } = await params;
  const { sort } = await searchParams;

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

  const opportunities = await prisma.opportunity.findMany({
    where: { workspaceId },
    orderBy: { [sortKey]: "desc" },
  });

  const sortLinks: { label: string; key: string }[] = [
    { label: "Total Score", key: "total" },
    { label: "Impact", key: "impact" },
    { label: "Urgency", key: "urgency" },
  ];

  const activeSort = sort ?? "total";

  return (
    <div>

      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Opportunities</h1>
            <p className="text-sm text-gray-500 mt-1">
              {opportunities.length} ranked opportunities
            </p>
          </div>
          <GenerateOpportunitiesButton workspaceId={workspaceId} />
        </div>

        {/* Sort controls */}
        <div className="flex items-center gap-2 mb-6">
          <span className="text-xs font-medium text-gray-500 mr-1">Sort by:</span>
          {sortLinks.map(({ label, key }) => (
            <Link
              key={key}
              href={`/workspaces/${workspaceId}/opportunities?sort=${key}`}
            >
              <button
                className={cn(
                  "text-xs px-3 py-1.5 rounded-full border font-medium transition-colors",
                  activeSort === key
                    ? "bg-violet-600 text-white border-violet-600"
                    : "bg-white text-gray-600 border-gray-200 hover:border-violet-300 hover:text-violet-700"
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
