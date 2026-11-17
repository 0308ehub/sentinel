"use client";

import { readFleetSync, replaceFleet, resetFleet, subscribeFleet } from "@/lib/agents/fleet";
import {
  readChatState,
  replaceChatState,
  resetChatState,
  subscribeChatState,
  type ChatState,
} from "@/lib/chat/session";
import { designDraftIsEmpty, readDesignDraft, replaceDesignDraft, resetDesignDraft, subscribeDesignDraft } from "@/lib/design/draft";
import { graphStore } from "@/lib/graph/graph-store";
import { labIsEmpty, readLabSync, replaceLab, resetLab, subscribeLab } from "@/lib/lab/store";
import { readOnboarding, replaceOnboarding, resetOnboarding, subscribeOnboarding, EMPTY_ONBOARDING } from "@/lib/onboarding";
import { readWorkspace, replaceWorkspace, resetWorkspace, subscribeWorkspace, workspaceIsDefault } from "@/lib/settings/workspace";
import { readWorkContext, replaceWorkContext, resetWorkContext, subscribeWorkContext } from "@/lib/work-context";
import { analyticsIsEmpty, readAnalyticsSync, replaceAnalytics, resetAnalytics, useAnalyticsLibrary } from "@/stores/analytics-store";
import { readNotificationSync, replaceNotifications, resetNotifications, useNotificationStore } from "@/stores/notification-store";
import { readNotebookSync, replaceNotebooks, resetNotebooks, useQueryEditorStore } from "@/stores/query-editor-store";
import { STATE_KEYS, type StateKey } from "@/lib/workspace/keys";

export interface SyncAdapter<T> {
  key: StateKey;
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

function stable(value: unknown): string {
  try {
    return JSON.stringify(value) ?? "null";
  } catch {
    return `unreadable:${Date.now()}`;
  }
}

function subscribeWhenChanged(
  read: () => unknown,
  subscribe: (listener: () => void) => () => void,
  listener: () => void,
): () => void {
  let previous = stable(read());
  return subscribe(() => {
    const next = stable(read());
    if (next === previous) return;
    previous = next;
    listener();
  });
}

function listed<T>(adapter: SyncAdapter<T>): SyncAdapter<unknown> {
  return {
    key: adapter.key,
    read: () => adapter.read(),
    apply: (data) => adapter.apply(data),
    reset: () => adapter.reset(),
    isEmpty: (data) => adapter.isEmpty(data as T),
    subscribe: (listener) => adapter.subscribe(listener),
    slim: adapter.slim ? (data) => adapter.slim?.(data as T) ?? data : undefined,
  };
}

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

const graphSyncAdapter: SyncAdapter<GraphData> = {
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
    return subscribeWhenChanged(graphData, (notify) => graphStore.subscribe(notify), listener);
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

const chatSyncAdapter: SyncAdapter<ChatState> = {
  key: "chats",
  read: readChatState,
  apply: replaceChatState,
  reset: resetChatState,
  isEmpty(data) {
    return data.threads.length === 0 && data.folders.length === 0 && data.schedules.length === 0;
  },
  subscribe(listener) {
    return subscribeWhenChanged(readChatState, subscribeChatState, listener);
  },
  slim: slimChats,
};

const contextSyncAdapter: SyncAdapter<ReturnType<typeof readWorkContext>> = {
  key: "context",
  read: readWorkContext,
  apply: replaceWorkContext,
  reset: resetWorkContext,
  isEmpty: (data) => data.pages.length === 0 && data.memory.length === 0,
  subscribe: (listener) => subscribeWhenChanged(readWorkContext, subscribeWorkContext, listener),
};

const onboardingSyncAdapter: SyncAdapter<ReturnType<typeof readOnboarding>> = {
  key: "onboarding",
  read: readOnboarding,
  apply: replaceOnboarding,
  reset: resetOnboarding,
  isEmpty: (data) => JSON.stringify(data) === JSON.stringify(EMPTY_ONBOARDING),
  subscribe: (listener) => subscribeWhenChanged(readOnboarding, subscribeOnboarding, listener),
};

const settingsSyncAdapter: SyncAdapter<ReturnType<typeof readWorkspace>> = {
  key: "settings",
  read: readWorkspace,
  apply: replaceWorkspace,
  reset: resetWorkspace,
  isEmpty: workspaceIsDefault,
  subscribe: (listener) => subscribeWhenChanged(readWorkspace, subscribeWorkspace, listener),
};

const agentsSyncAdapter: SyncAdapter<ReturnType<typeof readFleetSync>> = {
  key: "agents",
  read: readFleetSync,
  apply: replaceFleet,
  reset: resetFleet,
  isEmpty: (data) => data.agents.length === 0,
  subscribe: (listener) => subscribeWhenChanged(readFleetSync, subscribeFleet, listener),
};

const labSyncAdapter: SyncAdapter<ReturnType<typeof readLabSync>> = {
  key: "lab",
  read: readLabSync,
  apply: replaceLab,
  reset: resetLab,
  isEmpty: labIsEmpty,
  subscribe: (listener) => subscribeWhenChanged(readLabSync, subscribeLab, listener),
};

const designSyncAdapter: SyncAdapter<ReturnType<typeof readDesignDraft>> = {
  key: "design",
  read: readDesignDraft,
  apply: replaceDesignDraft,
  reset: resetDesignDraft,
  isEmpty: designDraftIsEmpty,
  subscribe: (listener) => subscribeWhenChanged(readDesignDraft, subscribeDesignDraft, listener),
};

const notificationsSyncAdapter: SyncAdapter<ReturnType<typeof readNotificationSync>> = {
  key: "notifications",
  read: readNotificationSync,
  apply: replaceNotifications,
  reset: resetNotifications,
  isEmpty: (data) => data.items.length === 0,
  subscribe: (listener) => subscribeWhenChanged(readNotificationSync, (notify) => useNotificationStore.subscribe(notify), listener),
};

const analyticsSyncAdapter: SyncAdapter<ReturnType<typeof readAnalyticsSync>> = {
  key: "analytics",
  read: readAnalyticsSync,
  apply: replaceAnalytics,
  reset: resetAnalytics,
  isEmpty: analyticsIsEmpty,
  subscribe: (listener) => subscribeWhenChanged(readAnalyticsSync, (notify) => useAnalyticsLibrary.subscribe(notify), listener),
};

const notebooksSyncAdapter: SyncAdapter<ReturnType<typeof readNotebookSync>> = {
  key: "notebooks",
  read: readNotebookSync,
  apply: replaceNotebooks,
  reset: resetNotebooks,
  isEmpty: (data) => data.savedNotebooks.length === 0,
  subscribe: (listener) => subscribeWhenChanged(readNotebookSync, (notify) => useQueryEditorStore.subscribe(notify), listener),
};

const adapterByKey: Record<StateKey, SyncAdapter<unknown>> = {
  graph: listed(graphSyncAdapter),
  chats: listed(chatSyncAdapter),
  context: listed(contextSyncAdapter),
  onboarding: listed(onboardingSyncAdapter),
  settings: listed(settingsSyncAdapter),
  agents: listed(agentsSyncAdapter),
  lab: listed(labSyncAdapter),
  design: listed(designSyncAdapter),
  notifications: listed(notificationsSyncAdapter),
  analytics: listed(analyticsSyncAdapter),
  notebooks: listed(notebooksSyncAdapter),
};

export const workspaceAdapters: SyncAdapter<unknown>[] = STATE_KEYS.map((key) => adapterByKey[key]);
