import assert from "node:assert/strict";
import test from "node:test";
import { formatJourneys } from "../src/lib/autopilot/journeys.ts";

test("formatJourneys anonymizes, orders, labels, and truncates journeys", () => {
  const base = { visitor: "secret-id", firstAt: "2026-01-01T00:00:00Z", windowStart: "2026-01-02T00:00:00Z", visits: 2 };
  const events = [
    { ...base, name: "click", page: "/settings/connectors", element: "Connect", at: "2026-01-16T00:02:00Z" },
    { ...base, name: "view", page: "/settings/connectors", element: "", at: "2026-01-16T00:01:00Z" },
    { ...base, name: "view", page: "/ai", element: "", at: "2026-01-16T00:03:00Z" },
  ];
  assert.deepEqual(formatJourneys(events), [
    'visitor 1 (returning, 2 visits): /settings/connectors → clicked "Connect" → /ai',
  ]);
  assert.equal(formatJourneys([...events, ...Array.from({ length: 30 }, (_, i) => ({ ...base, name: "view", page: `/p${i}`, element: "", at: `2026-01-17T00:${String(i).padStart(2, "0")}:00Z` }))])[0].split(" → ").length, 25);
});
