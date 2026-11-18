import assert from "node:assert/strict";
import test from "node:test";
import { directionalComparison, directionalNote } from "../src/lib/autopilot/directional.ts";

test("directionalComparison reports rates without implying causality", () => {
  assert.deepEqual(directionalComparison({ visitors: 20, conversions: 2 }, { visitors: 40, conversions: 8 }), {
    beforeRate: 0.1, afterRate: 0.2,
  });
  assert.equal(directionalNote({ visitors: 20, conversions: 2 }, { visitors: 40, conversions: 8 }),
    "Kept on. Directional only: 10.0% before → 20.0% after (20 and 40 visitors). Not proven.");
});

test("directionalComparison handles empty windows", () => {
  assert.deepEqual(directionalComparison({ visitors: 0, conversions: 0 }, { visitors: 0, conversions: 0 }), {
    beforeRate: null, afterRate: null,
  });
});
