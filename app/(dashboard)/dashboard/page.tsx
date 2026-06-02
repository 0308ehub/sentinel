import { requireUser } from "@/lib/auth/helpers";
import { prisma } from "@/lib/db/prisma";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FolderKanban, Plus, FileText, Target } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { redirect } from "next/navigation";

const statusColors: Record<string, string> = {
  COMPLETED: "bg-green-500/15 text-green-400 border border-green-500/20",
  PENDING: "bg-yellow-500/15 text-yellow-400 border border-yellow-500/20",
  FAILED: "bg-red-500/15 text-red-400 border border-red-500/20",
  PARSING: "bg-blue-500/15 text-blue-400 border border-blue-500/20",
  CHUNKING: "bg-blue-500/15 text-blue-400 border border-blue-500/20",
  EMBEDDING: "bg-blue-500/15 text-blue-400 border border-blue-500/20",
  EXTRACTING: "bg-blue-500/15 text-blue-400 border border-blue-500/20",
};

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

  return (
    <div className="h-full overflow-auto">
      {/* Page header */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-border bg-background">
        <div>
          <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Welcome back, {user.name ?? user.email}</p>
        </div>
        <Link href="/workspaces/new">
          <Button className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
            <Plus className="h-4 w-4" /> New Workspace
          </Button>
        </Link>
      </div>

      <div className="p-8">
        {/* Workspaces */}
        <section className="mb-10">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
            <FolderKanban className="h-3.5 w-3.5" /> Your Workspaces
          </h2>
          {workspaces.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-16 text-center">
                <FolderKanban className="h-10 w-10 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">No workspaces yet. Create one to get started.</p>
                <Link href="/workspaces/new">
                  <Button className="bg-indigo-600 hover:bg-indigo-700 text-white">Create workspace</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {workspaces.map((ws) => (
                <Link key={ws.id} href={`/workspaces/${ws.id}`}>
                  <Card className="hover:border-indigo-500/40 hover:shadow-sm transition-all cursor-pointer bg-card">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base font-semibold text-foreground">{ws.name}</CardTitle>
                      {ws.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{ws.description}</p>}
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span>{ws._count.documents} docs</span>
                        <span>{ws._count.painPoints} pain points</span>
                        <span>{ws._count.opportunities} opportunities</span>
                      </div>
                      <p className="text-xs text-muted-foreground/60 mt-2">{formatDate(ws.updatedAt)}</p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>

        <div className="border-t border-border pt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Documents */}
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
              <FileText className="h-3.5 w-3.5" /> Recent Evidence
            </h2>
            <div className="space-y-2">
              {recentDocuments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No documents yet.</p>
              ) : (
                recentDocuments.map((doc) => (
                  <Link key={doc.id} href={`/workspaces/${doc.workspaceId}/documents`}>
                    <div className="flex items-center justify-between bg-card rounded-lg border border-border px-4 py-3 hover:border-indigo-500/30 transition-colors">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{doc.title}</p>
                        <p className="text-xs text-muted-foreground">{doc.sourceType.replace(/_/g, " ")}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ml-3 ${statusColors[doc.status] ?? "bg-muted text-muted-foreground"}`}>
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
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
              <Target className="h-3.5 w-3.5" /> Top Opportunities
            </h2>
            <div className="space-y-2">
              {topOpportunities.length === 0 ? (
                <p className="text-sm text-muted-foreground">Run synthesis to generate opportunities.</p>
              ) : (
                topOpportunities.map((opp) => (
                  <Link key={opp.id} href={`/workspaces/${opp.workspaceId}/opportunities/${opp.id}`}>
                    <div className="flex items-center justify-between bg-card rounded-lg border border-border px-4 py-3 hover:border-indigo-500/30 transition-colors">
                      <p className="text-sm font-medium text-foreground truncate">{opp.title}</p>
                      <Badge variant="secondary" className="text-indigo-400 bg-indigo-500/15 border border-indigo-500/20 font-semibold ml-2 shrink-0">
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
    </div>
  );
}
