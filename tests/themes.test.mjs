import assert from "node:assert/strict";
import test from "node:test";

import { buildThemes } from "../src/lib/autopilot/themes.ts";

const now = new Date("2026-11-18T12:00:00.000Z");

function evidence(id, source, author, daysAgo, body = `Quote ${id}`) {
  return { id, source, synthetic: false, title: `Title ${id}`, body, author, url: null, occurredAt: new Date(now.getTime() - daysAgo * 86400000).toISOString(), signalId: "sig" };
}

function signal(id, items, status = "open") {
  return { id, title: `Theme ${id}`, problem: `Problem ${id}`, area: "/", status, createdAt: now.toISOString(), updatedAt: now.toISOString(), evidence: items, distinctEvidence: items.length, staleEvidence: 0, sources: [...new Set(items.map((item) => item.source))], ready: true, snoozedUntil: null };
}

test("buildThemes counts qualitative evidence, people, windows, numbers, and rising trends", () => {
  const items = [
    evidence("1", "slack", "Ada", 1),
    evidence("2", "ticket", "Ben", 2),
    evidence("3", "interview", "Ada", 3),
    evidence("4", "analytics", "Kismet analytics", 1),
  ];
  const [theme] = buildThemes([signal("sig", items)], now);
  assert.equal(theme.mentions, 3);
  assert.equal(theme.people, 2);
  assert.equal(theme.last7, 3);
  assert.equal(theme.prev7, 0);
  assert.equal(theme.trend, "rising");
  assert.equal(theme.hasNumbers, true);
  assert.deepEqual(new Set(theme.sources), new Set(["slack", "ticket", "interview"]));
  assert.equal(theme.quotes.length, 3);
});

test("buildThemes detects falling and steady themes and excludes analytics-only or resolved signals", () => {
  const falling = signal("fall", [evidence("1", "slack", "Ada", 1), evidence("2", "slack", "Ben", 8), evidence("3", "ticket", "Cam", 9), evidence("4", "ticket", "Dee", 10)]);
  const steady = signal("steady", [evidence("5", "slack", "Ada", 1), evidence("6", "ticket", "Ben", 9)]);
  const themes = buildThemes([falling, steady, signal("numbers", [evidence("7", "analytics", "Kismet analytics", 1)]), signal("done", [evidence("8", "slack", "Ada", 1)], "resolved")], now);
  assert.deepEqual(themes.map((theme) => theme.trend), ["falling", "steady"]);
});

test("quotes use body before title, trim to 200 characters, and prefer distinct people", () => {
  const items = [evidence("new", "slack", "Ada", 1, ""), evidence("same", "slack", "Ada", 2), evidence("other", "ticket", "Ben", 3, "x".repeat(240))];
  const [theme] = buildThemes([signal("sig", items)], now);
  assert.equal(theme.quotes[0].text, "Title new");
  assert.equal(theme.quotes[1].author, "Ben");
  assert.equal(theme.quotes[1].text.length, 200);
});

test("buildThemes quotes the Slack message, not the channel, and skips repeated text", () => {
  const at = new Date("2026-11-18T12:00:00Z").toISOString();
  const evidence = [
    { id: "a", source: "slack", synthetic: false, title: "connecting Linear wasted my afternoon", body: "#pm-team", author: "Priya", url: null, occurredAt: at, signalId: "s" },
    { id: "b", source: "ticket", synthetic: false, title: "t", body: "Same words here", author: "Alex", url: null, occurredAt: at, signalId: "s" },
    { id: "c", source: "ticket", synthetic: false, title: "t", body: "Same words here", author: "Jordan", url: null, occurredAt: at, signalId: "s" },
  ];
  const [theme] = buildThemes([{ id: "s", title: "T", problem: "P", area: "", status: "open", createdAt: at, updatedAt: at, evidence, distinctEvidence: 2, staleEvidence: 0, sources: ["slack", "ticket"], ready: false }], new Date(at));
  const texts = theme.quotes.map((quote) => quote.text);
  assert.ok(texts.includes("connecting Linear wasted my afternoon"));
  assert.equal(texts.filter((text) => text === "Same words here").length, 1);
});
