"use client";

import { useGraphStore, getGraphTimeline, getGraphNode } from "@/lib/graph/graph-store";
import { getPerson } from "@/lib/data/seed";
import { formatDate } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { PersonAvatar } from "@/components/shared/person-avatar";

const EVENT_COLORS: Record<string, string> = {
  idea: "#1d4e89",
  research: "#6a717c",
  decision: "#0571d3",
  documentation: "#8b949e",
  design: "#374151",
  implementation: "#1d4e89",
  launch: "#0571d3",
  feedback: "#d93025",
  experiment: "#c4a15a",
};

export function TimelineView() {
  useGraphStore((s) => s.timeline.length);
  const timeline = getGraphTimeline();
  const sorted = [...timeline].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const grouped = sorted.reduce(
    (acc, event) => {
      const node = getGraphNode(event.nodeId);
      const key = node?.title ?? event.nodeId;
      if (!acc[key]) acc[key] = { nodeId: event.nodeId, events: [] };
      acc[key].events.push(event);
      return acc;
    },
    {} as Record<string, { nodeId: string; events: typeof timeline }>
  );

  return (
    <ScrollArea className="h-full">
      <div className="p-6 max-w-3xl mx-auto">
        <h1 className="text-lg font-semibold mb-1">Timeline</h1>
        <p className="text-sm text-muted-foreground mb-8">
          Automatic timeline built from graph events — no manual curation required
        </p>

        {Object.entries(grouped).map(([title, { nodeId, events }]) => (
          <div key={nodeId} className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-sm font-semibold">{title}</h2>
              <Badge variant="secondary" className="text-[10px]">
                {events.length} events
              </Badge>
            </div>

            <div className="space-y-3">
              {events.map((event) => {
                const color = EVENT_COLORS[event.eventType] ?? "#5f6368";
                const actor = event.actorId ? getPerson(event.actorId) : null;

                return (
                  <div key={event.id}>
                    <div className="rounded-lg border border-border p-4 hover:bg-muted/20 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium">{event.title}</p>
                          {event.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
                          )}
                        </div>
                        <time className="text-[10px] text-muted-foreground shrink-0">
                          {formatDate(event.timestamp)}
                        </time>
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        <Badge
                          variant="outline"
                          className="text-[10px] capitalize"
                          style={{ borderColor: `${color}40`, color }}
                        >
                          {event.eventType}
                        </Badge>
                        {actor && <PersonAvatar personId={actor.id} showName />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
