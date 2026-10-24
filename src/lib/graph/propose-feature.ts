import type {
  ActivityItem,
  GraphEdge,
  GraphNode,
  Priority,
  TimelineEvent,
} from "@/types/graph";
import { slugify } from "@/lib/utils";

export interface ProposeFeatureScaffold {
  customerProblem: boolean;
  prd: boolean;
  goal: boolean;
  metric: boolean;
}

export interface ProposeFeatureInput {
  title: string;
  description: string;
  customerProblemText?: string;
  prdText?: string;
  goalText?: string;
  metricText?: string;
  ownerId: string;
  priority: Priority;
  primaryRepo: string;
  primaryRepoUrl: string;
  additionalRepos: { fullName: string; url: string }[];
  scaffold: ProposeFeatureScaffold;
  productId: string;
  source?: string;
}

export interface ProposeFeatureResult {
  featureId: string;
  createdNodeIds: string[];
}

function makeId(prefix: string, title: string): string {
  return `${prefix}-${slugify(title)}-${Date.now().toString(36)}`;
}

export function buildProposedFeatureGraph(input: ProposeFeatureInput): {
  nodes: GraphNode[];
  edges: GraphEdge[];
  timelineEvents: TimelineEvent[];
  activity: ActivityItem;
  featureId: string;
  explorerFeatureId: string;
  explorerProblemId?: string;
} {
  const now = new Date().toISOString();
  const featureId = makeId("feature", input.title);
  const createdNodeIds: string[] = [featureId];

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  const feature: GraphNode = {
    id: featureId,
    type: "FEATURE",
    title: input.title,
    description: input.description,
    summary: input.description.slice(0, 120),
    status: "DRAFT",
    priority: input.priority,
    ownerId: input.ownerId,
    productId: input.productId,
    metadata: {
      primaryRepo: input.primaryRepo,
      primaryRepoUrl: input.primaryRepoUrl,
      additionalRepos: input.additionalRepos,
      proposedAt: now,
      why: input.source?.trim() || "",
    },
    tags: ["proposed"],
    createdAt: now,
    updatedAt: now,
  };
  nodes.push(feature);

  edges.push({
    id: `edge-${featureId}-product`,
    sourceId: featureId,
    targetId: input.productId,
    type: "PART_OF",
    createdAt: now,
  });

  let explorerProblemId: string | undefined;

  if (input.scaffold.customerProblem) {
    const problemId = makeId("problem", input.title);
    explorerProblemId = problemId;
    createdNodeIds.push(problemId);

    nodes.push({
      id: problemId,
      type: "CUSTOMER_PROBLEM",
      title: input.customerProblemText?.trim() || `Problem: ${input.title}`,
      description: input.customerProblemText?.trim() || input.description,
      status: "DRAFT",
      priority: input.priority,
      ownerId: input.ownerId,
      productId: input.productId,
      metadata: {},
      tags: ["proposed"],
      createdAt: now,
      updatedAt: now,
    });

    edges.push({
      id: `edge-${problemId}-${featureId}`,
      sourceId: problemId,
      targetId: featureId,
      type: "ADDRESSES",
      createdAt: now,
    });
  }

  if (input.scaffold.prd) {
    const prdId = makeId("prd", input.title);
    createdNodeIds.push(prdId);

    nodes.push({
      id: prdId,
      type: "PRD",
      title: `${input.title} PRD`,
      description: input.prdText?.trim() || "Draft product requirements — fill in specifications",
      status: "DRAFT",
      ownerId: input.ownerId,
      productId: input.productId,
      metadata: { version: "0.1", template: true },
      tags: ["proposed", "prd"],
      createdAt: now,
      updatedAt: now,
    });

    edges.push({
      id: `edge-${featureId}-${prdId}`,
      sourceId: featureId,
      targetId: prdId,
      type: "IMPLEMENTS",
      createdAt: now,
    });
  }

  if (input.scaffold.goal) {
    const goalId = makeId("goal", input.title);
    createdNodeIds.push(goalId);

    nodes.push({
      id: goalId,
      type: "GOAL",
      title: `Goal: ${input.title}`,
      description: input.goalText?.trim() || "Define success criteria and target metrics",
      status: "DRAFT",
      priority: input.priority,
      ownerId: input.ownerId,
      productId: input.productId,
      metadata: { template: true },
      tags: ["proposed", "okr"],
      createdAt: now,
      updatedAt: now,
    });

    edges.push({
      id: `edge-${goalId}-${featureId}`,
      sourceId: goalId,
      targetId: featureId,
      type: "RELATED_TO",
      createdAt: now,
    });
  }

  if (input.scaffold.metric) {
    const metricId = makeId("metric", input.title);
    createdNodeIds.push(metricId);

    nodes.push({
      id: metricId,
      type: "METRIC",
      title: `${input.title} — Success Metric`,
      description: input.metricText?.trim() || "Define how success will be measured",
      status: "DRAFT",
      ownerId: input.ownerId,
      productId: input.productId,
      metadata: { value: null, target: null, unit: "percent", template: true },
      tags: ["proposed", "metric"],
      createdAt: now,
      updatedAt: now,
    });

    edges.push({
      id: `edge-${metricId}-${featureId}`,
      sourceId: metricId,
      targetId: featureId,
      type: "MEASURES",
      createdAt: now,
    });
  }

  const timelineEvents: TimelineEvent[] = [
    {
      id: `timeline-${featureId}`,
      nodeId: featureId,
      title: "Feature proposed",
      description: `Created in Kismet with ${createdNodeIds.length} graph node(s)`,
      eventType: "idea",
      timestamp: now,
      actorId: input.ownerId,
    },
  ];

  const activity: ActivityItem = {
    id: `activity-${featureId}`,
    type: "create",
    title: `Proposed feature: ${input.title}`,
    description: input.primaryRepo
      ? `Linked to ${input.primaryRepo}${input.additionalRepos.length ? ` + ${input.additionalRepos.length} repo(s)` : ""}`
      : "Added to the product graph",
    nodeId: featureId,
    nodeType: "FEATURE",
    actorId: input.ownerId,
    timestamp: now,
  };

  return {
    nodes,
    edges,
    timelineEvents,
    activity,
    featureId,
    explorerFeatureId: featureId,
    explorerProblemId,
  };
}
