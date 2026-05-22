"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Pencil, Trash2, Check, X, Loader2, FileText, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface Opportunity {
  id: string;
  title: string;
  description: string;
  problemStatement: string;
  proposedSolution: string | null;
  impactScore: number;
  confidenceScore: number;
  urgencyScore: number;
  effortScore: number;
  riskScore: number;
  totalScore: number;
  targetSegments: string[];
  status: string;
}

function scoreColor(score: number) {
  if (score >= 80) return "text-emerald-700 bg-emerald-50 border-emerald-200";
  if (score >= 60) return "text-amber-700 bg-amber-50 border-amber-200";
  return "text-red-700 bg-red-50 border-red-200";
}

function miniScoreColor(score: number) {
  if (score >= 80) return "text-emerald-600";
  if (score >= 60) return "text-amber-600";
  return "text-red-500";
}

export function OpportunityCard({
  opp,
  workspaceId,
  index,
}: {
  opp: Opportunity;
  workspaceId: string;
  index: number;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState(opp.title);
  const [description, setDescription] = useState(opp.description);
  const [problemStatement, setProblemStatement] = useState(opp.problemStatement);
  const [proposedSolution, setProposedSolution] = useState(opp.proposedSolution ?? "");

  function cancelEdit() {
    setTitle(opp.title);
    setDescription(opp.description);
    setProblemStatement(opp.problemStatement);
    setProposedSolution(opp.proposedSolution ?? "");
    setEditing(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/opportunities/${opp.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, description, problemStatement, proposedSolution: proposedSolution || null }),
        }
      );
      if (!res.ok) throw new Error("Update failed");
      toast.success("Opportunity updated");
      setEditing(false);
      router.refresh();
    } catch {
      toast.error("Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/opportunities/${opp.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Delete failed");
      toast.success("Opportunity deleted");
      router.refresh();
    } catch {
      toast.error("Failed to delete opportunity");
      setDeleting(false);
    }
  }

  if (editing) {
    return (
      <Card className="bg-white ring-2 ring-violet-200">
        <CardHeader className="pb-0">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full text-base font-semibold text-gray-900 border-b border-gray-200 pb-1 focus:outline-none focus:border-violet-400"
            placeholder="Title"
          />
        </CardHeader>
        <CardContent className="pt-3 space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full text-sm text-gray-600 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Problem Statement</label>
            <textarea
              value={problemStatement}
              onChange={(e) => setProblemStatement(e.target.value)}
              rows={4}
              className="w-full text-sm text-gray-600 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Proposed Solution</label>
            <textarea
              value={proposedSolution}
              onChange={(e) => setProposedSolution(e.target.value)}
              rows={3}
              className="w-full text-sm text-gray-600 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={saving}>
              <X className="h-4 w-4 mr-1" /> Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="bg-violet-600 hover:bg-violet-700 text-white">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
              Save
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white hover:shadow-sm transition-shadow group">
      <CardHeader className="pb-0">
        <div className="flex items-start gap-4">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-violet-50 border border-violet-100 text-violet-600 font-bold text-sm shrink-0 mt-0.5">
            {index + 1}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <CardTitle className="text-base text-gray-900 mb-1">{title}</CardTitle>
                <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {/* Action buttons — visible on hover */}
                <button
                  onClick={() => setEditing(true)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-all"
                  title="Edit"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600 transition-all"
                  title="Delete"
                >
                  {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </button>

                <div
                  className={cn(
                    "flex flex-col items-center justify-center min-w-[72px] rounded-xl border-2 px-3 py-2",
                    scoreColor(opp.totalScore)
                  )}
                >
                  <span className="text-2xl font-bold leading-none">{opp.totalScore.toFixed(0)}</span>
                  <span className="text-xs font-medium mt-0.5 opacity-70">score</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4 pl-16">
        <div className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2.5 mb-4 leading-relaxed border border-gray-100 max-h-28 overflow-y-auto">
          <span className="font-medium text-gray-700">Problem: </span>
          {problemStatement}
        </div>

        <div className="flex items-center gap-4 mb-4 flex-wrap">
          {[
            { label: "Impact", value: opp.impactScore },
            { label: "Confidence", value: opp.confidenceScore },
            { label: "Urgency", value: opp.urgencyScore },
            { label: "Effort", value: opp.effortScore, inverse: true },
            { label: "Risk", value: opp.riskScore, inverse: true },
          ].map(({ label, value, inverse }) => {
            const displayScore = inverse ? 100 - value : value;
            return (
              <div key={label} className="flex flex-col items-center">
                <span className={cn("text-sm font-bold", miniScoreColor(displayScore))}>
                  {value.toFixed(0)}
                </span>
                <span className="text-xs text-gray-400">{label}</span>
              </div>
            );
          })}
          <div className="ml-auto">
            <Badge variant="outline" className="text-xs capitalize">
              {opp.status.toLowerCase().replace(/_/g, " ")}
            </Badge>
          </div>
        </div>

        {opp.targetSegments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {opp.targetSegments.map((seg) => (
              <Badge key={seg} variant="secondary" className="text-xs">{seg}</Badge>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          <Link href={`/workspaces/${workspaceId}/prd?opportunityId=${opp.id}`}>
            <Button size="sm" className="gap-1.5 bg-violet-600 hover:bg-violet-700 text-white">
              <FileText className="h-3.5 w-3.5" />
              Generate PRD
            </Button>
          </Link>
          <Link href={`/workspaces/${workspaceId}/opportunities/${opp.id}`}>
            <Button size="sm" variant="outline" className="gap-1.5">
              <ExternalLink className="h-3.5 w-3.5" />
              View Detail
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
