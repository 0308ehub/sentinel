"use client";

import {
  readChatState,
  replaceChatState,
  resetChatState,
  subscribeChatState,
  type ChatState,
} from "@/lib/chat/session";
import { graphStore } from "@/lib/graph/graph-store";

export interface SyncAdapter<T> {
  key: "graph" | "chats";
  read(): T;
  apply(data: unknown): void;
  reset(): void;
  isEmpty(data: T): boolean;
  subscribe(listener: () => void): () => void;
  slim?(data: T): T;
}

type GraphData = Pick<
  ReturnType<typeof graphStore.getState>,
  "nodes" | "edges" | "timeline" | "activities" | "explorerTree"
>;

function graphData(): GraphData {
  const { nodes, edges, timeline, activities, explorerTree } = graphStore.getState();
  return { nodes, edges, timeline, activities, explorerTree };
}

function isGraphData(data: unknown): data is GraphData {
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;
  const value = data as Partial<GraphData>;
  return (
    Array.isArray(value.nodes) &&
    Array.isArray(value.edges) &&
    Array.isArray(value.timeline) &&
    Array.isArray(value.activities) &&
    Boolean(value.explorerTree && Array.isArray(value.explorerTree.products))
  );
}

export const graphSyncAdapter: SyncAdapter<GraphData> = {
  key: "graph",
  read: graphData,
  apply(data) {
    if (isGraphData(data)) graphStore.setState({ ...data });
  },
  reset() {
    graphStore.getState().resetGraph();
  },
  isEmpty(data) {
    return data.edges.length === 0 && data.nodes.every((node) => node.id === "product-workspace");
  },
  subscribe(listener) {
    return graphStore.subscribe(listener);
  },
};

function slimChats(data: ChatState): ChatState {
  return {
    ...data,
    threads: data.threads.map((thread) => ({
      ...thread,
      messages: thread.messages.map((message) => ({
        ...message,
        files: message.files?.map((file) => ({ ...file, text: "" })),
      })),
    })),
  };
}

export const chatSyncAdapter: SyncAdapter<ChatState> = {
  key: "chats",
  read: readChatState,
  apply: replaceChatState,
  reset: resetChatState,
  isEmpty(data) {
    return data.threads.length === 0 && data.folders.length === 0 && data.schedules.length === 0;
  },
  subscribe: subscribeChatState,
  slim: slimChats,
};

export type WorkspaceAdapter = typeof graphSyncAdapter | typeof chatSyncAdapter;
export const workspaceAdapters: WorkspaceAdapter[] = [graphSyncAdapter, chatSyncAdapter];
