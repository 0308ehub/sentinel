export type NodeType =
  | "PRODUCT"
  | "FEATURE"
  | "CUSTOMER_PROBLEM"
  | "CUSTOMER"
  | "USER_SEGMENT"
  | "REQUIREMENT"
  | "DECISION"
  | "GOAL"
  | "EXPERIMENT"
  | "METRIC"
  | "DASHBOARD"
  | "ANALYTICS_QUERY"
  | "PRD"
  | "DESIGN"
  | "FIGMA_FRAME"
  | "ENGINEERING_TASK"
  | "PULL_REQUEST"
  | "COMMIT"
  | "RELEASE"
  | "LAUNCH"
  | "SUPPORT_TICKET"
  | "CUSTOMER_INTERVIEW"
  | "SLACK_THREAD"
  | "MEETING"
  | "ACTION_ITEM"
  | "TEAM"
  | "PERSON"
  | "API"
  | "DATABASE_TABLE"
  | "SERVICE"
  | "AI_INSIGHT";

export type RelationshipType =
  | "ADDRESSES"
  | "IMPLEMENTS"
  | "BLOCKS"
  | "DEPENDS_ON"
  | "MEASURES"
  | "OWNED_BY"
  | "RELATED_TO"
  | "SUPERSEDES"
  | "VALIDATES"
  | "CAUSED_BY"
  | "RESULTED_IN"
  | "PART_OF"
  | "LINKED_TO";

export type NodeStatus =
  | "DRAFT"
  | "ACTIVE"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "ARCHIVED"
  | "AT_RISK"
  | "STALE";

export type Priority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface Person {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: string;
  teamId?: string;
}

export interface Team {
  id: string;
  name: string;
  description?: string;
}

export interface GraphNode {
  id: string;
  type: NodeType;
  title: string;
  description?: string;
  summary?: string;
  status: NodeStatus;
  priority?: Priority;
  ownerId?: string;
  productId?: string;
  metadata: Record<string, unknown>;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface GraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
  type: RelationshipType;
  label?: string;
  weight?: number;
  createdAt: string;
}

export interface TimelineEvent {
  id: string;
  nodeId: string;
  title: string;
  description?: string;
  eventType: string;
  timestamp: string;
  actorId?: string;
  metadata?: Record<string, unknown>;
}

export interface ActivityItem {
  id: string;
  type: "create" | "update" | "comment" | "link" | "decision" | "launch" | "alert";
  title: string;
  description?: string;
  nodeId?: string;
  nodeType?: NodeType;
  actorId: string;
  timestamp: string;
}

export interface Notification {
  id: string;
  title: string;
  description: string;
  type: "info" | "warning" | "success" | "error";
  read: boolean;
  nodeId?: string;
  timestamp: string;
}

export interface SearchResult {
  id: string;
  type: NodeType;
  title: string;
  description?: string;
  score: number;
  breadcrumb?: string;
}

export interface AIRecommendation {
  id: string;
  title: string;
  description: string;
  confidence: number;
  nodeIds: string[];
  category: "risk" | "opportunity" | "action" | "insight";
}

export interface ProductHealth {
  score: number;
  trend: "up" | "down" | "stable";
  metrics: {
    label: string;
    value: string;
    change: number;
    status: "good" | "warning" | "critical";
  }[];
}

export interface AnalyticsRow {
  id: string;
  feature: string;
  metric: string;
  value: number;
  change: number;
  period: string;
  owner?: string;
  linkedNodeId?: string;
}

export interface DecisionRecord {
  id: string;
  title: string;
  question: string;
  decision: string;
  rationale: string;
  alternatives: string[];
  approverIds: string[];
  evidenceNodeIds: string[];
  outcome?: string;
  status: NodeStatus;
  createdAt: string;
}

export interface GraphSnapshot {
  nodes: GraphNode[];
  edges: GraphEdge[];
  people: Person[];
  teams: Team[];
  timeline: TimelineEvent[];
  activities: ActivityItem[];
  notifications: Notification[];
}
