"use client";

import { useSyncExternalStore } from "react";
import { useAgents } from "@/lib/agents/fleet";
import { useChatState } from "@/lib/chat/session";
import { useGraphHydrated, useGraphStore } from "@/lib/graph/graph-store";
import { buildUsage, type UsageReport } from "@/lib/settings/usage";

export function useWorkspaceUsage(): UsageReport | null {
  const hydrated = useGraphHydrated();
  const nodes = useGraphStore((state) => state.nodes);
  const chat = useChatState();
  const agents = useAgents();
  const ready = useSyncExternalStore(() => () => {}, () => true, () => false);

  if (!ready || !hydrated) return null;

  return buildUsage({
    nodes: nodes.map((node) => ({ type: node.type, createdAt: node.createdAt, updatedAt: node.updatedAt })),
    threads: chat.threads.map((thread) => ({
      createdAt: thread.createdAt,
      messages: thread.messages.map((message) => ({ at: message.at, role: message.role })),
    })),
    agents: agents.map((agent) => ({
      messages: agent.messages.map((message) => ({ at: message.at, role: message.role })),
    })),
  });
}
