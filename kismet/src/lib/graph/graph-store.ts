import { useSyncExternalStore } from "react";
import { createStore } from "zustand/vanilla";
import { persist } from "zustand/middleware";
import { useStore } from "zustand";
import type {
  ActivityItem,
  GraphEdge,
  GraphNode,
  NodeStatus,
  Priority,
  TimelineEvent,
} from "@/types/graph";
import type { ExperimentAllocation } from "@/lib/experiments/allocation";
import { slugify } from "@/lib/utils";
import {
  nodes as initialNodes,
  edges as initialEdges,
  timeline as initialTimeline,
  activities as initialActivities,
  EXPLORER_TREE as initialExplorerTree,
} from "@/lib/data/seed";
import {
  buildProposedFeatureGraph,
  type ProposeFeatureInput,
  type ProposeFeatureResult,
} from "@/lib/graph/propose-feature";

export interface FileIssueInput {
  title: string;
  repro: string;
  platform: string;
  page?: string;
  ownerId: string;
  productId: string;
  priority?: Priority;
}

export interface ImportSlackThreadInput {
  channelId: string;
  channelName: string;
  ts: string;
  text: string;
  authorName: string;
  postedAt: string;
  replyCount: number;
  permalink?: string;
  linkedFeatureId?: string;
  actorId: string;
  productId: string;
}

export interface ExperimentInput {
  title: string;
  hypothesis: string;
  metric: string;
  control: string;
  treatment: string;
  guardrail: string;
  ownerId: string;
  productId: string;
}

export interface ExplorerTree {
  products: {
    id: string;
    name: string;
    features: string[];
    problems: string[];
    experiments: string[];
  }[];
}

interface GraphState {
  nodes: GraphNode[];
  edges: GraphEdge[];
  timeline: TimelineEvent[];
  activities: ActivityItem[];
  explorerTree: ExplorerTree;
  proposeFeature: (input: ProposeFeatureInput) => ProposeFeatureResult;
  noteJira: (featureId: string, jira: { key: string; url: string; sprint?: string }) => void;
  saveExperiment: (input: ExperimentInput) => string;
  shipExperiment: (experimentId: string, jira: { key: string; url: string; sprint?: string }) => void;
  notePullRequest: (id: string, pull: { url: string; number: number; repo: string; branch: string }) => void;
  fileIssue: (input: FileIssueInput) => string;
  moveWork: (id: string, status: NodeStatus) => void;
  updateWorkDoc: (id: string, patch: { title?: string; body?: string }) => void;
  saveExperimentPlan: (id: string, plan: ExperimentAllocation) => void;
  noteExperimentReadout: (id: string, readout: { state: string; summary: string }) => void;
  attachSource: (input: { connectorId: string; name: string; filesAs: string; ownerId: string; productId: string }) => void;
  detachSource: (connectorId: string) => void;
  importSlackThread: (input: ImportSlackThreadInput) => string;
  resetGraph: () => void;
}

export function slackThreadNodeId(channelId: string, ts: string): string {
  return `slack-${channelId}-${ts.replace(".", "")}`;
}

