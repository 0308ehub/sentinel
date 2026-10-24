import type {
  ActivityItem,
  AIRecommendation,
  AnalyticsRow,
  DecisionRecord,
  GraphEdge,
  GraphNode,
  GraphSnapshot,
  Notification,
  Person,
  ProductHealth,
  Team,
  TimelineEvent,
} from "@/types/graph";

const now = "2026-10-15T00:00:00.000Z";

export const teams: Team[] = [];

export const people: Person[] = [
  {
    id: "person-you",
    name: "You",
    email: "",
    role: "Product",
    teamId: "",
  },
];

export const nodes: GraphNode[] = [
  {
    id: "product-workspace",
    type: "PRODUCT",
    title: "Workspace",
    description: "Features, problems, and evidence you add or import.",
    summary: "Empty until you connect a source or add a feature.",
    status: "ACTIVE",
    ownerId: "person-you",
    productId: "product-workspace",
    metadata: {},
    tags: [],
    createdAt: now,
    updatedAt: now,
  },
];

export const edges: GraphEdge[] = [];
export const timeline: TimelineEvent[] = [];
export const activities: ActivityItem[] = [];
export const notifications: Notification[] = [];
export const aiRecommendations: AIRecommendation[] = [];

export const productHealth: ProductHealth = {
  score: 0,
  trend: "stable",
  metrics: [],
};

export const analyticsRows: AnalyticsRow[] = [];
export const decisions: DecisionRecord[] = [];

export const graphSnapshot: GraphSnapshot = {
  nodes,
  edges,
  people,
  teams,
  timeline,
  activities,
  notifications,
};

export function getPerson(id: string): Person | undefined {
  return people.find((p) => p.id === id);
}

export function getNode(id: string): GraphNode | undefined {
  return nodes.find((n) => n.id === id);
}

export function getConnectedNodes(nodeId: string): { node: GraphNode; edge: GraphEdge }[] {
  const connected = edges.filter((e) => e.sourceId === nodeId || e.targetId === nodeId);
  return connected
    .map((edge) => {
      const otherId = edge.sourceId === nodeId ? edge.targetId : edge.sourceId;
      const node = nodes.find((n) => n.id === otherId);
      return node ? { node, edge } : null;
    })
    .filter((x): x is { node: GraphNode; edge: GraphEdge } => x !== null);
}

export function getFeatureTimeline(featureId: string): TimelineEvent[] {
  return timeline
    .filter((t) => t.nodeId === featureId)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

export const EXPLORER_TREE = {
  products: [
    {
      id: "product-workspace",
      name: "Workspace",
      features: [] as string[],
      problems: [] as string[],
      experiments: [] as string[],
    },
  ],
};
