"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, MessageSquarePlus } from "lucide-react";
import { toast } from "sonner";

type InterviewType = "Discovery" | "Validation" | "Churn Exit" | "Onboarding";

interface InterviewQuestion {
  theme: string;
  question: string;
  probe?: string;
}

interface InterviewGuide {
  customerSegment: string;
  interviewType: string;
  questionCount: number;
  questions: InterviewQuestion[];
  openingStatement: string;
  closingStatement: string;
}

interface PainPoint {
  id: string;
  affectedSegments: string[];
}

interface InterviewGuideGeneratorProps {
  workspaceId: string;
}

function groupByTheme(questions: InterviewQuestion[]): Record<string, InterviewQuestion[]> {
  return questions.reduce(
    (acc, q) => {
      const theme = q.theme || "General";
      if (!acc[theme]) acc[theme] = [];
      acc[theme].push(q);
      return acc;
    },
    {} as Record<string, InterviewQuestion[]>
  );
}

export function InterviewGuideGenerator({ workspaceId }: InterviewGuideGeneratorProps) {
  const [segments, setSegments] = useState<string[]>([]);
  const [customerSegment, setCustomerSegment] = useState("");
  const [customSegment, setCustomSegment] = useState("");
  const [interviewType, setInterviewType] = useState<InterviewType>("Discovery");
  const [questionCount, setQuestionCount] = useState(10);
  const [focusArea, setFocusArea] = useState("");
  const [loading, setLoading] = useState(false);
  const [guide, setGuide] = useState<InterviewGuide | null>(null);

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
          if (unique.length > 0) {
            setCustomerSegment(unique[0]);
          }
        }
      } catch {
        // Segments will just be empty; user can type a custom one
      }
    }
    loadSegments();
  }, [workspaceId]);

  const effectiveSegment = customerSegment === "__custom__" ? customSegment : customerSegment;

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!effectiveSegment.trim()) {
      toast.error("Please enter or select a customer segment.");
      return;
    }
    setLoading(true);
    setGuide(null);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/interview-guide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerSegment: effectiveSegment.trim(),
          interviewType,
          questionCount,
          focusArea: focusArea.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message ?? "Failed to generate guide");
      }

      setGuide(data.data as InterviewGuide);
      toast.success("Interview guide generated!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  }

  const grouped = guide ? groupByTheme(guide.questions) : null;

  return (
    <div className="space-y-6">
      <Card className="bg-white">
        <CardHeader className="border-b">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquarePlus className="h-4 w-4 text-indigo-600" />
            Configure Interview Guide
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-5">
          <form onSubmit={handleGenerate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">
                  Customer Segment
                </label>
                {segments.length > 0 ? (
                  <select
                    value={customerSegment}
                    onChange={(e) => setCustomerSegment(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    {segments.map((seg) => (
                      <option key={seg} value={seg}>
                        {seg}
                      </option>
                    ))}
                    <option value="__custom__">— Enter custom segment —</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    value={customerSegment}
                    onChange={(e) => setCustomerSegment(e.target.value)}
                    placeholder="E.g. Enterprise Power Users"
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                )}
                {customerSegment === "__custom__" && (
                  <input
                    type="text"
                    value={customSegment}
                    onChange={(e) => setCustomSegment(e.target.value)}
                    placeholder="Enter custom segment name"
                    className="w-full mt-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">
                  Interview Type
                </label>
                <select
                  value={interviewType}
                  onChange={(e) => setInterviewType(e.target.value as InterviewType)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="Discovery">Discovery</option>
                  <option value="Validation">Validation</option>
                  <option value="Churn Exit">Churn Exit</option>
                  <option value="Onboarding">Onboarding</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">
                Number of Questions{" "}
                <span className="font-normal text-gray-400">(1–20)</span>
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={20}
                  step={1}
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Math.max(1, Number(e.target.value)))}
                  className="flex-1 h-2 rounded-full appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #4f46e5 0%, #4f46e5 ${(questionCount / 20) * 100}%, #e5e7eb ${(questionCount / 20) * 100}%, #e5e7eb 100%)`,
                  }}
                />
                <span className="text-sm font-semibold text-indigo-700 min-w-[2rem] text-center">
                  {questionCount}
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">
                Focus Area{" "}
                <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <textarea
                value={focusArea}
                onChange={(e) => setFocusArea(e.target.value)}
                placeholder="E.g. Dig into why users abandon during onboarding, or validate our hypothesis that the pricing model is a blocker…"
                rows={3}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating interview guide...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate Guide
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Generated guide results */}
      {guide && grouped && (
        <Card className="bg-white">
          <CardHeader className="border-b">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base text-gray-900 mb-1">
                  {guide.interviewType} Interview — {guide.customerSegment}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge className="text-xs bg-indigo-100 text-indigo-700">
                    {guide.interviewType}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {guide.questionCount} questions
                  </Badge>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-5 space-y-6">
            {/* Opening */}
            <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-3">
              <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-1.5">
                Opening Statement
              </p>
              <p className="text-sm text-gray-700 leading-relaxed italic">
                &ldquo;{guide.openingStatement}&rdquo;
              </p>
            </div>

            {/* Questions grouped by theme */}
            {Object.entries(grouped).map(([theme, questions]) => (
              <div key={theme}>
                <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />
                  {theme}
                </h3>
                <div className="space-y-3 ml-4">
                  {questions.map((q, idx) => (
                    <div
                      key={idx}
                      className="bg-gray-50 rounded-lg border border-gray-100 px-4 py-3"
                    >
                      <p className="text-sm font-medium text-gray-800 leading-relaxed">
                        {q.question}
                      </p>
                      {q.probe && (
                        <p className="text-xs text-gray-500 mt-1.5 italic">
                          Follow-up: {q.probe}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Closing */}
            <div className="bg-gray-50 border border-gray-100 rounded-lg px-4 py-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Closing Statement
              </p>
              <p className="text-sm text-gray-700 leading-relaxed italic">
                &ldquo;{guide.closingStatement}&rdquo;
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
