import type { MetricSpec } from "@/lib/autopilot/assign";
import type { Experiment, Goal, Signal } from "@/lib/autopilot/types";

export type AutopilotMapNodeKind = "page" | "area" | "problem" | "change" | "goal";
export type AutopilotMapOutcome = "won" | "lost" | "flat" | "fixed" | "not fixed" | "no change";

export interface AutopilotMapNode {
  id: string;
  kind: AutopilotMapNodeKind;
  label: string;
  createdAt: string;
  meta: {
    kind?: "bug" | "idea" | "fix" | "test" | "change";
    evidence?: number;
    status?: string;
    outcome?: AutopilotMapOutcome;
    experimentId?: string;
  };
}

export interface AutopilotMapEdge {
  id: string;
  source: string;
  target: string;
  label?: "measured by";
}

export interface AutopilotMap {
  nodes: AutopilotMapNode[];
  edges: AutopilotMapEdge[];
  counts: { showing: number; total: number };
}

const ACTIVE_SIGNAL_STATUSES = new Set(["open", "experimenting", "resolved"]);
const ALWAYS_INCLUDE_EXPERIMENT_STATUSES = new Set(["running", "rolled_out"]);

function normalizedLocation(value: string): { kind: "page" | "area"; key: string; label: string } | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!trimmed.startsWith("/")) {
    const label = trimmed.replace(/\s+/g, " ");
    return { kind: "area", key: label.toLocaleLowerCase(), label };
  }
  const withoutQuery = trimmed.split(/[?#]/, 1)[0].replace(/\/{2,}/g, "/");
  const path = withoutQuery.length > 1 ? withoutQuery.replace(/\/+$/, "") : "/";
  return { kind: "page", key: path, label: path };
}

function locationId(location: { kind: "page" | "area"; key: string }): string {
  return `${location.kind}:${encodeURIComponent(location.key)}`;
}

function metricJson(spec: MetricSpec | null): string | null {
  if (!spec) return null;
  if (spec.kind === "click") return JSON.stringify({ kind: spec.kind, text: spec.text });
  if (spec.kind === "visit") return JSON.stringify({ kind: spec.kind, path: spec.path });
  return JSON.stringify({ kind: spec.kind, name: spec.name });
}

function outcomeFor(experiment: Experiment): AutopilotMapOutcome | undefined {
  if (experiment.verdict === "fixed") return "fixed";
  if (experiment.verdict === "not_fixed") return "not fixed";
  if (experiment.status === "rejected" && experiment.rejectedBy === "kismet") return "no change";
  const verdict = experiment.readout?.verdict;
  if (verdict === "won" || verdict === "lost" || verdict === "flat") return verdict;
  return undefined;
}

function latestRelevantExperiments(experiments: readonly Experiment[]): Experiment[] {
  const latest = new Map<string, Experiment>();
  for (const experiment of experiments) {
    const current = latest.get(experiment.signalId);
    if (!current || experiment.version > current.version ||
      (experiment.version === current.version && Date.parse(experiment.createdAt) > Date.parse(current.createdAt))) {
      latest.set(experiment.signalId, experiment);
    }
  }
  return experiments.filter((experiment) => latest.get(experiment.signalId)?.id === experiment.id || ALWAYS_INCLUDE_EXPERIMENT_STATUSES.has(experiment.status));
}

/** Build the account map without reading external state. */
export function buildAutopilotMap(
  input: { signals: readonly Signal[]; experiments: readonly Experiment[]; goals: readonly Goal[] },
  limit = 150,
): AutopilotMap {
  const signals = input.signals.filter((signal) => ACTIVE_SIGNAL_STATUSES.has(signal.status));
  const signalIds = new Set(signals.map((signal) => signal.id));
  const experiments = latestRelevantExperiments(input.experiments).filter((experiment) => signalIds.has(experiment.signalId));
  const experimentBySignal = new Map<string, Experiment>();
  for (const experiment of experiments) {
    const current = experimentBySignal.get(experiment.signalId);
    if (!current || experiment.version > current.version) experimentBySignal.set(experiment.signalId, experiment);
  }

  const locations = new Map<string, AutopilotMapNode>();
  const touchLocation = (raw: string, at: string) => {
    const location = normalizedLocation(raw);
    if (!location) return null;
    const id = locationId(location);
    const current = locations.get(id);
    if (!current || Date.parse(at) > Date.parse(current.createdAt)) {
      locations.set(id, { id, kind: location.kind, label: location.label, createdAt: at, meta: {} });
    }
    return id;
  };

  for (const signal of signals) touchLocation(signal.area, signal.updatedAt);
  for (const experiment of experiments) if (experiment.page.trim().startsWith("/")) touchLocation(experiment.page, experiment.createdAt);

  const problemNodes: AutopilotMapNode[] = signals.map((signal) => ({
    id: `problem:${signal.id}`,
    kind: "problem",
    label: signal.title,
    createdAt: signal.updatedAt,
    meta: {
      kind: signal.kind ?? undefined,
      evidence: signal.distinctEvidence,
      status: signal.status,
      experimentId: experimentBySignal.get(signal.id)?.id,
    },
  }));
  const changeNodes: AutopilotMapNode[] = experiments.map((experiment) => ({
    id: `change:${experiment.id}`,
    kind: "change",
    label: experiment.title,
    createdAt: experiment.createdAt,
    meta: { kind: experiment.kind, status: experiment.cleanup?.status ?? experiment.status, outcome: outcomeFor(experiment), experimentId: experiment.id },
  }));
  const goalNodes: AutopilotMapNode[] = input.goals.map((goal) => ({
    id: `goal:${goal.id}`,
    kind: "goal",
    label: goal.name,
    createdAt: goal.createdAt,
    meta: {},
  }));
  const allNodes = [...locations.values(), ...problemNodes, ...changeNodes, ...goalNodes];
  const safeLimit = Math.max(0, Math.floor(limit));
  const nodes = allNodes
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.id.localeCompare(b.id))
    .slice(0, safeLimit);
  const kept = new Set(nodes.map((node) => node.id));

  const edges: AutopilotMapEdge[] = [];
  for (const signal of signals) {
    const location = normalizedLocation(signal.area);
    if (location) edges.push({ id: `reported:${signal.id}:${locationId(location)}`, source: `problem:${signal.id}`, target: locationId(location) });
  }
  for (const experiment of experiments) {
    edges.push({ id: `addresses:${experiment.id}:${experiment.signalId}`, source: `change:${experiment.id}`, target: `problem:${experiment.signalId}` });
    const experimentMetric = metricJson(experiment.metricSpec);
    for (const goal of input.goals) {
      if (experimentMetric && experimentMetric === metricJson(goal.spec)) {
        edges.push({ id: `measures:${experiment.id}:${goal.id}`, source: `change:${experiment.id}`, target: `goal:${goal.id}`, label: "measured by" });
      }
    }
  }

  return {
    nodes,
    edges: edges.filter((edge) => kept.has(edge.source) && kept.has(edge.target)),
    counts: { showing: nodes.length, total: allNodes.length },
  };
}

