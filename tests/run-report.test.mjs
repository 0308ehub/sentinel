import assert from "node:assert/strict";
import test from "node:test";

import { buildRunReport } from "../src/lib/autopilot/run-report-core.ts";

const before = {
  signals: [{ id: "old", title: "Old", status: "open", kind: "bug" }],
  experiments: [
    { id: "moving", title: "Checkout copy", status: "building" },
    { id: "running", title: "Navigation test", status: "running" },
  ],
  evidenceBySource: { slack: 2 },
};

test("buildRunReport describes evidence, new suggestions, and moved experiments", () => {
  const report = buildRunReport(before, {
    signals: [
      ...before.signals,
      { id: "idea", title: "People miss experiment results", status: "open", kind: "idea" },
      { id: "dismissed", title: "Hidden", status: "dismissed", kind: null },
    ],
    experiments: [
      { id: "moving", title: "Checkout copy", status: "awaiting_approval" },
      before.experiments[1],
      { id: "new", title: "New test", status: "building" },
    ],
    evidenceBySource: { slack: 5, analytics: 1, kismet: 1 },
  }, ["Suggested 1 product idea.", "Kismet has reached today's limit."], [], new Set(["idea"]));

  assert.equal(report.headline, "1 new suggestion, 2 changes moved");
  assert.deepEqual(report.looked, ["3 new Slack messages", "1 new analytics finding", "Checked 1 running experiment"]);
  assert.deepEqual(report.suggested, [{ id: "idea", title: "People miss experiment results", byKismet: true }]);
  assert.deepEqual(report.moved, [
    { id: "moving", title: "Checkout copy", from: "Building", to: "Ready for review" },
    { id: "new", title: "New test", from: "New", to: "Building" },
  ]);
  assert.deepEqual(report.notes, ["Kismet has reached today's limit."]);
});

test("buildRunReport returns an uneventful headline and preserves errors", () => {
  const report = buildRunReport(before, before, ["Updated 1 running experiment(s)."], ["ideas: unavailable"]);
  assert.equal(report.headline, "Nothing new since the last check");
  assert.deepEqual(report.suggested, []);
  assert.deepEqual(report.errors, ["ideas: unavailable"]);
});