export const graphStore = createStore<GraphState>()(
  persist(
    (set, get) => ({
      nodes: [...initialNodes],
      edges: [...initialEdges],
      timeline: [...initialTimeline],
      activities: [...initialActivities],
      explorerTree: structuredClone(initialExplorerTree),

      proposeFeature: (input) => {
        const built = buildProposedFeatureGraph(input);

        set((state) => {
          const explorerTree = structuredClone(state.explorerTree);
          const product = explorerTree.products.find((p) => p.id === input.productId);
          if (product) {
            product.features.unshift(built.explorerFeatureId);
            if (built.explorerProblemId) {
              product.problems.unshift(built.explorerProblemId);
            }
          }

          return {
            nodes: [...built.nodes, ...state.nodes],
            edges: [...built.edges, ...state.edges],
            timeline: [...built.timelineEvents, ...state.timeline],
            activities: [built.activity, ...state.activities],
            explorerTree,
          };
        });

        return { featureId: built.featureId, createdNodeIds: built.nodes.map((n) => n.id) };
      },

      noteJira: (featureId, jira) => {
        set((state) => ({
          nodes: state.nodes.map((node) =>
            node.id === featureId
              ? {
                  ...node,
                  metadata: { ...node.metadata, jiraKey: jira.key, jiraUrl: jira.url, jiraSprint: jira.sprint },
                  updatedAt: new Date().toISOString(),
                }
              : node
          ),
        }));
      },

      saveExperiment: (input) => {
        const now = new Date().toISOString();
        const id = `experiment-${slugify(input.title).slice(0, 48) || "draft"}-${Date.now().toString(36)}`;
        const node: GraphNode = {
          id,
          type: "EXPERIMENT",
          title: input.title,
          description: input.hypothesis,
          status: "DRAFT",
          ownerId: input.ownerId,
          productId: input.productId,
          metadata: {
            hypothesis: input.hypothesis,
            metric: input.metric,
            control: input.control,
            treatment: input.treatment,
            guardrail: input.guardrail,
          },
          tags: ["experiment"],
          createdAt: now,
          updatedAt: now,
        };
        const edge: GraphEdge = {
          id: `edge-${id}-product`,
          sourceId: id,
          targetId: input.productId,
          type: "PART_OF",
          createdAt: now,
        };
        set((state) => {
          const explorerTree = structuredClone(state.explorerTree);
          const product = explorerTree.products.find((item) => item.id === input.productId);
          if (product) product.experiments.unshift(id);
          return {
            nodes: [node, ...state.nodes],
            edges: [edge, ...state.edges],
            timeline: [
              {
                id: `timeline-${id}`,
                nodeId: id,
                title: "Experiment drafted",
                description: input.hypothesis,
                eventType: "idea",
                timestamp: now,
                actorId: input.ownerId,
              },
              ...state.timeline,
            ],
            activities: [
              {
                id: `activity-${id}`,
                type: "create",
                title: `Drafted experiment: ${input.title}`,
                description: input.metric,
                nodeId: id,
                nodeType: "EXPERIMENT",
                actorId: input.ownerId,
                timestamp: now,
              },
              ...state.activities,
            ],
            explorerTree,
          };
        });
        return id;
      },

      shipExperiment: (experimentId, jira) => {
        const now = new Date().toISOString();
        set((state) => ({
          nodes: state.nodes.map((node) =>
            node.id === experimentId
              ? {
                  ...node,
                  status: "IN_PROGRESS",
                  metadata: { ...node.metadata, jiraKey: jira.key, jiraUrl: jira.url, jiraSprint: jira.sprint },
                  updatedAt: now,
                }
              : node
          ),
        }));
      },

      notePullRequest: (id, pull) => {
        const now = new Date().toISOString();
        set((state) => {
          const current = state.nodes.find((node) => node.id === id);
          return {
            nodes: state.nodes.map((node) =>
              node.id === id
                ? {
                    ...node,
                    status: node.status === "COMPLETED" || node.status === "ARCHIVED" ? node.status : "IN_PROGRESS",
                    metadata: {
                      ...node.metadata,
                      prUrl: pull.url,
                      prNumber: pull.number,
                      prRepo: pull.repo,
                      prBranch: pull.branch,
                    },
                    updatedAt: now,
                  }
                : node
            ),
            timeline: [
              {
                id: `timeline-pr-${id}-${Date.now().toString(36)}`,
                nodeId: id,
                title: `Opened pull request #${pull.number}`,
                description: pull.url,
                eventType: "status",
                timestamp: now,
                actorId: current?.ownerId,
              },
              ...state.timeline,
            ],
            activities: [
              {
                id: `activity-pr-${id}-${Date.now().toString(36)}`,
                type: "update" as const,
                title: `Opened a pull request for ${current?.title ?? "an experiment"}`,
                description: `${pull.repo} #${pull.number}`,
                nodeId: id,
                nodeType: "EXPERIMENT" as const,
                actorId: current?.ownerId ?? "person-you",
                timestamp: now,
              },
              ...state.activities,
            ],
          };
        });
      },

      attachSource: (input) => {
        const now = new Date().toISOString();
        const id = `source-${input.connectorId}`;
        const description = `Files ${input.filesAs} onto the product graph.`;
        set((state) => {
          const existing = state.nodes.some((node) => node.id === id);
          const node: GraphNode = {
            id,
            type: "SERVICE",
            title: input.name,
            description,
            status: "ACTIVE",
            ownerId: input.ownerId,
            productId: input.productId,
            metadata: { connectorId: input.connectorId, filesAs: input.filesAs },
            tags: ["connector"],
            createdAt: existing ? state.nodes.find((item) => item.id === id)?.createdAt ?? now : now,
            updatedAt: now,
          };
          const nodes = existing
            ? state.nodes.map((item) => (item.id === id ? node : item))
            : [node, ...state.nodes];
          const edgeId = `edge-${id}-product`;
          const edges = state.edges.some((edge) => edge.id === edgeId)
            ? state.edges
            : [
                {
                  id: edgeId,
                  sourceId: id,
                  targetId: input.productId,
                  type: "PART_OF" as const,
                  createdAt: now,
                },
                ...state.edges,
              ];
          return { nodes, edges };
        });
      },

      detachSource: (connectorId) => {
        const id = `source-${connectorId}`;
        set((state) => ({
          nodes: state.nodes.filter((node) => node.id !== id),
          edges: state.edges.filter((edge) => edge.sourceId !== id && edge.targetId !== id),
        }));
      },

      importSlackThread: (input) => {
        const nodeId = slackThreadNodeId(input.channelId, input.ts);
        const now = new Date().toISOString();
        const firstLine = input.text.split("\n")[0].trim();
        const title = `#${input.channelName} — ${
          firstLine.length > 70 ? `${firstLine.slice(0, 67)}…` : firstLine || "Slack thread"
        }`;

        const node: GraphNode = {
          id: nodeId,
          type: "SLACK_THREAD",
          title,
          description: input.text,
          status: "ACTIVE",
          ownerId: input.actorId,
          productId: input.productId,
          metadata: {
            channel: `#${input.channelName}`,
            channelId: input.channelId,
            ts: input.ts,
            author: input.authorName,
            messages: input.replyCount + 1,
            permalink: input.permalink,
          },
          tags: ["slack"],
          createdAt: input.postedAt,
          updatedAt: now,
        };

        set((state) => {
          const nodes = state.nodes.some((n) => n.id === nodeId)
            ? state.nodes.map((n) => (n.id === nodeId ? { ...node, createdAt: n.createdAt } : n))
            : [node, ...state.nodes];

          const edgeId = input.linkedFeatureId ? `edge-${nodeId}-${input.linkedFeatureId}` : null;
          const edges =
            edgeId && !state.edges.some((e) => e.id === edgeId)
              ? [
                  {
                    id: edgeId,
                    sourceId: nodeId,
                    targetId: input.linkedFeatureId!,
                    type: "LINKED_TO" as const,
                    createdAt: now,
                  },
                  ...state.edges,
                ]
              : state.edges;

          return {
            nodes,
            edges,
            timeline: [
              {
                id: `timeline-${nodeId}-${now}`,
                nodeId: input.linkedFeatureId ?? nodeId,
                title: `Slack thread linked from #${input.channelName}`,
                description: firstLine,
                eventType: "feedback",
                timestamp: now,
                actorId: input.actorId,
              },
              ...state.timeline,
            ],
            activities: [
              {
                id: `activity-${nodeId}-${now}`,
                type: "link",
                title: `Imported Slack thread from #${input.channelName}`,
                description: firstLine,
                nodeId,
                nodeType: "SLACK_THREAD",
                actorId: input.actorId,
                timestamp: now,
              },
              ...state.activities,
            ],
          };
        });

        return nodeId;
      },

      fileIssue: (input) => {
        const now = new Date().toISOString();
        const id = `bug-${slugify(input.title).slice(0, 48) || "report"}-${Date.now().toString(36)}`;
        const node: GraphNode = {
          id,
          type: "ENGINEERING_TASK",
          title: input.title,
          description: input.repro,
          status: "DRAFT",
          priority: input.priority ?? "MEDIUM",
          ownerId: input.ownerId,
          productId: input.productId,
          metadata: {
            kind: "bug",
            platform: input.platform,
            repro: input.repro,
            page: input.page ?? "",
          },
          tags: ["bug", input.platform.toLowerCase()],
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          nodes: [node, ...state.nodes],
          edges: [
            {
              id: `edge-${id}-product`,
              sourceId: id,
              targetId: input.productId,
              type: "PART_OF",
              createdAt: now,
            },
            ...state.edges,
          ],
          timeline: [
            {
              id: `timeline-${id}`,
              nodeId: id,
              title: "Bug filed",
              description: input.page ? `Seen on ${input.page}` : input.repro,
              eventType: "idea",
              timestamp: now,
              actorId: input.ownerId,
            },
            ...state.timeline,
          ],
          activities: [
            {
              id: `activity-${id}`,
              type: "create",
              title: `Filed bug: ${input.title}`,
              description: input.repro,
              nodeId: id,
              nodeType: "ENGINEERING_TASK",
              actorId: input.ownerId,
              timestamp: now,
            },
            ...state.activities,
          ],
        }));
        return id;
      },

      moveWork: (id, status) => {
        const now = new Date().toISOString();
        const label =
          status === "DRAFT" ? "Backlog" : status === "ACTIVE" ? "To do" : status === "IN_PROGRESS" ? "In progress" : "Done";
        set((state) => ({
          nodes: state.nodes.map((node) => (node.id === id ? { ...node, status, updatedAt: now } : node)),
          timeline: [
            {
              id: `timeline-move-${id}-${Date.now().toString(36)}`,
              nodeId: id,
              title: `Moved to ${label}`,
              eventType: "status",
              timestamp: now,
            },
            ...state.timeline,
          ],
        }));
      },

      saveExperimentPlan: (id, plan) => {
        const now = new Date().toISOString();
        set((state) => ({
          nodes: state.nodes.map((node) =>
            node.id === id ? { ...node, metadata: { ...node.metadata, allocation: plan }, updatedAt: now } : node
          ),
        }));
      },

      noteExperimentReadout: (id, readout) => {
        const now = new Date().toISOString();
        set((state) => {
          const current = state.nodes.find((node) => node.id === id);
          const previous = typeof current?.metadata.readoutState === "string" ? current.metadata.readoutState : "";
          const previousSummary = typeof current?.metadata.readoutSummary === "string" ? current.metadata.readoutSummary : "";
          if (previous === readout.state && previousSummary === readout.summary) return state;
          const changed = previous !== readout.state && (readout.state === "significant" || readout.state === "no_difference");
          return {
            nodes: state.nodes.map((node) =>
              node.id === id
                ? { ...node, metadata: { ...node.metadata, readoutState: readout.state, readoutSummary: readout.summary }, updatedAt: now }
                : node
            ),
            timeline: changed
              ? [
                  {
                    id: `timeline-readout-${id}-${Date.now().toString(36)}`,
                    nodeId: id,
                    title: readout.state === "significant" ? "Experiment reached significance" : "Experiment resolved",
                    description: readout.summary,
                    eventType: "status" as const,
                    timestamp: now,
                    actorId: current?.ownerId,
                  },
                  ...state.timeline,
                ]
              : state.timeline,
            activities: changed
              ? [
                  {
                    id: `activity-readout-${id}-${Date.now().toString(36)}`,
                    type: "decision" as const,
                    title: readout.state === "significant" ? "An experiment reached significance" : "An experiment resolved",
                    description: readout.summary.slice(0, 96),
                    nodeId: id,
                    nodeType: "EXPERIMENT" as const,
                    actorId: current?.ownerId ?? "person-you",
                    timestamp: now,
                  },
                  ...state.activities,
                ]
              : state.activities,
          };
        });
      },

      updateWorkDoc: (id, patch) => {
        const now = new Date().toISOString();
        const title = patch.title?.trim();
        set((state) => ({
          nodes: state.nodes.map((node) => {
            if (node.id !== id) return node;
            const bug = node.metadata.kind === "bug";
            const body = patch.body;
            return {
              ...node,
              title: title || node.title,
              description: body ?? node.description,
              summary: (body ?? node.description ?? node.summary ?? "").slice(0, 120),
              metadata: body !== undefined && bug ? { ...node.metadata, repro: body } : node.metadata,
              updatedAt: now,
            };
          }),
        }));
      },

      resetGraph: () =>
        set({
          nodes: [...initialNodes],
          edges: [...initialEdges],
          timeline: [...initialTimeline],
          activities: [...initialActivities],
          explorerTree: structuredClone(initialExplorerTree),
        }),
    }),
    {
      name: "product-ide-graph",
      version: 2,
      migrate: () => ({
        nodes: [...initialNodes],
        edges: [...initialEdges],
        timeline: [...initialTimeline],
        activities: [...initialActivities],
        explorerTree: structuredClone(initialExplorerTree),
      }),
      partialize: (state) => ({
        nodes: state.nodes,
        edges: state.edges,
        timeline: state.timeline,
        activities: state.activities,
        explorerTree: state.explorerTree,
      }),
    }
  )
);

