"use client";

import { useMemo, useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  MarkerType,
  Handle,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { buildFlowGraph, getNodeColor, getNodeLabel } from "@/lib/graph";
import { useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getGraphNode, getConnectedGraphNodes, useGraphStore } from "@/lib/graph/graph-store";
import type { NodeType } from "@/types/graph";
import { Filter } from "lucide-react";
import { useState } from "react";
import Link from "next/link";

const FILTER_TYPES: NodeType[] = [
  "FEATURE",
  "CUSTOMER_PROBLEM",
  "DECISION",
  "METRIC",
  "PRD",
  "PULL_REQUEST",
  "LAUNCH",
];

function GraphNodeComponent({ data }: { data: { label: string; type: NodeType; nodeId: string; selected?: boolean } }) {
  const color = getNodeColor(data.type);
  return (
    <div
      className="rounded-md border bg-white px-3 py-2 shadow-sm min-w-[140px] max-w-[200px]"
      style={{
        borderColor: data.selected ? color : "#dadce0",
        boxShadow: data.selected ? `0 0 0 2px ${color}40` : undefined,
      }}
    >
      <Handle type="target" position={Position.Top} className="!bg-border !w-2 !h-2" />
      <div className="text-[10px] font-medium uppercase tracking-wide mb-0.5" style={{ color }}>
        {getNodeLabel(data.type)}
      </div>
      <div className="text-xs font-medium leading-tight">{data.label}</div>
      <Handle type="source" position={Position.Bottom} className="!bg-border !w-2 !h-2" />
    </div>
  );
}

const nodeTypes = { graphNode: GraphNodeComponent };

function layoutNodes(
  graphNodes: ReturnType<typeof buildFlowGraph>["nodes"],
  centerId?: string
): Node[] {
  const layers: Record<number, typeof graphNodes> = {};
  const visited = new Set<string>();
  const nodeLayer = new Map<string, number>();

  if (centerId) {
    const queue: { id: string; layer: number }[] = [{ id: centerId, layer: 0 }];
    while (queue.length > 0) {
      const { id, layer } = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      nodeLayer.set(id, layer);
      if (!layers[layer]) layers[layer] = [];
      const node = graphNodes.find((n) => n.id === id);
      if (node) layers[layer].push(node);
    }
  }

  graphNodes.forEach((n, i) => {
    if (!visited.has(n.id)) {
      const layer = Math.floor(i / 4) + (centerId ? 3 : 0);
      if (!layers[layer]) layers[layer] = [];
      layers[layer].push(n);
      nodeLayer.set(n.id, layer);
    }
  });

  const result: Node[] = [];
  Object.entries(layers).forEach(([layerStr, layerNodes]) => {
    const layer = Number(layerStr);
    const totalWidth = layerNodes.length * 220;
    layerNodes.forEach((node, i) => {
      result.push({
        id: node.id,
        type: "graphNode",
        position: {
          x: i * 220 - totalWidth / 2 + 400,
          y: layer * 120 + 50,
        },
        data: {
          label: node.title,
          type: node.type,
          nodeId: node.id,
          selected: node.id === centerId,
        },
      });
    });
  });

  return result;
}

export function GraphView() {
  const searchParams = useSearchParams();
  const graphStateNodes = useGraphStore((s) => s.nodes);
  const centerNodeId =
    searchParams.get("node") ??
    graphStateNodes.find((n) => n.type === "PRODUCT")?.id ??
    graphStateNodes[0]?.id ??
    "";
  const graphVersion = useGraphStore((s) => s.nodes.length);
  const [filterTypes, setFilterTypes] = useState<NodeType[]>([]);

  const { nodes: graphNodes, edges: graphEdges } = useMemo(
    () =>
      buildFlowGraph(
        centerNodeId,
        filterTypes.length > 0 ? filterTypes : undefined
      ),
    [centerNodeId, filterTypes, graphVersion]
  );

  const initialNodes = useMemo(
    () => layoutNodes(graphNodes, centerNodeId),
    [graphNodes, centerNodeId]
  );

  const initialEdges: Edge[] = useMemo(
    () =>
      graphEdges.map((e) => ({
        id: e.id,
        source: e.sourceId,
        target: e.targetId,
        label: e.type.replace(/_/g, " ").toLowerCase(),
        labelStyle: { fontSize: 9, fill: "#5f6368" },
        style: { stroke: "#dadce0", strokeWidth: 1.5 },
        markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12, color: "#dadce0" },
        animated: e.sourceId === centerNodeId || e.targetId === centerNodeId,
      })),
    [graphEdges, centerNodeId]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const selectedNode = getGraphNode(centerNodeId);
  const connected = selectedNode ? getConnectedGraphNodes(centerNodeId) : [];

  const toggleFilter = (type: NodeType) => {
    setFilterTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  return (
    <div className="flex h-full">
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.3}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={20} size={1} color="#e8eaed" />
          <Controls showInteractive={false} />
          <MiniMap
            nodeColor={(n) => getNodeColor((n.data as { type: NodeType }).type)}
            maskColor="rgba(0,0,0,0.05)"
            className="!border !border-border !rounded-md"
          />
        </ReactFlow>

        <div className="absolute top-3 left-3 flex gap-1 flex-wrap max-w-md">
          <Filter className="h-4 w-4 text-muted-foreground mt-1" />
          {FILTER_TYPES.map((type) => (
            <Button
              key={type}
              variant={filterTypes.includes(type) ? "default" : "outline"}
              size="sm"
              className="h-6 text-[10px] px-2"
              onClick={() => toggleFilter(type)}
            >
              {getNodeLabel(type)}
            </Button>
          ))}
        </div>
      </div>

      {selectedNode && (
        <div className="w-80 border-l border-border bg-background flex flex-col">
          <div className="p-4 border-b border-border">
            <Badge variant="secondary" className="text-[10px] mb-2">
              {getNodeLabel(selectedNode.type)}
            </Badge>
            <h2 className="text-sm font-semibold">{selectedNode.title}</h2>
            <p className="text-xs text-muted-foreground mt-1">{selectedNode.description}</p>
            {selectedNode.type === "FEATURE" && (
              <Link href={`/features/${selectedNode.id}`}>
                <Button size="sm" className="mt-3 w-full">Open Workspace</Button>
              </Link>
            )}
          </div>
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              <Section title="Upstream Dependencies">
                {connected
                  .filter((c) => c.edge.targetId === centerNodeId)
                  .map((c) => (
                    <NodeLink key={c.node.id} id={c.node.id} title={c.node.title} type={c.node.type} />
                  ))}
              </Section>
              <Section title="Downstream Impact">
                {connected
                  .filter((c) => c.edge.sourceId === centerNodeId)
                  .map((c) => (
                    <NodeLink key={c.node.id} id={c.node.id} title={c.node.title} type={c.node.type} />
                  ))}
              </Section>
            </div>
          </ScrollArea>
        </div>
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
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function NodeLink({ id, title, type }: { id: string; title: string; type: NodeType }) {
  return (
    <Link
      href={`/graph?node=${id}`}
      className="flex items-center justify-between rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-muted transition-colors"
    >
      <span className="truncate">{title}</span>
      <span className="text-[10px] text-muted-foreground shrink-0 ml-2">{getNodeLabel(type)}</span>
    </Link>
  );
}
