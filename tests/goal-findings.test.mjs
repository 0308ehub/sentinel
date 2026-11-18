import assert from "node:assert/strict";
import test from "node:test";
import { computeGoalFindings, retentionFinding } from "../src/lib/autopilot/goal-finding-math.ts";

const now = "2026-11-17T12:00:00.000Z";
const old = "2026-10-01T00:00:00.000Z";
const recent = "2026-11-10T00:00:00.000Z";

test("new-versus-returning finding obeys minimum size and 1.5x ratio with a stable title", () => {
  const visitors = [
    ...Array.from({ length: 20 }, (_, i) => ({ firstAt: recent, pages: [], converted: i < 2 })),
    ...Array.from({ length: 20 }, (_, i) => ({ firstAt: old, pages: [], converted: i < 4 })),
  ];
  const findings = computeGoalFindings({ goal: "Create project", now, minVisitors: 20, visitors });
  assert.equal(findings[0]?.title, "New visitors rarely reach “Create project”");
  assert.match(findings[0]?.body ?? "", /10\.0%.*20\.0%/);
  assert.equal(computeGoalFindings({ goal: "Create project", now, minVisitors: 21, visitors }).length, 0);
});

test("page association requires two-times lift and ten converters", () => {
  const visitors = [
    ...Array.from({ length: 20 }, (_, i) => ({ firstAt: old, pages: ["/setup"], converted: i < 10 })),
    ...Array.from({ length: 40 }, (_, i) => ({ firstAt: old, pages: [], converted: i < 5 })),
  ];
  const findings = computeGoalFindings({ goal: "Connect", now, minVisitors: 20, visitors });
  assert.ok(findings.some((finding) => finding.title === "Visitors who open /setup reach “Connect” far more often"));
});

test("retention threshold is stable and respects size", () => {
  assert.equal(retentionFinding(20, 5, 20)?.title, "Few new visitors come back");
  assert.equal(retentionFinding(19, 0, 20), null);
  assert.equal(retentionFinding(20, 6, 20), null);
});
