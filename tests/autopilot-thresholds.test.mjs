import assert from "node:assert/strict";
import test from "node:test";
import { minPageVisitors, positiveInteger } from "../src/lib/autopilot/thresholds.ts";

test("the page visitor threshold defaults to twenty", () => {
  assert.equal(minPageVisitors({}), 20);
});

test("the page visitor threshold accepts only positive integers", () => {
  assert.equal(minPageVisitors({ AUTOPILOT_MIN_PAGE_VISITORS: "7" }), 7);
  for (const value of ["0", "-1", "2.5", "ten", " 3 ", "9007199254740992"]) {
    assert.equal(positiveInteger(value, 20), 20);
  }
});
