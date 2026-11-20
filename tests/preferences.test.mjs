import assert from "node:assert/strict";
import test from "node:test";

import { formatPreferences } from "../src/lib/autopilot/preferences.ts";

test("formatPreferences expresses likes, dislikes, reasons, and guidance", () => {
  assert.equal(formatPreferences([
    { rating: "good", title: "Shorter signup", reason: null },
    { rating: "not_useful", title: "Add a tooltip", reason: "Too subtle" },
  ]), "liked: Shorter signup\nnot useful: Add a tooltip — Too subtle\nLean toward what the team liked and away from what they marked not useful.");
});

test("formatPreferences still gives guidance without rating history", () => {
  assert.equal(formatPreferences([]), "No preferences yet.\nLean toward what the team liked and away from what they marked not useful.");
});

test("formatPreferences counts how many teammates marked the same idea", () => {
  assert.equal(formatPreferences([
    { rating: "good", title: "Shorter signup", reason: null },
    { rating: "good", title: "Shorter signup", reason: null },
  ]), "liked: Shorter signup (2)\nLean toward what the team liked and away from what they marked not useful.");
});
