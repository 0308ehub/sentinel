import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { redirect } from "next/navigation";
import { MessageSquarePlus } from "lucide-react";
import { InterviewGuideGenerator } from "./guide-generator";

export default async function InterviewGuidePage({
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

  return (
    <div>

      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <MessageSquarePlus className="h-6 w-6 text-indigo-600" />
            Interview Guide Generator
          </h1>
          <p className="text-sm text-gray-500 mt-1 max-w-2xl">
            Generate targeted interview questions based on your top pain points to
            validate assumptions and dig deeper.
          </p>
        </div>

        <InterviewGuideGenerator workspaceId={workspaceId} />
      </div>
    </div>
  );
}
