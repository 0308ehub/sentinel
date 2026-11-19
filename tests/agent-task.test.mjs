import assert from "node:assert/strict";
import test from "node:test";
import { experimentGate, experimentTask, fixTask, gateInPatch } from "../src/lib/autopilot/agent-task.ts";

const experiment = {
  flag: "checkout-copy", title: "Clearer checkout", hypothesis: "More people finish", page: "/checkout",
  control: "Current button", treatment: "Clear button copy", metric: "Checkout completion", guardrail: "No errors",
};

const signal = {
  title: "Checkout confusion", problem: "People do not know what happens next",
  evidence: Array.from({ length: 7 }, (_, index) => ({ title: `Evidence ${index + 1}` })),
};

test("build task includes experiment, branch, internal gate, and at most five evidence titles", () => {
  const task = experimentTask(experiment, signal, false);
  assert.match(task, /checkout-copy/);
  assert.match(task, /kismet\/exp-checkout-copy/);
  assert.match(task, /useVariant\("checkout-copy"\)/);
  assert.match(task, /Evidence 5/);
  assert.doesNotMatch(task, /Evidence 6/);
});

test("external build task uses the window Kismet gate", () => {
  const task = experimentTask(experiment, signal, true);
  assert.match(task, /kismet\.variant\("checkout-copy"\)/);
  assert.doesNotMatch(task, /useVariant\("checkout-copy"\)/);
});

test("quick fix task ships the change without an experiment gate", () => {
  const task = experimentTask({ ...experiment, kind: "fix" }, signal, false);
  assert.match(task, /quick fix/);
  assert.match(task, /data-kismet-fix="checkout-copy"/);
  assert.doesNotMatch(task, /useVariant\("checkout-copy"\)/);
});

test("agent tasks forbid marker-only branches and define the no-change response", () => {
  for (const task of [experimentTask(experiment, signal, false), fixTask({ ...experiment, kind: "fix" }, signal)]) {
    assert.match(task, /NO CHANGE NEEDED: <one sentence why>/);
    assert.match(task, /only change is a data-kismet-fix or data-track attribute/);
  }
});

test("an event metric tells the agent to track it in both versions", () => {
  const spec = { kind: "event", name: "purchase" };
  const external = experimentTask({ ...experiment, metricSpec: spec }, signal, true);
  assert.match(external, /window\.kismet\?\.track\("purchase"\)/);
  assert.match(external, /BOTH control and treatment/);
  const internal = experimentTask({ ...experiment, metricSpec: spec }, signal, false);
  assert.match(internal, /useTrack\(\)/);
  assert.doesNotMatch(experimentTask(experiment, signal, true), /MEASUREMENT/);
});

test("external experiments carry the server SDK; internal ones and fixes do not", () => {
  const external = experimentTask(experiment, signal, true);
  assert.match(external, /SERVER SDK/);
  assert.match(external, /export function createKismet/);
  assert.match(external, /kismet\.variant\("checkout-copy", visitor\.id\)/);
  assert.doesNotMatch(experimentTask(experiment, signal, false), /SERVER SDK/);
  assert.doesNotMatch(experimentTask({ ...experiment, kind: "fix" }, signal, true), /SERVER SDK/);
});

test("the external gate accepts the browser and the server form", () => {
  const gate = experimentGate("checkout-copy", true);
  assert.equal(gateInPatch([{ patch: '+ setVariant(kismet.variant("checkout-copy"));' }], gate), true);
  assert.equal(gateInPatch([{ patch: '+ const variant = await kismet.variant("checkout-copy", visitor.id);' }], gate), true);
  assert.equal(gateInPatch([{ patch: '+ kismet.variant("checkout-copy-v2")' }], gate), false);
});

test("gateInPatch checks only supplied patches", () => {
  const files = [{ patch: '+ const variant = useVariant("checkout-copy");' }, { patch: "+ unrelated" }];
  assert.equal(gateInPatch(files, 'useVariant("checkout-copy")'), true);
  assert.equal(gateInPatch(files, 'kismet.variant("checkout-copy")'), false);
});
