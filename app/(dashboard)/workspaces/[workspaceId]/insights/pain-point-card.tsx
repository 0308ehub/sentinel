"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Pencil, Trash2, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface PainPoint {
  id: string;
  title: string;
  description: string;
  severity: number;
  urgency: number;
  frequency: number;
  affectedSegments: string[];
  evidenceIds: string[];
}

function severityBadgeClass(score: number) {
  if (score >= 8) return "bg-red-100 text-red-700 border-red-200";
  if (score >= 5) return "bg-orange-100 text-orange-700 border-orange-200";
  return "bg-yellow-100 text-yellow-700 border-yellow-200";
}

export function PainPointCard({
  pp,
  workspaceId,
}: {
  pp: PainPoint;
  workspaceId: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState(pp.title);
  const [description, setDescription] = useState(pp.description);
  const [severity, setSeverity] = useState(pp.severity);
  const [urgency, setUrgency] = useState(pp.urgency);
  const [segmentsRaw, setSegmentsRaw] = useState(pp.affectedSegments.join(", "));

  function cancelEdit() {
    setTitle(pp.title);
    setDescription(pp.description);
    setSeverity(pp.severity);
    setUrgency(pp.urgency);
    setSegmentsRaw(pp.affectedSegments.join(", "));
    setEditing(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/pain-points/${pp.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            description,
            severity,
            urgency,
            affectedSegments: segmentsRaw.split(",").map((s) => s.trim()).filter(Boolean),
          }),
        }
      );
      if (!res.ok) throw new Error("Update failed");
      toast.success("Pain point updated");
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
        `/api/workspaces/${workspaceId}/pain-points/${pp.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Delete failed");
      toast.success("Pain point deleted");
      router.refresh();
    } catch {
      toast.error("Failed to delete pain point");
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
          />
        </CardHeader>
        <CardContent className="pt-3 space-y-3">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full text-sm text-gray-600 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none"
          />

          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-xs font-medium text-gray-500">Severity (1–10)</span>
              <input
                type="number"
                min={1}
                max={10}
                value={severity}
                onChange={(e) => setSeverity(Number(e.target.value))}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-gray-500">Urgency (1–10)</span>
              <input
                type="number"
                min={1}
                max={10}
                value={urgency}
                onChange={(e) => setUrgency(Number(e.target.value))}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
              />
            </label>
          </div>

          <label className="space-y-1 block">
            <span className="text-xs font-medium text-gray-500">Affected Segments (comma-separated)</span>
            <input
              value={segmentsRaw}
              onChange={(e) => setSegmentsRaw(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
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
    <Card className="bg-white group">
      <CardHeader className="pb-0">
        <div className="flex items-start justify-between gap-4">
          <CardTitle className="text-base text-gray-900">{pp.title}</CardTitle>
          <div className="flex items-center gap-2 shrink-0">
            <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full border", severityBadgeClass(pp.severity))}>
              Severity {pp.severity}/10
            </span>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-violet-100 text-violet-700 border border-violet-200">
              Urgency {pp.urgency}/10
            </span>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
              {pp.frequency} {pp.frequency === 1 ? "mention" : "mentions"}
            </span>
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
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-3">
        <p className="text-sm text-gray-600 leading-relaxed mb-3">{pp.description}</p>
        <div className="flex flex-wrap items-center gap-2">
          {pp.affectedSegments.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {pp.affectedSegments.map((seg) => (
                <Badge key={seg} variant="secondary" className="text-xs">{seg}</Badge>
              ))}
            </div>
          )}
          {pp.evidenceIds.length > 0 && (
            <span className="text-xs text-gray-400 ml-auto">
              {pp.evidenceIds.length} evidence{pp.evidenceIds.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
