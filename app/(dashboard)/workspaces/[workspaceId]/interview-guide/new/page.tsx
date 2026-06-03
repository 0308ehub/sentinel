import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { InterviewGuideGenerator } from "../guide-generator";

export default async function NewInterviewGuidePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  try { await requireWorkspaceAccess(workspaceId); } catch { redirect("/sign-in"); }

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="flex items-center gap-3 px-8 py-5 border-b border-border bg-card">
        <Link href={`/workspaces/${workspaceId}/interview-guide`}>
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Back</Button>
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-foreground">New Interview Guide</h1>
          <p className="text-sm text-muted-foreground">Generates targeted questions from your workspace pain points.</p>
        </div>
      </div>
      <div className="p-8 max-w-2xl">
        <InterviewGuideGenerator workspaceId={workspaceId} />
      </div>
    </div>
  );
}
