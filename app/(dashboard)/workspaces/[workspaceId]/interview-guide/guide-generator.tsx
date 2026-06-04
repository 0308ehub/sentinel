"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Loader2, MessageSquarePlus } from "lucide-react";
import { toast } from "sonner";
import { useJob } from "../workspace-jobs-context";
import { ProgressStream } from "@/components/ui/progress-stream";

type InterviewType = "Discovery" | "Validation" | "Churn Exit" | "Onboarding";

interface PainPoint {
  id: string;
  affectedSegments: string[];
}

interface InterviewGuideGeneratorProps {
  workspaceId: string;
}

export function InterviewGuideGenerator({ workspaceId }: InterviewGuideGeneratorProps) {
  const router = useRouter();
  const [segments, setSegments] = useState<string[]>([]);
  const [customerSegment, setCustomerSegment] = useState("");
  const [customSegment, setCustomSegment] = useState("");
  const [interviewType, setInterviewType] = useState<InterviewType>("Discovery");
  const [questionCount, setQuestionCount] = useState(10);
  const [focusArea, setFocusArea] = useState("");
  const { running, steps, startJob } = useJob("generate-interview-guide");

  useEffect(() => {
    async function loadSegments() {
      try {
        const res = await fetch(`/api/workspaces/${workspaceId}/pain-points`);
        const data = await res.json();
        if (data.ok) {
          const allSegments = (data.data as PainPoint[])
            .flatMap((pp) => pp.affectedSegments)
            .filter(Boolean);
          const unique = Array.from(new Set(allSegments)).sort();
          setSegments(unique);
          if (unique.length > 0) setCustomerSegment(unique[0]);
        }
      } catch {
        // segments empty; user can type custom
      }
    }
    loadSegments();
  }, [workspaceId]);

  const effectiveSegment = customerSegment === "__custom__" ? customSegment : customerSegment;

  function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!effectiveSegment.trim()) {
      toast.error("Please enter or select a customer segment.");
      return;
    }
    startJob(
      `/api/workspaces/${workspaceId}/interview-guide`,
      (result) => {
        toast.success("Interview guide saved!");
        router.push(`/workspaces/${workspaceId}/interview-guide/${result.id as string}`);
      },
      (msg) => toast.error(msg),
      {
        body: JSON.stringify({
          customerSegment: effectiveSegment.trim(),
          interviewType,
          questionCount,
          focusArea: focusArea.trim() || undefined,
        }),
      }
    );
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquarePlus className="h-4 w-4 text-indigo-500" />
          Configure Interview Guide
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-5">
        <form onSubmit={handleGenerate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Customer Segment</label>
              {segments.length > 0 ? (
                <select
                  value={customerSegment}
                  onChange={(e) => setCustomerSegment(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {segments.map((seg) => (
                    <option key={seg} value={seg}>{seg}</option>
                  ))}
                  <option value="__custom__">— Enter custom segment —</option>
                </select>
              ) : (
                <input
                  type="text"
                  value={customerSegment}
                  onChange={(e) => setCustomerSegment(e.target.value)}
                  placeholder="E.g. Enterprise Power Users"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              )}
              {customerSegment === "__custom__" && (
                <input
                  type="text"
                  value={customSegment}
                  onChange={(e) => setCustomSegment(e.target.value)}
                  placeholder="Enter custom segment name"
                  className="w-full mt-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Interview Type</label>
              <select
                value={interviewType}
                onChange={(e) => setInterviewType(e.target.value as InterviewType)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Discovery">Discovery</option>
                <option value="Validation">Validation</option>
                <option value="Churn Exit">Churn Exit</option>
                <option value="Onboarding">Onboarding</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Number of Questions <span className="font-normal text-muted-foreground">(5–20)</span>
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range" min={5} max={20} step={1} value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
                className="flex-1 h-2 rounded-full appearance-none cursor-pointer"
                style={{ background: `linear-gradient(to right, #4f46e5 0%, #4f46e5 ${((questionCount - 5) / 15) * 100}%, #e5e7eb ${((questionCount - 5) / 15) * 100}%, #e5e7eb 100%)` }}
              />
              <span className="text-sm font-semibold text-indigo-700 min-w-[2rem] text-center">{questionCount}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Focus Area <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <textarea
              value={focusArea}
              onChange={(e) => setFocusArea(e.target.value)}
              placeholder="E.g. Dig into why users abandon during onboarding…"
              rows={3}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          <Button type="submit" disabled={running} className="w-full gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
            {running ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</>
            ) : (
              <><Sparkles className="h-4 w-4" /> Generate Guide</>
            )}
          </Button>

          {steps.length > 0 && <ProgressStream steps={steps} />}
        </form>
      </CardContent>
    </Card>
  );
}
