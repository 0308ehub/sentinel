import assert from "node:assert/strict";
import test from "node:test";
import { splitSetupContext } from "../src/lib/autopilot/context.ts";

test("setup context splits paragraphs and list items", () => {
  const text = `We help support teams find recurring customer problems.

- Customers ask for clearer billing history.
- People cannot find exports.
  They often contact support instead.
1. Short
2. Mobile users want faster search.`;
  assert.deepEqual(splitSetupContext(text), [
    "We help support teams find recurring customer problems.",
    "Customers ask for clearer billing history.",
    "People cannot find exports. They often contact support instead.",
    "Mobile users want faster search.",
  ]);
});

test("setup context keeps no more than twenty useful items", () => {
  const text = Array.from({ length: 25 }, (_, index) => `- Customer complaint number ${index + 1}`).join("\n");
  assert.equal(splitSetupContext(text).length, 20);
});
