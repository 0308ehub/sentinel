import type { NodeType } from "@/types/graph";
import { getNodeLabel, getNodeColor } from "@/lib/graph";
import { cn } from "@/lib/utils";

export function NodeTypeBadge({ type, className }: { type: NodeType; className?: string }) {
  const color = getNodeColor(type);
  return (
    <span
      className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide", className)}
      style={{ backgroundColor: `${color}15`, color }}
    >
      {getNodeLabel(type)}
    </span>
  );
}
