"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useJob } from "../workspace-jobs-context";
import { ProgressStream } from "@/components/ui/progress-stream";

interface Opportunity {
  id: string;
  title: string;
}

interface GeneratePRDFormProps {
  workspaceId: string;
  opportunities: Opportunity[];
  defaultOpportunityId?: string;
}

export function GeneratePRDForm({
  workspaceId,
  opportunities,
  defaultOpportunityId,
}: GeneratePRDFormProps) {
  const [opportunityId, setOpportunityId] = useState(defaultOpportunityId ?? "");
  const [userInstruction, setUserInstruction] = useState("");
  const router = useRouter();
  const { running, steps, startJob } = useJob("generate-prd");

  function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    startJob(
      `/api/workspaces/${workspaceId}/prds/generate`,
      (result) => {
        toast.success("PRD generated successfully!");
        router.push(`/workspaces/${workspaceId}/prd/${result.id as string}`);
      },
      (msg) => toast.error(msg),
      {
        body: JSON.stringify({
          opportunityId: opportunityId || undefined,
          userInstruction: userInstruction || undefined,
        }),
      }
    );
  }

  return (
    <Card className="sticky top-6">
      <CardHeader className="border-b">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-indigo-600" />
          Generate New PRD
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-5">
        <form onSubmit={handleGenerate} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Link to Opportunity{" "}
              <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <select
              value={opportunityId}
              onChange={(e) => setOpportunityId(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="">— No linked opportunity —</option>
              {opportunities.map((opp) => (
                <option key={opp.id} value={opp.id}>
                  {opp.title}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Instructions{" "}
              <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <Textarea
              value={userInstruction}
              onChange={(e) => setUserInstruction(e.target.value)}
              placeholder="E.g. Focus on mobile-first experience. Include a phased rollout plan. Target enterprise customers."
              rows={5}
              className="resize-none text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Guide Sentinel on scope, constraints, or specific requirements.
            </p>
          </div>

          <Button
            type="submit"
            disabled={running}
            className="w-full gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {running ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating PRD…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate PRD
              </>
            )}
          </Button>

          {steps.length > 0 && <ProgressStream steps={steps} />}
        </form>
      </CardContent>
    </Card>
  );
}
