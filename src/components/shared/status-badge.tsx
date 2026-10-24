import type { NodeStatus, Priority } from "@/types/graph";
import { Badge } from "@/components/ui/badge";

const STATUS_VARIANT: Record<NodeStatus, "default" | "secondary" | "destructive" | "success" | "warning" | "muted"> = {
  DRAFT: "muted",
  ACTIVE: "default",
  IN_PROGRESS: "default",
  COMPLETED: "success",
  ARCHIVED: "muted",
  AT_RISK: "destructive",
  STALE: "warning",
};

const STATUS_LABEL: Record<NodeStatus, string> = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
  AT_RISK: "At Risk",
  STALE: "Stale",
};

export function StatusBadge({ status }: { status: NodeStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}

const PRIORITY_VARIANT: Record<Priority, "destructive" | "warning" | "secondary" | "muted"> = {
  CRITICAL: "destructive",
  HIGH: "warning",
  MEDIUM: "secondary",
  LOW: "muted",
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <Badge variant={PRIORITY_VARIANT[priority]}>{priority}</Badge>;
}
