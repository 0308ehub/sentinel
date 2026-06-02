"use client";

import { useState, useEffect, useId } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Ticket, GripVertical, Trash2, FileText } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";

export interface PRDItem {
  id: string;
  title: string;
  createdAt: string;
  opportunity: { id: string; title: string } | null;
  _count: { tickets: number };
}

function SortablePRDCard({
  prd,
  workspaceId,
  onDelete,
  deleting,
}: {
  prd: PRDItem;
  workspaceId: string;
  onDelete: (id: string) => void;
  deleting: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: prd.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "transition-opacity",
        isDragging && "opacity-40 z-50",
        deleting && "opacity-40 pointer-events-none"
      )}
    >
      <Card className="bg-white hover:border-indigo-200 transition-all group">
        <CardHeader className="pb-0">
          <div className="flex items-start gap-2">
            {/* Drag handle */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger
                  {...attributes}
                  {...listeners}
                  className="mt-0.5 text-gray-200 hover:text-gray-400 cursor-grab active:cursor-grabbing shrink-0 touch-none transition-colors"
                  tabIndex={-1}
                  aria-label="Drag to reorder"
                >
                  <GripVertical className="h-4 w-4" />
                </TooltipTrigger>
                <TooltipContent>Drag to reorder</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Title — navigates on click */}
            <Link
              href={`/workspaces/${workspaceId}/prd/${prd.id}`}
              className="flex-1 min-w-0"
            >
              <CardTitle className="text-sm text-gray-900 leading-snug group-hover:text-indigo-700 transition-colors">
                {prd.title}
              </CardTitle>
            </Link>

            {/* Right: ticket badge + delete */}
            <div className="flex items-center gap-1.5 shrink-0">
              {prd._count.tickets > 0 && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <Ticket className="h-3 w-3" />
                  {prd._count.tickets} ticket{prd._count.tickets !== 1 ? "s" : ""}
                </Badge>
              )}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onDelete(prd.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all p-1 rounded"
                    aria-label="Delete PRD"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </TooltipTrigger>
                  <TooltipContent>Delete PRD</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-2 pl-8">
          {prd.opportunity && (
            <p className="text-xs text-indigo-600 font-medium mb-1.5 flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-400" />
              {prd.opportunity.title}
            </p>
          )}
          <p className="text-xs text-gray-400">Created {formatDate(prd.createdAt)}</p>
        </CardContent>
      </Card>
    </div>
  );
}

export function PRDListClient({
  initialPRDs,
  workspaceId,
}: {
  initialPRDs: PRDItem[];
  workspaceId: string;
}) {
  const router = useRouter();
  const storageKey = `prd-order:${workspaceId}`;

  const [prds, setPRDs] = useState<PRDItem[]>(initialPRDs);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  // Restore saved sort order from localStorage after hydration
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (!saved) return;
      const order: string[] = JSON.parse(saved);
      const orderMap = new Map(order.map((id, i) => [id, i]));
      setPRDs((prev) =>
        [...prev].sort((a, b) => (orderMap.get(a.id) ?? Infinity) - (orderMap.get(b.id) ?? Infinity))
      );
    } catch {
      /* ignore corrupt storage */
    }
  }, [storageKey]);

  const dndId = useId();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setPRDs((items) => {
      const oldIdx = items.findIndex((p) => p.id === active.id);
      const newIdx = items.findIndex((p) => p.id === over.id);
      const next = arrayMove(items, oldIdx, newIdx);
      localStorage.setItem(storageKey, JSON.stringify(next.map((p) => p.id)));
      return next;
    });
  }

  async function handleDelete(prdId: string) {
    if (!confirm("Delete this PRD and its tickets? This cannot be undone.")) return;

    setDeletingIds((s) => new Set(s).add(prdId));
    // Optimistic remove
    setPRDs((prev) => prev.filter((p) => p.id !== prdId));

    try {
      const res = await fetch(`/api/prds/${prdId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast.success("PRD deleted");
      router.refresh();
    } catch {
      toast.error("Failed to delete PRD");
      setPRDs(initialPRDs);
    } finally {
      setDeletingIds((s) => { const next = new Set(s); next.delete(prdId); return next; });
    }
  }

  if (prds.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-dashed p-12 text-center">
        <FileText className="h-10 w-10 text-gray-200 mx-auto mb-3" />
        <p className="text-sm text-gray-500">No PRDs yet. Generate your first one using the form.</p>
      </div>
    );
  }

  return (
    <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={prds.map((p) => p.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-3">
          {prds.map((prd) => (
            <SortablePRDCard
              key={prd.id}
              prd={prd}
              workspaceId={workspaceId}
              onDelete={handleDelete}
              deleting={deletingIds.has(prd.id)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
