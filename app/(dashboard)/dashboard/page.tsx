import { requireUser } from "@/lib/auth/helpers";
import { prisma } from "@/lib/db/prisma";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FolderKanban, Plus, FileText, Target, Zap } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  let user;
  try {
    user = await requireUser();
  } catch {
    redirect("/sign-in");
  }

  const memberships = await prisma.membership.findMany({
    where: { userId: user.id },
    select: { organizationId: true },
  });
  const orgIds = memberships.map((m) => m.organizationId);

  const [workspaces, recentDocuments, topOpportunities] = await Promise.all([
    prisma.workspace.findMany({
      where: { organizationId: { in: orgIds } },
      orderBy: { updatedAt: "desc" },
      take: 6,
      include: {
        _count: { select: { documents: true, opportunities: true, painPoints: true } },
      },
    }),
    prisma.document.findMany({
      where: { workspace: { organizationId: { in: orgIds } } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, title: true, status: true, sourceType: true, createdAt: true, workspaceId: true },
    }),
    prisma.opportunity.findMany({
      where: { workspace: { organizationId: { in: orgIds } } },
      orderBy: { totalScore: "desc" },
      take: 3,
      select: { id: true, title: true, totalScore: true, workspaceId: true, status: true },
    }),
  ]);

  const statusColors: Record<string, string> = {
    COMPLETED: "bg-green-100 text-green-700",
    PENDING: "bg-yellow-100 text-yellow-700",
    FAILED: "bg-red-100 text-red-700",
    PARSING: "bg-blue-100 text-blue-700",
    CHUNKING: "bg-blue-100 text-blue-700",
    EMBEDDING: "bg-blue-100 text-blue-700",
    EXTRACTING: "bg-blue-100 text-blue-700",
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Welcome back, {user.name ?? user.email}</p>
        </div>
        <Link href="/workspaces/new">
          <Button className="bg-violet-600 hover:bg-violet-700 text-white gap-2">
            <Plus className="h-4 w-4" /> New Workspace
          </Button>
        </Link>
      </div>

      {/* Workspaces */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <FolderKanban className="h-4 w-4 text-violet-600" /> Your Workspaces
        </h2>
        {workspaces.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center">
              <FolderKanban className="h-10 w-10 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">No workspaces yet. Create one to get started.</p>
              <Link href="/workspaces/new">
                <Button className="bg-violet-600 hover:bg-violet-700 text-white">Create workspace</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workspaces.map((ws) => (
              <Link key={ws.id} href={`/workspaces/${ws.id}`}>
                <Card className="hover:border-violet-300 hover:shadow-sm transition-all cursor-pointer">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold text-gray-900">{ws.name}</CardTitle>
                    {ws.description && <p className="text-xs text-gray-400 mt-1 line-clamp-1">{ws.description}</p>}
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-4 text-xs text-gray-500">
                      <span>{ws._count.documents} docs</span>
                      <span>{ws._count.painPoints} pain points</span>
                      <span>{ws._count.opportunities} opportunities</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">{formatDate(ws.updatedAt)}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Documents */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <FileText className="h-4 w-4 text-violet-600" /> Recent Evidence
          </h2>
          <div className="space-y-2">
            {recentDocuments.length === 0 ? (
              <p className="text-sm text-gray-400">No documents yet.</p>
            ) : (
              recentDocuments.map((doc) => (
                <Link key={doc.id} href={`/workspaces/${doc.workspaceId}/documents`}>
                  <div className="flex items-center justify-between bg-white rounded-lg border px-4 py-3 hover:border-violet-200 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{doc.title}</p>
                      <p className="text-xs text-gray-400">{doc.sourceType.replace(/_/g, " ")}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[doc.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {doc.status}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>

        {/* Top Opportunities */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Target className="h-4 w-4 text-violet-600" /> Top Opportunities
          </h2>
          <div className="space-y-2">
            {topOpportunities.length === 0 ? (
              <p className="text-sm text-gray-400">Run synthesis to generate opportunities.</p>
            ) : (
              topOpportunities.map((opp) => (
                <Link key={opp.id} href={`/workspaces/${opp.workspaceId}/opportunities/${opp.id}`}>
                  <div className="flex items-center justify-between bg-white rounded-lg border px-4 py-3 hover:border-violet-200 transition-colors">
                    <p className="text-sm font-medium text-gray-800 truncate">{opp.title}</p>
                    <Badge variant="secondary" className="text-violet-700 bg-violet-50 font-semibold ml-2 shrink-0">
                      {opp.totalScore.toFixed(0)}
                    </Badge>
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
