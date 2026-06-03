import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageSquarePlus, Plus, Users, ChevronRight } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default async function InterviewGuidePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  try { await requireWorkspaceAccess(workspaceId); } catch { redirect("/sign-in"); }

  const guides = await prisma.interviewGuide.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { sessions: true } } },
  });

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="flex items-center justify-between px-8 py-5 border-b border-border bg-card">
        <div>
          <h1 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <MessageSquarePlus className="h-5 w-5 text-indigo-500" /> Interview Guides
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Generate guides, run sessions, and synthesize findings.</p>
        </div>
        <Link href={`/workspaces/${workspaceId}/interview-guide/new`}>
          <Button size="sm" className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
            <Plus className="h-3.5 w-3.5" /> New Guide
          </Button>
        </Link>
      </div>
      <div className="p-8">
        {guides.length === 0 ? (
          <div className="bg-card rounded-xl border border-dashed border-border px-6 py-16 text-center">
            <MessageSquarePlus className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">No interview guides yet</p>
            <p className="text-xs text-muted-foreground mb-4">Generate a guide to start conducting structured customer interviews.</p>
            <Link href={`/workspaces/${workspaceId}/interview-guide/new`}>
              <Button size="sm" className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"><Plus className="h-3.5 w-3.5" /> New Guide</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {guides.map((guide) => (
              <Link key={guide.id} href={`/workspaces/${workspaceId}/interview-guide/${guide.id}`}>
                <div className="bg-card rounded-xl border border-border px-5 py-4 flex items-center justify-between gap-4 hover:border-indigo-300 transition-colors cursor-pointer">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{guide.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className="text-xs bg-indigo-500/10 text-indigo-400 border-0">{guide.interviewType}</Badge>
                      <span className="text-xs text-muted-foreground">{guide.customerSegment}</span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">{formatDate(guide.createdAt)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="h-3.5 w-3.5" />{guide._count.sessions} session{guide._count.sessions !== 1 ? "s" : ""}
                    </span>
                    {guide.synthesis && <Badge className="text-xs bg-emerald-500/10 text-emerald-400 border-0">Synthesized</Badge>}
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
