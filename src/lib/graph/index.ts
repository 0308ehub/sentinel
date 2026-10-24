import type { GraphEdge, GraphNode, NodeType, SearchResult } from "@/types/graph";
import { getGraphEdges, getGraphNode, getGraphNodes } from "@/lib/graph/graph-store";

export function getNodeLabel(type: NodeType): string {
  const labels: Record<NodeType, string> = {
    PRODUCT: "Product",
    FEATURE: "Feature",
    CUSTOMER_PROBLEM: "Problem",
    CUSTOMER: "Customer",
    USER_SEGMENT: "Segment",
    REQUIREMENT: "Requirement",
    DECISION: "Decision",
    GOAL: "Goal",
    EXPERIMENT: "Experiment",
    METRIC: "Metric",
    DASHBOARD: "Dashboard",
    ANALYTICS_QUERY: "Query",
    PRD: "PRD",
    DESIGN: "Design",
    FIGMA_FRAME: "Figma",
    ENGINEERING_TASK: "Task",
    PULL_REQUEST: "PR",
    COMMIT: "Commit",
    RELEASE: "Release",
    LAUNCH: "Launch",
    SUPPORT_TICKET: "Ticket",
    CUSTOMER_INTERVIEW: "Interview",
    SLACK_THREAD: "Slack",
    MEETING: "Meeting",
    ACTION_ITEM: "Action",
    TEAM: "Team",
    PERSON: "Person",
    API: "API",
    DATABASE_TABLE: "Table",
    SERVICE: "Service",
    AI_INSIGHT: "Insight",
  };
  return labels[type] ?? type;
}

export function getNodeColor(type: NodeType): string {
  const colors: Record<NodeType, string> = {
    PRODUCT: "#0571d3",
    FEATURE: "#111111",
    CUSTOMER_PROBLEM: "#d93025",
    CUSTOMER: "#5c6772",
    USER_SEGMENT: "#7d8794",
    REQUIREMENT: "#6a717c",
    DECISION: "#1d4e89",
    GOAL: "#0571d3",
    EXPERIMENT: "#c4a15a",
    METRIC: "#0e7c86",
    DASHBOARD: "#0e7c86",
    ANALYTICS_QUERY: "#0e7c86",
    PRD: "#374151",
    DESIGN: "#8b949e",
    FIGMA_FRAME: "#8b949e",
    ENGINEERING_TASK: "#1d4e89",
    PULL_REQUEST: "#1d4e89",
    COMMIT: "#4b5563",
    RELEASE: "#111111",
    LAUNCH: "#0571d3",
    SUPPORT_TICKET: "#d93025",
    CUSTOMER_INTERVIEW: "#6a717c",
    SLACK_THREAD: "#3d5a80",
    MEETING: "#6a717c",
    ACTION_ITEM: "#6a717c",
    TEAM: "#6a717c",
    PERSON: "#8b949e",
    API: "#1d4e89",
    DATABASE_TABLE: "#0e7c86",
    SERVICE: "#374151",
    AI_INSIGHT: "#0571d3",
  };
  return colors[type] ?? "#5f6368";
}

export function getOutgoingEdges(nodeId: string): GraphEdge[] {
  return getGraphEdges().filter((e) => e.sourceId === nodeId);
}

export function getIncomingEdges(nodeId: string): GraphEdge[] {
  return getGraphEdges().filter((e) => e.targetId === nodeId);
}

export function getShortestPath(fromId: string, toId: string): string[] | null {
  const edges = getGraphEdges();
  if (fromId === toId) return [fromId];
  const visited = new Set<string>();
  const queue: { id: string; path: string[] }[] = [{ id: fromId, path: [fromId] }];

  while (queue.length > 0) {
    const { id, path } = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);

    const neighbors = edges
      .filter((e) => e.sourceId === id || e.targetId === id)
      .map((e) => (e.sourceId === id ? e.targetId : e.sourceId));

    for (const neighbor of neighbors) {
      if (neighbor === toId) return [...path, neighbor];
      if (!visited.has(neighbor)) {
        queue.push({ id: neighbor, path: [...path, neighbor] });
      }
    }
  }
  return null;
}

export function buildFlowGraph(
  centerNodeId?: string,
  filterTypes?: NodeType[]
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const allNodes = getGraphNodes();
  const allEdges = getGraphEdges();
  let filteredNodes = allNodes;
  let filteredEdges = allEdges;

  if (filterTypes?.length) {
    filteredNodes = allNodes.filter((n) => filterTypes.includes(n.type));
    const nodeIds = new Set(filteredNodes.map((n) => n.id));
    filteredEdges = allEdges.filter(
      (e) => nodeIds.has(e.sourceId) && nodeIds.has(e.targetId)
    );
  }

  if (centerNodeId) {
    const connectedIds = new Set<string>([centerNodeId]);
    const queue = [centerNodeId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const edge of allEdges) {
        if (edge.sourceId === current && !connectedIds.has(edge.targetId)) {
          connectedIds.add(edge.targetId);
          queue.push(edge.targetId);
        }
        if (edge.targetId === current && !connectedIds.has(edge.sourceId)) {
          connectedIds.add(edge.sourceId);
          queue.push(edge.sourceId);
        }
      }
    }
    filteredNodes = filteredNodes.filter((n) => connectedIds.has(n.id));
    const nodeIds = new Set(filteredNodes.map((n) => n.id));
    filteredEdges = filteredEdges.filter(
      (e) => nodeIds.has(e.sourceId) && nodeIds.has(e.targetId)
    );
  }

  return { nodes: filteredNodes, edges: filteredEdges };
}

export function searchGraph(query: string, limit = 20): SearchResult[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  const nodes = getGraphNodes();
  const results: SearchResult[] = [];

  for (const node of nodes) {
    const titleMatch = node.title.toLowerCase().includes(q);
    const descMatch = node.description?.toLowerCase().includes(q);
    const tagMatch = node.tags.some((t) => t.toLowerCase().includes(q));
    const typeMatch = getNodeLabel(node.type).toLowerCase().includes(q);

    if (!titleMatch && !descMatch && !tagMatch && !typeMatch) continue;

    let score = 0;
    if (node.title.toLowerCase().startsWith(q)) score += 10;
    else if (titleMatch) score += 5;
    if (descMatch) score += 2;
    if (tagMatch) score += 3;
    if (typeMatch) score += 1;

    const product = node.productId ? getGraphNode(node.productId) : null;

    results.push({
      id: node.id,
      type: node.type,
      title: node.title,
      description: node.description,
      score,
      breadcrumb: product ? `${product.title} › ${getNodeLabel(node.type)}` : getNodeLabel(node.type),
    });
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

export function getUpstreamNodes(nodeId: string): GraphNode[] {
  return getIncomingEdges(nodeId)
    .map((e) => getGraphNode(e.sourceId))
    .filter((n): n is GraphNode => n !== undefined);
}

export function getDownstreamNodes(nodeId: string): GraphNode[] {
  return getOutgoingEdges(nodeId)
    .map((e) => getGraphNode(e.targetId))
    .filter((n): n is GraphNode => n !== undefined);
}
