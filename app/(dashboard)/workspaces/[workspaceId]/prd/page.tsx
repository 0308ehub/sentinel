import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { redirect } from "next/navigation";
import { GeneratePRDForm } from "./generate-prd-form";
import { PRDListClient } from "./prd-list-client";

export default async function PRDListPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{ opportunityId?: string }>;
}) {
  const { workspaceId } = await params;
  const { opportunityId } = await searchParams;

  try {
    await requireWorkspaceAccess(workspaceId);
  } catch {
    redirect("/sign-in");
  }

  const [prds, opportunities] = await Promise.all([
    prisma.pRD.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      include: {
        opportunity: { select: { id: true, title: true } },
        _count: { select: { tickets: true } },
      },
    }),
    prisma.opportunity.findMany({
      where: { workspaceId },
      orderBy: { totalScore: "desc" },
      select: { id: true, title: true },
    }),
  ]);

  return (
    <div>

      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">PRDs</h1>
            <p className="text-sm text-gray-500 mt-1">
              {prds.length} product requirement document{prds.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Generate PRD form */}
          <div className="lg:col-span-2">
            <GeneratePRDForm
              workspaceId={workspaceId}
              opportunities={opportunities}
              defaultOpportunityId={opportunityId}
            />
          </div>

          {/* Existing PRDs */}
          <div className="lg:col-span-3">
            <h2 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">
              Existing PRDs
            </h2>

            <PRDListClient
              workspaceId={workspaceId}
              initialPRDs={prds.map((p) => ({
                id: p.id,
                title: p.title,
                createdAt: p.createdAt.toISOString(),
                opportunity: p.opportunity,
                _count: p._count,
              }))}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
