"use client";

import { useEffect } from "react";
import { chatSnapshot, replaceChat, subscribeChat, type ChatState } from "@/lib/chat/session";
import { graphStore } from "@/lib/graph/graph-store";

interface RemoteWorkspace {
  configured?: boolean;
  graph?: GraphSnapshot | null;
  graphAt?: string | null;
  chat?: ChatState | null;
  chatAt?: string | null;
}

interface GraphSnapshot {
  nodes: unknown[];
  edges: unknown[];
  timeline: unknown[];
  activities: unknown[];
  explorerTree: unknown;
}

export function CloudSync() {
  useEffect(() => {
    let cancel = false;
    let applying = false;
    let configured = false;
    let graphAt: string | null = null;
    let chatAt: string | null = null;
    let graphTimer: ReturnType<typeof setTimeout> | undefined;
    let chatTimer: ReturnType<typeof setTimeout> | undefined;

    const pull = async () => {
      const response = await fetch("/api/workspace");
      if (!response.ok || cancel) return;
      const data = (await response.json()) as RemoteWorkspace;
      configured = Boolean(data.configured);
      if (!configured || cancel) return;
      applying = true;
      try {
        if (isGraph(data.graph)) {
          graphStore.setState(data.graph as never);
          graphAt = data.graphAt ?? null;
        } else {
          graphAt = await send("graph", null);
        }
        if (isChat(data.chat) && data.chat.threads.length > 0) {
          replaceChat(data.chat);
          chatAt = data.chatAt ?? null;
        } else if (chatSnapshot().threads.length > 0) {
          chatAt = await send("chat", null);
        }
      } finally {
        applying = false;
      }
    };

    const send = async (kind: "graph" | "chat", at: string | null): Promise<string | null> => {
      const body = kind === "graph" ? { kind, at, graph: graphSnapshot() } : { kind, at, chat: chatSnapshot() };
      const response = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (response.status === 409) {
        const latest = (await response.json()) as RemoteWorkspace;
        applying = true;
        try {
          if (kind === "graph" && isGraph(latest.graph)) graphStore.setState(latest.graph as never);
          if (kind === "chat" && isChat(latest.chat)) replaceChat(latest.chat);
        } finally {
          applying = false;
        }
        return kind === "graph" ? latest.graphAt ?? null : latest.chatAt ?? null;
      }
      if (!response.ok) return at;
      const saved = (await response.json()) as { at?: string };
      return saved.at ?? at;
    };

    const push = (kind: "graph" | "chat") => {
      if (!configured || applying) return;
      void send(kind, kind === "graph" ? graphAt : chatAt).then((next) => {
        if (cancel || next == null) return;
        if (kind === "graph") graphAt = next;
        else chatAt = next;
      });
    };

    const start = async () => {
      if (!graphStore.persist.hasHydrated()) {
        await new Promise<void>((resolve) => {
          const unsub = graphStore.persist.onFinishHydration(() => {
            unsub();
            resolve();
          });
        });
      }
      if (cancel) return;
      await pull().catch(() => undefined);
      if (cancel) return;
      const unsubGraph = graphStore.subscribe(() => {
        if (applying) return;
        clearTimeout(graphTimer);
        graphTimer = setTimeout(() => push("graph"), 800);
      });
      const unsubChat = subscribeChat(() => {
        if (applying) return;
        clearTimeout(chatTimer);
        chatTimer = setTimeout(() => push("chat"), 800);
      });
      return () => {
        unsubGraph();
        unsubChat();
      };
    };

    let stopSubs = () => {};
    void start().then((stop) => {
      if (cancel) stop?.();
      else if (stop) stopSubs = stop;
    });

    return () => {
      cancel = true;
      clearTimeout(graphTimer);
      clearTimeout(chatTimer);
      stopSubs();
    };
  }, []);

  return null;
}

function graphSnapshot(): GraphSnapshot {
  const state = graphStore.getState();
  return {
    nodes: state.nodes,
    edges: state.edges,
    timeline: state.timeline,
    activities: state.activities,
    explorerTree: state.explorerTree,
  };
}

function isGraph(value: unknown): value is GraphSnapshot {
  if (!value || typeof value !== "object") return false;
  const graph = value as GraphSnapshot;
  return Array.isArray(graph.nodes) && Array.isArray(graph.edges);
}

function isChat(value: unknown): value is ChatState {
  if (!value || typeof value !== "object") return false;
  return Array.isArray((value as ChatState).threads);
}
