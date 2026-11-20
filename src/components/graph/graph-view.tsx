"use client";

import { useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getGraphNode, getConnectedGraphNodes, useGraphStore } from "@/lib/graph/graph-store";
import type { NodeType } from "@/types/graph";
import { Filter, Loader2 } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { useAgents, type FleetAgent } from "@/lib/agents/fleet";
import { layoutMap, MAP_COLUMN_WIDTH, orientEdges, type AutopilotMap, type AutopilotMapNode } from "@/lib/autopilot/map-core";

type MapNodeData = Omit<AutopilotMapNode["meta"], "kind"> & {
  label: string;
  nodeKind: AutopilotMapNode["kind"];
  metaKind?: AutopilotMapNode["meta"]["kind"];
};

function mapNodeSubtitle(data: MapNodeData): string {
  if (data.nodeKind === "page") return "Page";
  if (data.nodeKind === "area") return "Area";
  if (data.nodeKind === "goal") return "Goal";
  if (data.nodeKind === "problem") {
    const kind = data.metaKind;
    const count = data.evidence ?? 0;
    return `${kind === "bug" ? "Bug" : kind === "idea" ? "Idea" : "Problem"} · ${count} ${count === 1 ? "report" : "reports"}`;
  }
  const kind = data.metaKind === "test" ? "A/B test" : data.metaKind === "fix" ? "Fix" : "Change";
  return `${kind} · ${data.outcome ?? data.status ?? "planned"}`.replaceAll("_", " ");
}

function MapNodeComponent({ data }: { data: MapNodeData }) {
  const positive = data.outcome === "won" || data.outcome === "fixed" || data.status === "merged" || data.status === "rolled_out";
  const negative = data.outcome === "lost" || data.outcome === "not fixed" || data.status === "failed";
  return (
    <div className="min-w-[164px] max-w-[210px] rounded-lg border border-border bg-background px-3 py-2 shadow-sm">
      <Handle type="target" position={Position.Left} className="!h-1.5 !w-1.5 !border-0 !bg-border" />
      <div className="truncate text-xs font-medium text-foreground">{data.label}</div>
      <div className={`mt-0.5 text-[10px] capitalize ${positive ? "text-emerald-700" : negative ? "text-red-700/70" : "text-muted-foreground"}`}>
        {mapNodeSubtitle(data)}
      </div>
      <Handle type="source" position={Position.Right} className="!h-1.5 !w-1.5 !border-0 !bg-border" />
    </div>
  );
}

function MapHeaderComponent({ data }: { data: { label: string } }) {
  return <p className="w-[240px] text-[11px] font-medium uppercase tracking-wide text-[#9aa0a8]">{data.label}</p>;
}

const mapNodeTypes = { mapNode: MapNodeComponent, mapHeader: MapHeaderComponent };

const FILTER_TYPES: NodeType[] = [
  "FEATURE",
  "CUSTOMER_PROBLEM",
  "DECISION",
  "METRIC",
  "PRD",
  "PULL_REQUEST",
  "LAUNCH",
];

function GraphNodeComponent({
  data,
}: {
  data: { label: string; type: NodeType; nodeId: string; selected?: boolean; agents?: { id: string; name: string; color: string }[] };
}) {
  const color = getNodeColor(data.type);
  const here = data.agents ?? [];
  return (
    <div
      className="rounded-md border bg-white px-3 py-2 shadow-sm min-w-[140px] max-w-[200px]"
      style={{
        borderColor: here[0]?.color ?? (data.selected ? color : "#dadce0"),
        boxShadow: here[0] ? `0 0 0 2px ${here[0].color}55` : data.selected ? `0 0 0 2px ${color}40` : undefined,
      }}
    >
      <Handle type="target" position={Position.Top} className="!bg-border !w-2 !h-2" />
      <div className="text-[10px] font-medium uppercase tracking-wide mb-0.5" style={{ color }}>
        {getNodeLabel(data.type)}
      </div>
      <div className="text-xs font-medium leading-tight">{data.label}</div>
      {here.map((agent) => (
        <div key={agent.id} className="mt-1 flex items-center gap-1 text-[10px] text-[#3c4250]">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: agent.color }} />
          <span className="truncate">{agent.name}</span>
        </div>
      ))}
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

function hopColor(source: string, target: string, agents: FleetAgent[]): string | null {
  for (const agent of agents) {
    if (agent.status !== "working" && agent.status !== "thinking") continue;
    const path = agent.path;
    if (path.length < 2) continue;
    const from = path[path.length - 2];
    const to = path[path.length - 1];
    if ((from === source && to === target) || (from === target && to === source)) return agent.color;
  }
  return null;
}

