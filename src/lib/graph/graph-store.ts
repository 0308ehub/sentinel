import { useSyncExternalStore } from "react";
import { createStore } from "zustand/vanilla";
import { persist } from "zustand/middleware";
import { useStore } from "zustand";
import type {
  ActivityItem,
  GraphEdge,
  GraphNode,
  NodeStatus,
  NodeType,
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
import { figmaEmbed, isEvidenceType, livingFromShare, type LivingDoc, type PrdShare } from "@/lib/prd/document";

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
  saveLivingPrd: (prdId: string, doc: LivingDoc) => void;
  ensureFeaturePrd: (featureId: string) => string | null;
  importSharedPrd: (share: PrdShare, productId: string) => string | null;
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

      ensureFeaturePrd: (featureId) => {
        const state = get();
        const feature = state.nodes.find((node) => node.id === featureId && node.type === "FEATURE");
        if (!feature) return null;
        const linked = state.edges
          .filter((edge) => edge.sourceId === featureId || edge.targetId === featureId)
          .map((edge) => (edge.sourceId === featureId ? edge.targetId : edge.sourceId));
        const existing = state.nodes.find((node) => linked.includes(node.id) && node.type === "PRD");
        if (existing) return existing.id;
        const id = `prd-${featureId}`;
        const now = new Date().toISOString();
        set((current) => ({
          nodes: [
            ...current.nodes,
            {
              id,
              type: "PRD" as const,
              title: `${feature.title} PRD`,
              description: "",
              status: "DRAFT" as const,
              ownerId: feature.ownerId,
              productId: feature.productId,
              metadata: { version: "0.1" },
              tags: ["prd"],
              createdAt: now,
              updatedAt: now,
            },
          ],
          edges: [
            ...current.edges,
            { id: `edge-${featureId}-${id}`, sourceId: featureId, targetId: id, type: "IMPLEMENTS" as const, createdAt: now },
          ],
        }));
        return id;
      },

      saveLivingPrd: (prdId, doc) => {
        const now = new Date().toISOString();
        set((state) => {
          const prd = state.nodes.find((node) => node.id === prdId && node.type === "PRD");
          if (!prd) return state;
          const featureId = state.edges
            .filter((edge) => edge.sourceId === prdId || edge.targetId === prdId)
            .map((edge) => (edge.sourceId === prdId ? edge.targetId : edge.sourceId))
            .find((id) => state.nodes.find((node) => node.id === id)?.type === "FEATURE");
          const figmaId = `figma-for-${prdId}`;
          const embed = figmaEmbed(doc.figmaUrl);
          let nodes = state.nodes
            .filter((node) => node.id !== figmaId)
            .map((node) =>
              node.id === prdId
                ? {
                    ...node,
                    description: doc.overview || doc.introduction || node.description,
                    summary: (doc.introduction || doc.overview || node.summary || "").slice(0, 120),
                    metadata: { ...node.metadata, living: doc },
                    updatedAt: now,
                  }
                : node
            );
          let edges = state.edges.filter((edge) => edge.sourceId !== figmaId && edge.targetId !== figmaId);
          if (embed) {
            nodes = [
              ...nodes,
              {
                id: figmaId,
                type: "FIGMA_FRAME",
                title: "Design",
                description: doc.figmaUrl.trim(),
                status: "ACTIVE",
                ownerId: prd.ownerId,
                productId: prd.productId,
                metadata: { url: doc.figmaUrl.trim() },
                tags: ["figma"],
                createdAt: now,
                updatedAt: now,
              },
            ];
            edges = [
              ...edges,
              { id: `edge-${prdId}-${figmaId}`, sourceId: prdId, targetId: figmaId, type: "LINKED_TO", createdAt: now },
            ];
          }
          const timeline = [
            ...state.timeline.filter((event) => !event.id.startsWith(`prd-ms-${prdId}-`)),
            ...doc.milestones
              .filter((milestone) => milestone.label.trim())
              .map((milestone) => ({
                id: `prd-ms-${prdId}-${milestone.id}`,
                nodeId: featureId ?? prdId,
                title: milestone.label.trim(),
                description: milestone.date,
                eventType: "design",
                timestamp: milestoneTime(milestone.date, now),
                actorId: prd.ownerId,
              })),
          ];
          return { nodes, edges, timeline };
        });
      },

      importSharedPrd: (share, productId) => {
        const result = get().proposeFeature({
          title: share.title,
          description: share.introduction,
          prdText: share.overview,
          ownerId: "person-you",
          priority: "MEDIUM",
          primaryRepo: "",
          primaryRepoUrl: "",
          additionalRepos: [],
          scaffold: { customerProblem: false, prd: true, goal: false, metric: false },
          productId,
          source: share.introduction,
        });
        const prd = get().nodes.find((node) => node.type === "PRD" && result.createdNodeIds.includes(node.id));
        if (!prd) return result.featureId;
        get().saveLivingPrd(prd.id, livingFromShare(share));
        const now = new Date().toISOString();
        set((state) => {
          const extraNodes: GraphNode[] = [];
          const extraEdges: GraphEdge[] = [];
          for (const item of share.evidence) {
            if (!isEvidenceType(item.type)) continue;
            const id = `shared-${item.type.toLowerCase()}-${slugify(item.title).slice(0, 24)}-${extraNodes.length}`;
            extraNodes.push({
              id,
              type: item.type as NodeType,
              title: item.title,
              description: item.detail,
              status: "ACTIVE",
              ownerId: "person-you",
              productId,
              metadata: {},
              tags: ["shared"],
              createdAt: now,
              updatedAt: now,
            });
            extraEdges.push({
              id: `edge-${result.featureId}-${id}`,
              sourceId: item.type === "CUSTOMER_PROBLEM" ? id : result.featureId,
              targetId: item.type === "CUSTOMER_PROBLEM" ? result.featureId : id,
              type: item.type === "CUSTOMER_PROBLEM" ? "ADDRESSES" : "RELATED_TO",
              createdAt: now,
            });
          }
          return { nodes: [...state.nodes, ...extraNodes], edges: [...state.edges, ...extraEdges] };
        });
        return result.featureId;
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

function milestoneTime(date: string, fallback: string): string {
  if (!date) return fallback;
  const parsed = new Date(`${date}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
}

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
