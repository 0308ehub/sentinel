import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { test } from "node:test";
import assert from "node:assert/strict";
import { armFor } from "../src/lib/autopilot/assign.ts";

const source = await readFile(new URL("../public/kismet.js", import.meta.url), "utf8");
const context = { __KISMET_TEST__: true };
runInNewContext(source, context);
const sdkArmFor = context.__kismetArmFor;
const sdkParsePreview = context.__kismetParsePreview;

const flags = [
  { key: "plain-10", status: "running", treatmentPct: 10, layer: null, slotStart: 0, slotEnd: 100 },
  { key: "plain-73", status: "running", treatmentPct: 73, layer: null, slotStart: 0, slotEnd: 100 },
  { key: "layer-a", status: "running", treatmentPct: 50, layer: "page:/home", slotStart: 0, slotEnd: 35 },
  { key: "layer-b", status: "running", treatmentPct: 25, layer: "page:/home", slotStart: 35, slotEnd: 100 },
  { key: "rolled", status: "rolled_out", treatmentPct: 0, layer: "page:/x", slotStart: 10, slotEnd: 20 },
  { key: "disabled", status: "off", treatmentPct: 100, layer: null, slotStart: 0, slotEnd: 100 },
];

test("browser SDK assignment exactly matches the application assignment", () => {
  assert.equal(typeof sdkArmFor, "function");
  for (let index = 0; index < 2000; index += 1) {
    const visitor = `visitor-${index}-${(index * 2654435761) >>> 0}`;
    for (const flag of flags) assert.equal(sdkArmFor(visitor, flag), armFor(visitor, flag));
  }
});

test("browser SDK parses preview overrides", () => {
  assert.deepEqual(
    JSON.parse(JSON.stringify(sdkParsePreview("one:control,two:treatment,bad:other"))),
    { one: "control", two: "treatment" },
  );
});