export type MapNodeTone = "page" | "area" | "bug" | "idea" | "problem" | "fix" | "test" | "change" | "goal";

/** The word and color family for a node, separate from its title. */
export function mapNodeMark(input: {
  nodeKind: AutopilotMapNodeKind;
  metaKind?: AutopilotMapNode["meta"]["kind"];
  evidence?: number;
  status?: string;
  outcome?: string;
}): { tone: MapNodeTone; kind: string; detail: string } {
  if (input.nodeKind === "page") return { tone: "page", kind: "Page", detail: "" };
  if (input.nodeKind === "area") return { tone: "area", kind: "Area", detail: "" };
  if (input.nodeKind === "goal") return { tone: "goal", kind: "Goal", detail: "" };
  if (input.nodeKind === "problem") {
    const tone: MapNodeTone = input.metaKind === "bug" ? "bug" : input.metaKind === "idea" ? "idea" : "problem";
    const count = input.evidence ?? 0;
    return {
      tone,
      kind: tone === "bug" ? "Bug" : tone === "idea" ? "Idea" : "Problem",
      detail: `${count} ${count === 1 ? "report" : "reports"}`,
    };
  }
  const tone: MapNodeTone = input.metaKind === "test" ? "test" : input.metaKind === "fix" ? "fix" : "change";
  return {
    tone,
    kind: tone === "test" ? "A/B test" : tone === "fix" ? "Fix" : "Change",
    detail: (input.outcome ?? input.status ?? "planned").replaceAll("_", " "),
  };
}

