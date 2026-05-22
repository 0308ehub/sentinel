import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart2, FileText } from "lucide-react";
import { SummaryGenerator } from "./summary-generator";
import { CopyButton } from "./copy-button";
import type { ProductEvent } from "@prisma/client";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}

function audienceBadgeClass(audience: string) {
  switch (audience) {
    case "Leadership":
      return "bg-violet-100 text-violet-700 border-violet-200";
    case "Engineering":
      return "bg-blue-100 text-blue-700 border-blue-200";
    case "Board":
      return "bg-amber-100 text-amber-700 border-amber-200";
    case "Investors":
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

export default async function ReportsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;

  try {
    await requireWorkspaceAccess(workspaceId);
  } catch {
    redirect("/sign-in");
  }

  const summaries = await prisma.productEvent.findMany({
    where: {
      workspaceId,
      event: "EXECUTIVE_SUMMARY",
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>

      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart2 className="h-6 w-6 text-violet-600" />
            Executive Reports
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Generate AI-powered executive summaries from your product discovery data.
          </p>
        </div>

        {/* Generator section */}
        <div className="mb-10">
          <SummaryGenerator workspaceId={workspaceId} />
        </div>

        {/* Previous summaries */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FileText className="h-4 w-4 text-gray-400" />
            Previous Summaries
            <span className="ml-1 text-sm font-normal text-gray-400">
              ({summaries.length})
            </span>
          </h2>

          {summaries.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed p-16 text-center">
              <BarChart2 className="h-10 w-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-500 max-w-sm mx-auto">
                No summaries generated yet. Use the form above to create your first executive summary.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {summaries.map((event: ProductEvent) => {
                const props = event.properties as {
                  audience?: string;
                  timeframe?: string;
                  summary?: string;
                } | null;
                const audience = props?.audience ?? "Unknown";
                const timeframe = props?.timeframe ?? "Unknown";
                const summary = props?.summary ?? "";

                return (
                  <Card key={event.id} className="bg-white">
                    <CardHeader className="pb-3 border-b">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <CardTitle className="text-base text-gray-900 mb-1">
                            Executive Summary — {audience}
                          </CardTitle>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${audienceBadgeClass(audience)}`}
                            >
                              {audience}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {timeframe}
                            </Badge>
                            <span className="text-xs text-gray-400">
                              {formatDate(event.createdAt)}
                            </span>
                          </div>
                        </div>
                        <CopyButton text={summary} />
                      </div>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap leading-relaxed text-sm">
                        {summary}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
