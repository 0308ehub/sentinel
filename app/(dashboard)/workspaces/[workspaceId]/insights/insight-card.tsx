"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Pencil, Trash2, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { InsightType } from "@prisma/client";

interface Insight {
  id: string;
  title: string;
  description: string;
  confidence: number;
  evidenceIds: string[];
  type: InsightType;
  metadata: unknown;
}

function confidenceBar(confidence: number) {
  const safe = typeof confidence === "number" && isFinite(confidence) ? confidence : 0;
  const pct = Math.round(safe * 100);
  const color = pct >= 75 ? "bg-emerald-500" : pct >= 50 ? "bg-violet-500" : "bg-gray-300";
  return { pct, color };
}

export function InsightCard({
  insight,
  workspaceId,
}: {
  insight: Insight;
  workspaceId: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState(insight.title);
  const [description, setDescription] = useState(insight.description);
  const [confidence, setConfidence] = useState(Math.round(insight.confidence * 100));

  const { pct, color } = confidenceBar(insight.confidence);
  const meta = insight.metadata as Record<string, unknown> | null;
  const affectedSegments = Array.isArray(meta?.affectedSegments)
    ? (meta.affectedSegments as string[])
    : [];

  function cancelEdit() {
    setTitle(insight.title);
    setDescription(insight.description);
    setConfidence(Math.round(insight.confidence * 100));
    setEditing(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/insights/${insight.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, description, confidence: confidence / 100 }),
        }
      );
      if (!res.ok) throw new Error("Update failed");
      toast.success("Insight updated");
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
        `/api/workspaces/${workspaceId}/insights/${insight.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Delete failed");
      toast.success("Insight deleted");
      router.refresh();
    } catch {
      toast.error("Failed to delete insight");
      setDeleting(false);
    }
  }

  if (editing) {
    return (
      <Card className="bg-white ring-2 ring-violet-200 flex flex-col">
        <CardHeader className="pb-0">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full text-sm font-semibold text-gray-900 border-b border-gray-200 pb-1 focus:outline-none focus:border-violet-400"
          />
        </CardHeader>
        <CardContent className="pt-3 space-y-3 flex flex-col flex-1">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full text-sm text-gray-600 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none flex-1"
          />
          <label className="space-y-1 block">
            <span className="text-xs font-medium text-gray-500">Confidence: {confidence}%</span>
            <input
              type="range"
              min={0}
              max={100}
              value={confidence}
              onChange={(e) => setConfidence(Number(e.target.value))}
              className="w-full h-2 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #7c3aed 0%, #7c3aed ${confidence}%, #e5e7eb ${confidence}%, #e5e7eb 100%)`,
              }}
            />
          </label>
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
    <Card className="bg-white flex flex-col group">
      <CardHeader className="pb-0">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-sm text-gray-900 leading-snug">{insight.title}</CardTitle>
          <div className="flex items-center gap-1 shrink-0">
            <Badge
              className={cn(
                "text-xs font-semibold",
                pct >= 75 ? "bg-emerald-100 text-emerald-700" :
                pct >= 50 ? "bg-violet-100 text-violet-700" : "bg-gray-100 text-gray-600"
              )}
            >
              {pct}%
            </Badge>
            <button
              onClick={() => setEditing(true)}
              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-all"
              title="Edit"
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600 transition-all"
              title="Delete"
            >
              {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-3 flex flex-col flex-1">
        <p className="text-sm text-gray-600 leading-relaxed mb-4 flex-1">{insight.description}</p>
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-400">Confidence</span>
            <span className="text-xs text-gray-500 font-medium">{pct}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {affectedSegments.map((seg: string) => (
            <Badge key={seg} variant="secondary" className="text-xs">{seg}</Badge>
          ))}
          {insight.evidenceIds.length > 0 && (
            <span className="text-xs text-gray-400 ml-auto">
              {insight.evidenceIds.length} evidence{insight.evidenceIds.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