const COLUMN: Record<AutopilotMapNodeKind, number> = { page: 0, area: 0, problem: 1, change: 2, goal: 3 };
export const MAP_COLUMN_WIDTH = 290;
export const MAP_ROW_HEIGHT = 74;

/** Every edge drawn left to right: where it was reported → problem → what was tried → goal. */
export function orientEdges(nodes: AutopilotMapNode[], edges: AutopilotMapEdge[]): AutopilotMapEdge[] {
  const kind = new Map(nodes.map((node) => [node.id, node.kind]));
  return edges.map((edge) => {
    const from = kind.get(edge.source);
    const to = kind.get(edge.target);
    if (from && to && COLUMN[from] > COLUMN[to]) return { ...edge, source: edge.target, target: edge.source };
    return edge;
  });
}

/** Places related nodes on the same rows so lines run mostly straight across. */
export function layoutMap(nodes: AutopilotMapNode[], edges: AutopilotMapEdge[]): Map<string, { x: number; y: number }> {
  const oriented = orientEdges(nodes, edges);
  const neighbours = (id: string, direction: "in" | "out") => oriented
    .filter((edge) => (direction === "in" ? edge.target === id : edge.source === id))
    .map((edge) => (direction === "in" ? edge.source : edge.target));
  const byKind = (kinds: AutopilotMapNodeKind[]) => nodes.filter((node) => kinds.includes(node.kind));
  const rows = new Map<string, number>();

  // Locations with the most problems first; each location's problems directly beside it.
  const locations = byKind(["page", "area"])
    .map((node) => ({ node, problems: neighbours(node.id, "out") }))
    .sort((a, b) => b.problems.length - a.problems.length || a.node.label.localeCompare(b.node.label));
  let problemRow = 0;
  const placedProblems = new Set<string>();
  for (const { node, problems } of locations) {
    const start = problemRow;
    for (const id of problems) {
      if (placedProblems.has(id)) continue;
      placedProblems.add(id);
      rows.set(id, problemRow++);
    }
    rows.set(node.id, problems.length ? (start + Math.max(start, problemRow - 1)) / 2 : problemRow++);
  }
  for (const node of byKind(["problem"])) if (!rows.has(node.id)) rows.set(node.id, problemRow++);

  // Changes and goals sit level with what they connect to, nudged apart when they would overlap.
  const settle = (kinds: AutopilotMapNodeKind[]) => {
    const wanted = byKind(kinds).map((node) => {
      const linked = neighbours(node.id, "in").map((id) => rows.get(id)).filter((row): row is number => row != null);
      return { id: node.id, row: linked.length ? linked.reduce((sum, row) => sum + row, 0) / linked.length : Number.POSITIVE_INFINITY };
    }).sort((a, b) => a.row - b.row);
    let next = 0;
    for (const item of wanted) {
      const row = Number.isFinite(item.row) ? Math.max(item.row, next) : next;
      rows.set(item.id, row);
      next = row + 1;
    }
  };
  settle(["change"]);
  settle(["goal"]);

  const positions = new Map<string, { x: number; y: number }>();
  for (const node of nodes) {
    positions.set(node.id, { x: COLUMN[node.kind] * MAP_COLUMN_WIDTH + 40, y: (rows.get(node.id) ?? 0) * MAP_ROW_HEIGHT + 90 });
  }
  return positions;
}
