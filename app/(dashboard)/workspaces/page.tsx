import { requireUser } from "@/lib/auth/helpers";
import { prisma } from "@/lib/db/prisma";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, FolderKanban } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { redirect } from "next/navigation";

export default async function WorkspacesPage() {
  let user;
  try {
    user = await requireUser();
  } catch {
    redirect("/sign-in");
  }

  const memberships = await prisma.membership.findMany({ where: { userId: user.id } });
  const orgIds = memberships.map((m) => m.organizationId);

  const workspaces = await prisma.workspace.findMany({
    where: { organizationId: { in: orgIds } },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { documents: true, opportunities: true, painPoints: true } },
      organization: { select: { name: true } },
    },
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-foreground">Workspaces</h1>
        <Link href="/workspaces/new">
          <Button className="bg-violet-600 hover:bg-violet-700 text-white gap-2">
            <Plus className="h-4 w-4" /> New Workspace
          </Button>
        </Link>
      </div>

      {workspaces.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-20 text-center">
            <FolderKanban className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="font-semibold text-foreground mb-2">No workspaces yet</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
              Create a workspace for each product or feature area you want to analyze.
            </p>
            <Link href="/workspaces/new">
              <Button className="bg-violet-600 hover:bg-violet-700 text-white">Create your first workspace</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {workspaces.map((ws) => (
            <Link key={ws.id} href={`/workspaces/${ws.id}`}>
              <Card className="hover:border-violet-300 hover:shadow-sm transition-all cursor-pointer h-full">
                <CardHeader>
                  <p className="text-xs text-muted-foreground/60 font-medium">{ws.organization.name}</p>
                  <CardTitle className="text-base">{ws.name}</CardTitle>
                  {ws.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{ws.description}</p>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4 text-sm text-muted-foreground mb-3">
                    <span className="font-medium text-foreground/80">{ws._count.documents}</span> docs ·{" "}
                    <span className="font-medium text-foreground/80">{ws._count.painPoints}</span> pain points ·{" "}
                    <span className="font-medium text-foreground/80">{ws._count.opportunities}</span> opportunities
                  </div>
                  <p className="text-xs text-muted-foreground/60">Updated {formatDate(ws.updatedAt)}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
