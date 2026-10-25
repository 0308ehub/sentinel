// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { armFor } from "../src/lib/autopilot/assign.ts";

const visitors = Array.from({ length: 20000 }, (_, i) => `visitor-${i}-${(i * 2654435761) % 1e9}`);
const flag = (key, extra = {}) => ({ key, status: "running", treatmentPct: 50, layer: null, slotStart: 0, slotEnd: 100, ...extra });

test("experiments in one layer never share a visitor", () => {
  const a = flag("ap-a", { layer: "page:/features", slotStart: 0, slotEnd: 50 });
  const b = flag("ap-b", { layer: "page:/features", slotStart: 50, slotEnd: 100 });
  let inA = 0, inB = 0;
  for (const v of visitors) {
    const armA = armFor(v, a), armB = armFor(v, b);
    assert.ok(!(armA && armB), `${v} is in both experiments`);
    if (armA) inA++;
    if (armB) inB++;
  }
  assert.equal(inA + inB, visitors.length, "every visitor lands in exactly one slice");
  assert.ok(Math.abs(inA / visitors.length - 0.5) < 0.02, `slice A got ${inA}`);
});

test("overlapping experiments are randomized independently", () => {
  const a = flag("ap-a"), b = flag("ap-b");
  const cells = { "control/control": 0, "control/treatment": 0, "treatment/control": 0, "treatment/treatment": 0 };
  for (const v of visitors) cells[`${armFor(v, a)}/${armFor(v, b)}`]++;
  for (const [cell, n] of Object.entries(cells)) {
    assert.ok(Math.abs(n / visitors.length - 0.25) < 0.02, `${cell} has ${n}, expected about a quarter`);
  }
});

test("treatment arm is independent of the slice within a layer", () => {
  const a = flag("ap-a", { layer: "page:/x", slotStart: 0, slotEnd: 50 });
  let treated = 0, total = 0;
  for (const v of visitors) {
    const arm = armFor(v, a);
    if (!arm) continue;
    total++;
    if (arm === "treatment") treated++;
  }
  assert.ok(Math.abs(treated / total - 0.5) < 0.02, `treatment share ${treated / total}`);
});

test("rolled out means everyone gets the new version; off means nobody is in it", () => {
  for (const v of visitors.slice(0, 500)) {
    assert.equal(armFor(v, flag("ap-r", { status: "rolled_out", layer: "page:/x", slotStart: 0, slotEnd: 10 })), "treatment");
    assert.equal(armFor(v, flag("ap-o", { status: "off" })), null);
  }
});
