import assert from "node:assert/strict";
import test from "node:test";
import { experimentTask, gateInPatch } from "../src/lib/autopilot/agent-task.ts";

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

test("gateInPatch checks only supplied patches", () => {
  const files = [{ patch: '+ const variant = useVariant("checkout-copy");' }, { patch: "+ unrelated" }];
  assert.equal(gateInPatch(files, 'useVariant("checkout-copy")'), true);
  assert.equal(gateInPatch(files, 'kismet.variant("checkout-copy")'), false);
});
