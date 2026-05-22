"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Audience = "Leadership" | "Engineering" | "Board" | "Investors";
type Timeframe = "Last 7 days" | "Last 30 days" | "Last 90 days" | "All time";

interface SummaryGeneratorProps {
  workspaceId: string;
}

export function SummaryGenerator({ workspaceId }: SummaryGeneratorProps) {
  const [audience, setAudience] = useState<Audience>("Leadership");
  const [timeframe, setTimeframe] = useState<Timeframe>("Last 30 days");
  const [additionalContext, setAdditionalContext] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/reports/executive-summary`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            audience,
            timeframe,
            additionalContext: additionalContext.trim() || undefined,
          }),
        }
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message ?? "Failed to generate summary");
      }

      toast.success("Executive summary generated!");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="bg-white">
      <CardHeader className="border-b">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-600" />
          Generate Executive Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-5">
        <form onSubmit={handleGenerate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Audience</label>
              <select
                value={audience}
                onChange={(e) => setAudience(e.target.value as Audience)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              >
                <option value="Leadership">Leadership</option>
                <option value="Engineering">Engineering</option>
                <option value="Board">Board</option>
                <option value="Investors">Investors</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Timeframe</label>
              <select
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value as Timeframe)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              >
                <option value="Last 7 days">Last 7 days</option>
                <option value="Last 30 days">Last 30 days</option>
                <option value="Last 90 days">Last 90 days</option>
                <option value="All time">All time</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">
              Additional Context{" "}
              <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <Textarea
              value={additionalContext}
              onChange={(e) => setAdditionalContext(e.target.value)}
              placeholder="E.g. Focus on mobile retention issues. Highlight Q2 progress. Emphasize enterprise traction."
              rows={3}
              className="resize-none text-sm"
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full gap-2 bg-violet-600 hover:bg-violet-700 text-white"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating executive summary...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate Summary
              </>
            )}
          </Button>

          {loading && (
            <p className="text-xs text-gray-400 text-center">
              Generating executive summary... (10-20 seconds)
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
