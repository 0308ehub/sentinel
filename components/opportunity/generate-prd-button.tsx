"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { FileText, Loader2 } from "lucide-react";

interface Props {
  workspaceId: string;
  opportunityId: string;
}

export function GeneratePRDButton({ workspaceId, opportunityId }: Props) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleClick = async () => {
    setLoading(true);
    const t = toast.loading("Generating PRD… this may take a moment");
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/prds/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunityId }),
      });
      const json = await res.json();
      toast.dismiss(t);
      if (!json.ok) throw new Error(json.error?.message);
      toast.success("PRD generated!");
      router.push(`/workspaces/${workspaceId}/prd/${json.data.id}`);
    } catch (error) {
      toast.dismiss(t);
      toast.error(error instanceof Error ? error.message : "Failed to generate PRD");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleClick}
      disabled={loading}
      className="gap-2 bg-violet-600 hover:bg-violet-700 text-white"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
      Generate PRD
    </Button>
  );
}
