import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Lightbulb, Target, Upload, MessageSquare, ChevronRight } from "lucide-react";
import { WorkspaceNameEditor } from "./workspace-name-editor";
import { formatDate, scoreToColor } from "@/lib/utils";

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;

  let workspace, user;
  try {
    ({ workspace, user } = await requireWorkspaceAccess(workspaceId));
  } catch {
    redirect("/sign-in");
  }

  const [documents, painPoints, opportunities, recentDocs] = await Promise.all([
    prisma.document.count({ where: { workspaceId } }),
    prisma.painPoint.count({ where: { workspaceId, status: "ACTIVE" } }),
    prisma.opportunity.findMany({
      where: { workspaceId },
      orderBy: { totalScore: "desc" },
      take: 5,
    }),
    prisma.document.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, title: true, status: true, sourceType: true, createdAt: true },
    }),
  ]);

  const topPainPoints = await prisma.painPoint.findMany({
    where: { workspaceId, status: "ACTIVE" },
    orderBy: [{ severity: "desc" }, { urgency: "desc" }],
    take: 5,
  });

  const statusColors: Record<string, string> = {
    COMPLETED: "bg-green-100 text-green-700 border-green-200",
    PENDING: "bg-yellow-100 text-yellow-700 border-yellow-200",
    FAILED: "bg-red-100 text-red-700 border-red-200",
    PARSING: "bg-blue-100 text-blue-700 border-blue-200",
    CHUNKING: "bg-blue-100 text-blue-700 border-blue-200",
    EMBEDDING: "bg-blue-100 text-blue-700 border-blue-200",
    EXTRACTING: "bg-blue-100 text-blue-700 border-blue-200",
  };

  return (
    <div className="h-full overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b bg-white">
          <div>
            <WorkspaceNameEditor workspaceId={workspaceId} initialName={workspace.name} />
            {workspace.description && (
              <p className="text-gray-500 text-sm mt-0.5">{workspace.description}</p>
            )}
          </div>
          <div className="flex gap-3">
            <Link href={`/workspaces/${workspaceId}/documents/upload`}>
              <Button variant="outline" size="sm" className="gap-2">
                <Upload className="h-3.5 w-3.5" /> Upload Evidence
              </Button>
            </Link>
            <Link href={`/workspaces/${workspaceId}/chat`}>
              <Button size="sm" className="gap-2 bg-violet-600 hover:bg-violet-700 text-white">
                <MessageSquare className="h-3.5 w-3.5" /> Ask Sentinel
              </Button>
            </Link>
          </div>
        </div>

        <div className="p-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Documents", value: documents, icon: FileText, href: `documents` },
            { label: "Pain Points", value: painPoints, icon: Lightbulb, href: `insights` },
            { label: "Opportunities", value: opportunities.length, icon: Target, href: `opportunities` },
            { label: "Top Score", value: opportunities[0] ? `${opportunities[0].totalScore.toFixed(0)}` : "—", icon: Target, href: `opportunities` },
          ].map(({ label, value, icon: Icon, href }) => (
            <Link key={label} href={`/workspaces/${workspaceId}/${href}`}>
              <Card className="hover:border-violet-200 transition-colors cursor-pointer">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
                    <Icon className="h-4 w-4 text-violet-400" />
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{value}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Top Pain Points */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                <Lightbulb className="h-3.5 w-3.5" /> Top Pain Points
              </h2>
              <Link href={`/workspaces/${workspaceId}/insights`} className="text-xs text-violet-600 hover:underline flex items-center gap-1">
                View all <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="space-y-2">
              {topPainPoints.length === 0 ? (
                <div className="bg-white rounded-lg border border-dashed px-4 py-8 text-center">
                  <p className="text-sm text-gray-400">Upload documents to extract pain points.</p>
                  <Link href={`/workspaces/${workspaceId}/documents/upload`}>
                    <Button variant="link" className="mt-2 text-violet-600 text-sm">Upload now</Button>
                  </Link>
                </div>
              ) : (
                topPainPoints.map((pp) => (
                  <div key={pp.id} className="bg-white rounded-lg border px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-gray-800">{pp.title}</p>
                      <div className="flex gap-1 shrink-0">
                        <Badge variant="outline" className="text-xs">S:{pp.severity}</Badge>
                        <Badge variant="outline" className="text-xs">U:{pp.urgency}</Badge>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{pp.description}</p>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Recommended Opportunities */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                <Target className="h-3.5 w-3.5" /> Opportunities
              </h2>
              <Link href={`/workspaces/${workspaceId}/opportunities`} className="text-xs text-violet-600 hover:underline flex items-center gap-1">
                View all <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="space-y-2">
              {opportunities.length === 0 ? (
                <div className="bg-white rounded-lg border border-dashed px-4 py-8 text-center">
                  <p className="text-sm text-gray-400">Synthesize workspace to generate opportunities.</p>
                </div>
              ) : (
                opportunities.map((opp) => (
                  <Link key={opp.id} href={`/workspaces/${workspaceId}/opportunities/${opp.id}`}>
                    <div className="bg-white rounded-lg border px-4 py-3 hover:border-violet-200 transition-colors cursor-pointer">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-gray-800 truncate">{opp.title}</p>
                        <Badge className={`text-xs font-bold shrink-0 ${scoreToColor(opp.totalScore)} bg-transparent border`}>
                          {opp.totalScore.toFixed(0)}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-1">{opp.problemStatement}</p>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </section>

          {/* Recent Evidence */}
          <section className="lg:col-span-2 border-t border-gray-200 pt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                <FileText className="h-3.5 w-3.5" /> Recent Evidence
              </h2>
              <Link href={`/workspaces/${workspaceId}/documents`} className="text-xs text-violet-600 hover:underline flex items-center gap-1">
                View all <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="bg-white rounded-lg border overflow-hidden">
              {recentDocs.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <p className="text-sm text-gray-400">No documents yet.</p>
                  <Link href={`/workspaces/${workspaceId}/documents/upload`}>
                    <Button variant="link" className="mt-2 text-violet-600 text-sm">Upload your first document</Button>
                  </Link>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="border-b bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Title</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Source</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Status</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentDocs.map((doc) => (
                      <tr key={doc.id} className="border-b last:border-0">
                        <td className="px-4 py-3 font-medium text-gray-800">{doc.title}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{doc.sourceType.replace(/_/g, " ")}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${statusColors[doc.status] ?? "bg-gray-100 text-gray-600"}`}>
                            {doc.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400">{formatDate(doc.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </div>
        </div>
    </div>
  );
}
