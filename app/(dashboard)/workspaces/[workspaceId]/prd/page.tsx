import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Ticket } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { GeneratePRDForm } from "./generate-prd-form";

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

            {prds.length === 0 ? (
              <div className="bg-white rounded-xl border border-dashed p-12 text-center">
                <FileText className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-500">
                  No PRDs yet. Generate your first one using the form.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {prds.map((prd) => (
                  <Link
                    key={prd.id}
                    href={`/workspaces/${workspaceId}/prd/${prd.id}`}
                  >
                    <Card className="bg-white hover:border-violet-300 hover:shadow-sm transition-all cursor-pointer">
                      <CardHeader className="pb-0">
                        <div className="flex items-start justify-between gap-3">
                          <CardTitle className="text-sm text-gray-900 leading-snug">
                            {prd.title}
                          </CardTitle>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {prd._count.tickets > 0 && (
                              <Badge variant="secondary" className="text-xs gap-1">
                                <Ticket className="h-3 w-3" />
                                {prd._count.tickets} ticket{prd._count.tickets !== 1 ? "s" : ""}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-2">
                        {prd.opportunity && (
                          <p className="text-xs text-violet-600 font-medium mb-1.5 flex items-center gap-1">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-violet-400" />
                            {prd.opportunity.title}
                          </p>
                        )}
                        <p className="text-xs text-gray-400">
                          Created {formatDate(prd.createdAt)}
                        </p>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
