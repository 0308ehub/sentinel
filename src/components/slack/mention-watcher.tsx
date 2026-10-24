"use client";

import { useEffect } from "react";
import { saveFeatureDraft } from "@/lib/features/save-draft";
import { graphStore, useGraphHydrated, useGraphStore } from "@/lib/graph/graph-store";
import type { SlackInboxItem } from "@/lib/slack/types";

export function MentionWatcher() {
  const hydrated = useGraphHydrated();
  const productId = useGraphStore((state) => state.explorerTree.products[0]?.id ?? "product-workspace");

  useEffect(() => {
    if (!hydrated) return;
    let stopped = false;
    let busy = false;

    async function tick() {
      if (busy || stopped) return;
      busy = true;
      try {
        const res = await fetch("/api/slack/mentions", { method: "POST" });
        if (!res.ok) return;
        const body = (await res.json()) as { inbox?: SlackInboxItem[] };
        const inbox = body.inbox ?? [];
        const applied: string[] = [];
        for (const item of inbox) {
          if (item.action !== "feature" || !item.title) {
            applied.push(item.id);
            continue;
          }
          const marker = `Mentioned in Slack #${item.channelName} by ${item.askedBy}.`;
          const already = graphStore.getState().nodes.some(
            (node) =>
              node.title === item.title &&
              node.metadata.why === marker &&
              String(node.metadata.jiraKey ?? "") === item.jiraKey,
          );
          if (already) {
            applied.push(item.id);
            continue;
          }
          const featureId = saveFeatureDraft(
            {
              title: item.title,
              description: item.description || item.title,
              problem: "",
              priority: item.priority,
              prd: item.description || item.title,
              goal: item.assigneeName ? `Owned by ${item.assigneeName}.` : "",
              metric: "",
              why: `Mentioned in Slack #${item.channelName} by ${item.askedBy}.`,
            },
            productId,
          );
          if (item.jiraKey && item.jiraUrl) {
            graphStore.getState().noteJira(featureId, {
              key: item.jiraKey,
              url: item.jiraUrl,
              sprint: item.sprint || undefined,
            });
          }
          applied.push(item.id);
        }
        if (applied.length > 0) {
          await fetch("/api/slack/mentions/ack", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: applied }),
          });
        }
      } catch {
        // The next pass retries anything still in the inbox.
      } finally {
        busy = false;
      }
    }

    void tick();
    const timer = window.setInterval(() => void tick(), 20_000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [hydrated, productId]);

  return null;
}
