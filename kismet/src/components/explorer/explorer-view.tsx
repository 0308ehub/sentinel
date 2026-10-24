"use client";

import { useState } from "react";
import { useGraphStore, getGraphNode, getConnectedGraphNodes } from "@/lib/graph/graph-store";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { NodeTypeBadge } from "@/components/shared/node-type-badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { searchGraph } from "@/lib/graph";
import { ChevronRight, ChevronDown, Search, Package, Layers, AlertCircle, FlaskConical } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function ExplorerView() {
  const nodes = useGraphStore((s) => s.nodes);
  const explorerTree = useGraphStore((s) => s.explorerTree);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    "product-workspace": true,
    features: true,
    problems: true,
  });

  const searchResults = query ? searchGraph(query, 50) : [];

  const toggle = (key: string) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="flex h-full">
      <div className="w-72 border-r border-border flex flex-col">
        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Filter explorer..."
              className="pl-8 h-8 text-xs"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
        <ScrollArea className="flex-1">
          {query ? (
            <div className="p-2 space-y-0.5">
              {searchResults.map((r) => (
                <ExplorerItem key={r.id} nodeId={r.id} />
              ))}
            </div>
          ) : (
            <div className="p-2">
              {explorerTree.products.map((product) => (
                <div key={product.id}>
                  <button
                    onClick={() => toggle(product.id)}
                    className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium hover:bg-muted"
                  >
                    {expanded[product.id] ? (
                      <ChevronDown className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" />
                    )}
                    <Package className="h-3.5 w-3.5 text-primary" />
                    {product.name}
                  </button>
                  {expanded[product.id] && (
                    <div className="ml-3 border-l border-border pl-2">
                      <TreeSection
                        label="Features"
                        icon={Layers}
                        ids={product.features}
                        expanded={expanded.features}
                        onToggle={() => toggle("features")}
                      />
                      <TreeSection
                        label="Problems"
                        icon={AlertCircle}
                        ids={product.problems}
                        expanded={expanded.problems}
                        onToggle={() => toggle("problems")}
                      />
                      <TreeSection
                        label="Experiments"
                        icon={FlaskConical}
                        ids={product.experiments}
                        expanded={expanded.experiments ?? false}
                        onToggle={() => toggle("experiments")}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-6">
            <h1 className="text-lg font-semibold mb-1">Explorer</h1>
            <p className="text-sm text-muted-foreground mb-6">
              {nodes.length} nodes across the product graph
            </p>
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left font-medium px-4 py-2.5">Name</th>
                    <th className="text-left font-medium px-4 py-2.5">Type</th>
                    <th className="text-left font-medium px-4 py-2.5">Status</th>
                    <th className="text-left font-medium px-4 py-2.5">Tags</th>
                  </tr>
                </thead>
                <tbody>
                  {(query ? searchResults.map((r) => getGraphNode(r.id)).filter(Boolean) : nodes)
                    .slice(0, 50)
                    .map((node) =>
                      node ? (
                        <tr key={node.id} className="border-b border-border hover:bg-muted/30">
                          <td className="px-4 py-2.5">
                            <Link
                              href={
                                node.type === "FEATURE"
                                  ? `/features/${node.id}`
                                  : `/graph?node=${node.id}`
                              }
                              className="font-medium hover:text-primary"
                            >
                              {node.title}
                            </Link>
                          </td>
                          <td className="px-4 py-2.5">
                            <NodeTypeBadge type={node.type} />
                          </td>
                          <td className="px-4 py-2.5">
                            <StatusBadge status={node.status} />
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex gap-1 flex-wrap">
                              {node.tags.slice(0, 3).map((t) => (
                                <span key={t} className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                  {t}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ) : null
                    )}
                </tbody>
              </table>
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

function TreeSection({
  label,
  icon: Icon,
  ids,
  expanded,
  onToggle,
}: {
  label: string;
  icon: React.ElementType;
  ids: string[];
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-xs hover:bg-muted"
      >
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <Icon className="h-3 w-3 text-muted-foreground" />
        {label}
        <span className="ml-auto text-[10px] text-muted-foreground">{ids.length}</span>
      </button>
      {expanded && (
        <div className="ml-4">
          {ids.map((id) => (
            <ExplorerItem key={id} nodeId={id} />
          ))}
        </div>
      )}
    </div>
  );
}

function ExplorerItem({ nodeId }: { nodeId: string }) {
  const node = getGraphNode(nodeId);
  if (!node) return null;

  const href =
    node.type === "FEATURE" ? `/features/${node.id}` : `/graph?node=${node.id}`;

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1 text-xs hover:bg-muted transition-colors",
        node.status === "AT_RISK" && "text-destructive"
      )}
    >
      <span className="truncate">{node.title}</span>
    </Link>
  );
}
