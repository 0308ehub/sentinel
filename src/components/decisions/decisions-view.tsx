"use client";

import { decisions, getPerson, getNode } from "@/lib/data/seed";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { PersonAvatar } from "@/components/shared/person-avatar";
import { formatDate } from "@/lib/utils";
import { Scale, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function DecisionsView() {
  const [selectedId, setSelectedId] = useState(decisions[0]?.id);

  const selected = decisions.find((d) => d.id === selectedId);

  return (
    <div className="flex h-full">
      <div className="w-80 border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <h1 className="text-sm font-semibold flex items-center gap-2">
            <Scale className="h-4 w-4" />
            Decision Explorer
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {decisions.length} decisions tracked
          </p>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {decisions.length === 0 && (
              <p className="px-2 py-6 text-xs text-muted-foreground">No decisions yet.</p>
            )}
            {decisions.map((d) => (
              <button
                key={d.id}
                onClick={() => setSelectedId(d.id)}
                className={cn(
                  "w-full text-left rounded-md border border-border p-3 transition-colors",
                  selectedId === d.id ? "bg-accent border-primary/30" : "hover:bg-muted/50"
                )}
              >
                <p className="text-xs font-medium leading-tight">{d.title}</p>
                <div className="flex items-center gap-2 mt-2">
                  <StatusBadge status={d.status} />
                  <span className="text-[10px] text-muted-foreground">{formatDate(d.createdAt)}</span>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {selected && (
        <ScrollArea className="flex-1">
          <div className="p-6 max-w-2xl space-y-6">
            <div>
              <Badge variant="secondary" className="text-[10px] mb-2">Decision Record</Badge>
              <h2 className="text-lg font-semibold">{selected.title}</h2>
              <p className="text-sm text-muted-foreground mt-1">{formatDate(selected.createdAt)}</p>
            </div>

            <Section title="Question">
              <p className="text-sm">{selected.question}</p>
            </Section>

            <Section title="Decision">
              <div className="rounded-md border border-primary/20 bg-accent/30 p-4">
                <p className="text-sm font-medium">{selected.decision}</p>
              </div>
            </Section>

            <Section title="Rationale">
              <p className="text-sm text-muted-foreground leading-relaxed">{selected.rationale}</p>
            </Section>

            <Section title="Alternatives Considered">
              <ul className="space-y-2">
                {selected.alternatives.map((alt, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <ChevronRight className="h-4 w-4 shrink-0 mt-0.5" />
                    {alt}
                  </li>
                ))}
              </ul>
            </Section>

            <Section title="Approved By">
              <div className="flex gap-3">
                {selected.approverIds.map((id) => (
                  <PersonAvatar key={id} personId={id} showName />
                ))}
              </div>
            </Section>

            <Section title="Supporting Evidence">
              <div className="space-y-2">
                {selected.evidenceNodeIds.map((nodeId) => {
                  const node = getNode(nodeId);
                  if (!node) return null;
                  return (
                    <Link
                      key={nodeId}
                      href={`/graph?node=${nodeId}`}
                      className="flex items-center justify-between rounded-md border border-border p-2.5 text-xs hover:bg-muted transition-colors"
                    >
                      <span>{node.title}</span>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </Link>
                  );
                })}
              </div>
            </Section>

            {selected.outcome && (
              <Section title="Outcome">
                <p className="text-sm text-muted-foreground">{selected.outcome}</p>
              </Section>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
        {title}
      </h3>
      {children}
    </div>
  );
}