function MapGraphView() {
  const router = useRouter();
  const query = useQuery({
    queryKey: ["autopilot", "map"],
    queryFn: async ({ signal }) => {
      const response = await fetch("/api/autopilot/map", { cache: "no-store", signal });
      const body = (await response.json().catch(() => ({}))) as AutopilotMap & { error?: string };
      if (!response.ok) throw new Error(body.error || "Kismet could not load the map.");
      return body;
    },
    staleTime: 60_000,
  });
  const initialNodes: Node[] = useMemo(() => {
    // A page nothing points to adds noise, not information.
    const linked = new Set((query.data?.edges ?? []).flatMap((edge) => [edge.source, edge.target]));
    const mapNodes = (query.data?.nodes ?? []).filter((node) => (node.kind !== "page" && node.kind !== "area") || linked.has(node.id));
    const positions = layoutMap(mapNodes, query.data?.edges ?? []);
    const headers: Node[] = mapNodes.length
      ? ["Where it was reported", "Problem", "What Kismet tried", "Goal"].map((label, column) => ({
          id: `header:${column}`,
          type: "mapHeader",
          position: { x: column * MAP_COLUMN_WIDTH + 40, y: 40 },
          data: { label },
          draggable: false,
          selectable: false,
        }))
      : [];
    return [...headers, ...mapNodes.map((node) => ({
      id: node.id,
      type: "mapNode",
      position: positions.get(node.id) ?? { x: 0, y: 0 },
      data: {
        label: node.label,
        nodeKind: node.kind,
        metaKind: node.meta.kind,
        evidence: node.meta.evidence,
        status: node.meta.status,
        outcome: node.meta.outcome,
        experimentId: node.meta.experimentId,
      },
    }))];
  }, [query.data?.nodes, query.data?.edges]);
  const initialEdges: Edge[] = useMemo(() => orientEdges(query.data?.nodes ?? [], query.data?.edges ?? []).map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    labelStyle: { fontSize: 9, fill: "#6b7280" },
    style: { stroke: "var(--graph-line)", strokeWidth: 1.25 },
    markerEnd: { type: MarkerType.ArrowClosed, width: 11, height: 11, color: "var(--graph-line)" },
  })), [query.data?.nodes, query.data?.edges]);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const openNode = (_event: React.MouseEvent, node: Node) => {
    const data = node.data as MapNodeData;
    if (data.nodeKind === "goal") router.push("/analytics");
    if (data.nodeKind === "problem") router.push(data.experimentId ? `/experiments?experiment=${data.experimentId}` : "/experiments");
    if (data.nodeKind === "change" && data.experimentId) router.push(`/experiments?experiment=${data.experimentId}`);
  };

  return (
    <div className="relative h-full min-h-0 bg-background">
      <div className="pointer-events-none absolute left-4 top-3 z-10 rounded-md bg-background/90 px-2 py-1 text-xs text-muted-foreground backdrop-blur-sm">
        Where problems come from, what Kismet tried, and what it moved.
        {query.data && query.data.counts.total > query.data.counts.showing ? ` Showing ${query.data.counts.showing} of ${query.data.counts.total}.` : ""}
      </div>
      {query.isLoading ? (
        <div className="grid h-full place-items-center" role="status" aria-label="Loading">
          <Loader2 className="h-5 w-5 animate-spin text-[#9aa0a8]" />
        </div>
      ) : query.isError ? (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{query.error.message}</div>
      ) : nodes.length === 0 ? (
        <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
          Kismet’s map will appear as complaints become problems and changes.
        </div>
      ) : (
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={openNode}
          nodeTypes={mapNodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.25}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={20} size={1} color="var(--graph-dot)" />
          <Controls showInteractive={false} />
        </ReactFlow>
      )}
      <Link href="/graph?view=workspace" className="absolute bottom-3 left-3 z-10 rounded bg-background/90 px-2 py-1 text-[11px] text-muted-foreground underline-offset-4 hover:underline">
        Workspace notes graph
      </Link>
    </div>
  );
}

function WorkspaceGraphView() {
  const searchParams = useSearchParams();
  const agents = useAgents();
  const graphStateNodes = useGraphStore((s) => s.nodes);
  const centerNodeId =
    searchParams.get("node") ??
    graphStateNodes.find((n) => n.type === "PRODUCT")?.id ??
    graphStateNodes[0]?.id ??
    "";
  const graphVersion = graphStateNodes.length;
  const [filterTypes, setFilterTypes] = useState<NodeType[]>([]);

  const { nodes: graphNodes, edges: graphEdges } = useMemo(
    () => {
      void graphVersion;
      return (
      buildFlowGraph(
        centerNodeId,
        filterTypes.length > 0 ? filterTypes : undefined
      ));
    },
    [centerNodeId, filterTypes, graphVersion]
  );

  const initialNodes = useMemo(
    () =>
      layoutNodes(graphNodes, centerNodeId).map((node) => ({
        ...node,
        data: {
          ...node.data,
          agents: agents
            .filter((agent) => agent.focusNodeId === node.id && (agent.status === "working" || agent.status === "thinking"))
            .map((agent) => ({ id: agent.id, name: agent.name, color: agent.color })),
        },
      })),
    [graphNodes, centerNodeId, agents]
  );

  const initialEdges: Edge[] = useMemo(
    () =>
      graphEdges.map((e) => {
        const hop = hopColor(e.sourceId, e.targetId, agents);
        const stroke = hop ?? "var(--graph-line)";
        return {
          id: e.id,
          source: e.sourceId,
          target: e.targetId,
          label: e.type.replace(/_/g, " ").toLowerCase(),
          labelStyle: { fontSize: 9, fill: "#5f6368" },
          style: { stroke, strokeWidth: hop ? 2.5 : 1.5 },
          markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12, color: stroke },
          animated: Boolean(hop) || e.sourceId === centerNodeId || e.targetId === centerNodeId,
        };
      }),
    [graphEdges, centerNodeId, agents]
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
          <Background gap={20} size={1} color="var(--graph-dot)" />
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
            {agents
              .filter((agent) => agent.focusNodeId === selectedNode.id)
              .map((agent) => (
                <div key={agent.id} className="mt-2 flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-xs">
                  <span className="h-2 w-2 rounded-full" style={{ background: agent.color }} />
                  <span className="min-w-0 truncate">{agent.name} · {agent.activity}</span>
                </div>
              ))}
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

export function GraphView() {
  const searchParams = useSearchParams();
  return searchParams.get("view") === "workspace" ? (
    <div className="relative h-full min-h-0">
      <WorkspaceGraphView />
      <Link href="/graph" className="absolute bottom-3 left-3 z-20 rounded bg-background/90 px-2 py-1 text-[11px] text-muted-foreground underline-offset-4 hover:underline">
        Back to Kismet map
      </Link>
    </div>
  ) : <MapGraphView />;
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
