import test from "node:test";
import assert from "node:assert/strict";
import { buildAutopilotMap } from "../src/lib/autopilot/map-core.ts";

const signal = (overrides = {}) => ({
  id: "sig-1", title: "Checkout breaks", problem: "", area: " /checkout/?step=1 ", status: "open", kind: "bug",
  kindReason: null, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-02T00:00:00.000Z",
  evidence: [], distinctEvidence: 3, staleEvidence: 0, sources: [], ready: false, snoozedUntil: null, ...overrides,
});
const experiment = (overrides = {}) => ({
  id: "exp-1", signalId: "sig-1", version: 1, kind: "fix", title: "Repair checkout", metric: "", metricSpec: { kind: "event", name: "purchase" },
  page: "/checkout/", status: "rolled_out", readout: null, directional: null, verdict: "fixed", cleanup: { status: "merged" },
  createdAt: "2026-01-03T00:00:00.000Z", ...overrides,
});
const goal = { id: "goal-1", name: "More purchases", spec: { kind: "event", name: "purchase" }, source: "person", createdAt: "2026-01-01T00:00:00.000Z" };

test("builds the complaint-to-goal map and normalizes locations", () => {
  const map = buildAutopilotMap({ signals: [signal()], experiments: [experiment()], goals: [goal] });
  assert.deepEqual(map.counts, { showing: 4, total: 4 });
  assert.equal(map.nodes.find((node) => node.kind === "page")?.label, "/checkout");
  assert.equal(map.nodes.find((node) => node.kind === "problem")?.meta.evidence, 3);
  assert.equal(map.nodes.find((node) => node.kind === "change")?.meta.outcome, "fixed");
  assert.ok(map.edges.some((edge) => edge.source === "change:exp-1" && edge.target === "problem:sig-1"));
  assert.ok(map.edges.some((edge) => edge.target === "goal:goal-1" && edge.label === "measured by"));
});

test("keeps the latest experiment version plus running versions and skips inactive signals", () => {
  const map = buildAutopilotMap({
    signals: [signal(), signal({ id: "sig-dismissed", status: "dismissed" })],
    experiments: [
      experiment({ id: "old", version: 1, status: "running" }),
      experiment({ id: "middle", version: 2, status: "stopped" }),
      experiment({ id: "latest", version: 3, status: "failed" }),
      experiment({ id: "dismissed-change", signalId: "sig-dismissed" }),
    ],
    goals: [],
  });
  assert.deepEqual(map.nodes.filter((node) => node.kind === "change").map((node) => node.id).sort(), ["change:latest", "change:old"]);
  assert.equal(map.nodes.some((node) => node.id.includes("dismissed")), false);
});

test("caps nodes by recency and removes dangling edges", () => {
  const map = buildAutopilotMap({ signals: [signal()], experiments: [experiment()], goals: [goal] }, 2);
  assert.deepEqual(map.counts, { showing: 2, total: 4 });
  assert.ok(map.edges.every((edge) => map.nodes.some((node) => node.id === edge.source) && map.nodes.some((node) => node.id === edge.target)));
});

test("gives every node a kind label of its own", async () => {
  const { mapNodeMark } = await import("../src/lib/autopilot/map-core.ts");
  assert.deepEqual(mapNodeMark({ nodeKind: "page" }), { tone: "page", kind: "Page", detail: "" });
  assert.deepEqual(mapNodeMark({ nodeKind: "area" }), { tone: "area", kind: "Area", detail: "" });
  assert.deepEqual(mapNodeMark({ nodeKind: "goal" }), { tone: "goal", kind: "Goal", detail: "" });
  assert.deepEqual(mapNodeMark({ nodeKind: "problem", metaKind: "bug", evidence: 2 }), { tone: "bug", kind: "Bug", detail: "2 reports" });
  assert.deepEqual(mapNodeMark({ nodeKind: "problem", metaKind: "idea", evidence: 1 }), { tone: "idea", kind: "Idea", detail: "1 report" });
  assert.deepEqual(mapNodeMark({ nodeKind: "problem" }), { tone: "problem", kind: "Problem", detail: "0 reports" });
  assert.deepEqual(mapNodeMark({ nodeKind: "change", metaKind: "fix", status: "rolled_out", outcome: "fixed" }), { tone: "fix", kind: "Fix", detail: "fixed" });
  assert.deepEqual(mapNodeMark({ nodeKind: "change", metaKind: "test", status: "running" }), { tone: "test", kind: "A/B test", detail: "running" });
  assert.deepEqual(mapNodeMark({ nodeKind: "change" }), { tone: "change", kind: "Change", detail: "planned" });
});

test("layout keeps edges left to right and problems beside their page", async () => {
  const { layoutMap, orientEdges } = await import("../src/lib/autopilot/map-core.ts");
  const nodes = [
    { id: "page:/a", kind: "page", label: "/a", meta: {} },
    { id: "page:/b", kind: "page", label: "/b", meta: {} },
    { id: "problem:1", kind: "problem", label: "one", meta: {} },
    { id: "problem:2", kind: "problem", label: "two", meta: {} },
    { id: "problem:3", kind: "problem", label: "three", meta: {} },
    { id: "change:1", kind: "change", label: "fix", meta: {} },
  ];
  const edges = [
    { id: "e1", source: "problem:1", target: "page:/b" },
    { id: "e2", source: "problem:2", target: "page:/b" },
    { id: "e3", source: "problem:3", target: "page:/a" },
    { id: "e4", source: "change:1", target: "problem:3" },
  ];
  for (const edge of orientEdges(nodes, edges)) assert.ok(!edge.source.startsWith("problem") || !edge.target.startsWith("page"));
  const at = layoutMap(nodes, edges);
  // /b has two problems, so it comes first; its problems sit beside it, and the fix sits level with problem 3.
  assert.ok(at.get("page:/b").y < at.get("page:/a").y);
  assert.equal(at.get("change:1").y, at.get("problem:3").y);
  assert.ok(at.get("page:/b").x < at.get("problem:1").x && at.get("problem:1").x < at.get("change:1").x);
});