export function useGraphStore<T>(selector: (state: GraphState) => T): T {
  return useStore(graphStore, selector);
}

export function useGraphHydrated(): boolean {
  return useSyncExternalStore(
    (onChange) => graphStore.persist.onFinishHydration(onChange),
    () => graphStore.persist.hasHydrated(),
    () => false,
  );
}

export function getGraphNode(id: string): GraphNode | undefined {
  return graphStore.getState().nodes.find((n) => n.id === id);
}

export function getGraphNodes(): GraphNode[] {
  return graphStore.getState().nodes;
}

export function getGraphEdges(): GraphEdge[] {
  return graphStore.getState().edges;
}

export function getConnectedGraphNodes(nodeId: string): { node: GraphNode; edge: GraphEdge }[] {
  const { nodes, edges } = graphStore.getState();
  const connected = edges.filter((e) => e.sourceId === nodeId || e.targetId === nodeId);

  return connected
    .map((edge) => {
      const otherId = edge.sourceId === nodeId ? edge.targetId : edge.sourceId;
      const node = nodes.find((n) => n.id === otherId);
      return node ? { node, edge } : null;
    })
    .filter((x): x is { node: GraphNode; edge: GraphEdge } => x !== null);
}

export function getExplorerTree(): ExplorerTree {
  return graphStore.getState().explorerTree;
}

export function getGraphTimeline(): TimelineEvent[] {
  return graphStore.getState().timeline;
}

export function getGraphActivities(): ActivityItem[] {
  return graphStore.getState().activities;
}
