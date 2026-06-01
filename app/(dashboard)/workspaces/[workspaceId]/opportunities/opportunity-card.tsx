"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Pencil, Trash2, Check, X, Loader2, FileText, ExternalLink, Ticket, ChevronRight, CheckCircle2, Circle, Rocket } from "lucide-react";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";

type OpportunityStatus = "PROPOSED" | "ACCEPTED" | "REJECTED" | "IN_PROGRESS" | "SHIPPED";

const STATUS_CONFIG: Record<OpportunityStatus, {
  label: string;
  color: string;
  bg: string;
  border: string;
  nextStatus: OpportunityStatus | null;
  nextLabel: string | null;
  nextIcon: React.ElementType | null;
}> = {
  PROPOSED: {
    label: "Proposed",
    color: "text-slate-600",
    bg: "bg-slate-50",
    border: "border-slate-200",
    nextStatus: "ACCEPTED",
    nextLabel: "Accept",
    nextIcon: Check,
  },
  ACCEPTED: {
    label: "Accepted",
    color: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-200",
    nextStatus: "IN_PROGRESS",
    nextLabel: "Start",
    nextIcon: ChevronRight,
  },
  IN_PROGRESS: {
    label: "In Progress",
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
    nextStatus: "SHIPPED",
    nextLabel: "Ship it",
    nextIcon: Rocket,
  },
  SHIPPED: {
    label: "Shipped",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    nextStatus: null,
    nextLabel: null,
    nextIcon: null,
  },
  REJECTED: {
    label: "Rejected",
    color: "text-gray-400",
    bg: "bg-gray-50",
    border: "border-gray-200",
    nextStatus: "PROPOSED" as OpportunityStatus,
    nextLabel: "Reopen",
    nextIcon: ChevronRight,
  },
};

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
  status: OpportunityStatus;
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
  const [currentStatus, setCurrentStatus] = useState<OpportunityStatus>(opp.status);
  const [advancingStatus, setAdvancingStatus] = useState(false);
  const [generatingTickets, setGeneratingTickets] = useState(false);

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

  async function handleStatusAdvance() {
    const config = STATUS_CONFIG[currentStatus];
    if (!config.nextStatus) return;
    const next = config.nextStatus;
    setAdvancingStatus(true);
    const prev = currentStatus;
    setCurrentStatus(next);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/opportunities/${opp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error("Update failed");
      toast.success(`Moved to ${STATUS_CONFIG[next].label}`);
      router.refresh();
    } catch {
      setCurrentStatus(prev);
      toast.error("Failed to update status");
    } finally {
      setAdvancingStatus(false);
    }
  }

  async function handleGenerateTickets() {
    setGeneratingTickets(true);
    toast.loading("Generating tickets…", { id: "gen-tickets" });
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/tickets/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunityId: opp.id }),
      });
      if (!res.ok) throw new Error("Generation failed");

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let count = 0;
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value);
          for (const line of text.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            try {
              const evt = JSON.parse(line.slice(6));
              if (evt.type === "done") count = evt.count as number;
            } catch { /* skip */ }
          }
        }
      }
      toast.success(`Generated ${count} tickets`, { id: "gen-tickets" });
      router.push(`/workspaces/${workspaceId}/tickets`);
    } catch {
      toast.error("Failed to generate tickets", { id: "gen-tickets" });
    } finally {
      setGeneratingTickets(false);
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
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger
                      onClick={() => setEditing(true)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-all"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </TooltipTrigger>
                    <TooltipContent>Edit opportunity</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger
                      onClick={handleDelete}
                      disabled={deleting}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600 transition-all"
                    >
                      {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </TooltipTrigger>
                    <TooltipContent>Delete opportunity</TooltipContent>
                  </Tooltip>
                </TooltipProvider>

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
          <div className="ml-auto flex items-center gap-2">
            <span className={cn(
              "inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border",
              STATUS_CONFIG[currentStatus].color,
              STATUS_CONFIG[currentStatus].bg,
              STATUS_CONFIG[currentStatus].border
            )}>
              {currentStatus === "SHIPPED" ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : currentStatus === "IN_PROGRESS" ? (
                <Circle className="h-3 w-3 fill-current opacity-60" />
              ) : null}
              {STATUS_CONFIG[currentStatus].label}
            </span>
          </div>
        </div>

        {opp.targetSegments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {opp.targetSegments.map((seg) => (
              <Badge key={seg} variant="secondary" className="text-xs">{seg}</Badge>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          {STATUS_CONFIG[currentStatus].nextStatus && (
            <Button
              size="sm"
              onClick={handleStatusAdvance}
              disabled={advancingStatus}
              className={cn(
                "gap-1.5 text-white",
                currentStatus === "IN_PROGRESS"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : currentStatus === "ACCEPTED"
                  ? "bg-amber-500 hover:bg-amber-600"
                  : currentStatus === "REJECTED"
                  ? "bg-slate-600 hover:bg-slate-700"
                  : "bg-blue-600 hover:bg-blue-700"
              )}
            >
              {advancingStatus ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : STATUS_CONFIG[currentStatus].nextIcon ? (
                (() => { const Icon = STATUS_CONFIG[currentStatus].nextIcon!; return <Icon className="h-3.5 w-3.5" />; })()
              ) : null}
              {STATUS_CONFIG[currentStatus].nextLabel}
            </Button>
          )}
          {currentStatus === "PROPOSED" && (
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                setAdvancingStatus(true);
                const prev = currentStatus;
                setCurrentStatus("REJECTED");
                try {
                  const res = await fetch(`/api/workspaces/${workspaceId}/opportunities/${opp.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status: "REJECTED" }),
                  });
                  if (!res.ok) throw new Error();
                  toast.success("Opportunity rejected");
                  router.refresh();
                } catch {
                  setCurrentStatus(prev);
                  toast.error("Failed to reject");
                } finally {
                  setAdvancingStatus(false);
                }
              }}
              disabled={advancingStatus}
              className="gap-1.5 text-gray-500 border-gray-200 hover:text-red-600 hover:border-red-200"
            >
              <X className="h-3.5 w-3.5" /> Reject
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={handleGenerateTickets}
            disabled={generatingTickets}
            className="gap-1.5"
          >
            {generatingTickets ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ticket className="h-3.5 w-3.5" />}
            Tickets
          </Button>
          <Link href={`/workspaces/${workspaceId}/prd?opportunityId=${opp.id}`}>
            <Button size="sm" variant="outline" className="gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              PRD
            </Button>
          </Link>
          <Link href={`/workspaces/${workspaceId}/opportunities/${opp.id}`}>
            <Button size="sm" variant="ghost" className="gap-1.5 text-gray-400 hover:text-gray-700">
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
