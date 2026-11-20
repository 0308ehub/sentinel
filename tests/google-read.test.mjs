import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CALENDAR_READONLY,
  GOOGLE_SCOPES,
  docEvidence,
  eventEvidence,
  googleRedirectUri,
  grantsScope,
  mailEvidence,
} from "../src/lib/google/read-core.ts";

test("a localhost redirect setting is not sent from the live app", () => {
  assert.equal(
    googleRedirectUri("https://app.sentinelai.one", "http://localhost:3000/api/google/callback"),
    "https://app.sentinelai.one/api/google/callback",
  );
  assert.equal(
    googleRedirectUri("http://localhost:3000", "http://localhost:3000/api/google/callback"),
    "http://localhost:3000/api/google/callback",
  );
});

test("the Google connection can read Docs, Calendar, and Gmail", () => {
  assert.ok(GOOGLE_SCOPES.includes(CALENDAR_READONLY));
  assert.ok(GOOGLE_SCOPES.includes("https://www.googleapis.com/auth/gmail.readonly"));
  assert.ok(GOOGLE_SCOPES.includes("https://www.googleapis.com/auth/documents.readonly"));
  assert.equal(grantsScope(GOOGLE_SCOPES.join(" "), CALENDAR_READONLY), true);
  assert.equal(grantsScope(undefined, CALENDAR_READONLY), false);
});

test("an inbox message becomes evidence pointing at that message", () => {
  const item = mailEvidence({
    id: "abc123",
    from: "Ada <ada@company.com>",
    subject: "The export button is still hard to find",
    date: "Tue, 18 Nov 2026 15:04:00 +0000",
    snippet: "Three people asked where it went after the last release.",
  });
  assert.equal(item.source, "google");
  assert.equal(item.title, "The export button is still hard to find");
  assert.match(item.body, /Ada <ada@company.com>/);
  assert.equal(item.url, "https://mail.google.com/mail/u/0/#all/abc123");
  assert.equal(item.occurredAt, "2026-11-18T15:04:00.000Z");
});

test("a message with nothing to read is skipped", () => {
  assert.equal(mailEvidence({ id: "x", from: "Ada", subject: "(no subject)", date: "", snippet: "ok" }), null);
  assert.equal(mailEvidence({ id: "", from: "Ada", subject: "A real subject line here", date: "", snippet: "" }), null);
});

test("a doc keeps its link and an excerpt", () => {
  const item = docEvidence({
    id: "doc-1",
    name: "Onboarding notes",
    modified: "2026-11-17T12:00:00.000Z",
    link: "https://docs.google.com/document/d/doc-1/edit",
    excerpt: "New people cannot tell which step creates the workspace.",
  });
  assert.equal(item.title, "Onboarding notes");
  assert.match(item.body, /cannot tell which step/);
  assert.equal(item.url, "https://docs.google.com/document/d/doc-1/edit");
});

test("a doc without a link still opens in Google Docs", () => {
  const item = docEvidence({ id: "doc-2", name: "Spec", modified: "not-a-date" });
  assert.equal(item.url, "https://docs.google.com/document/d/doc-2/edit");
  assert.equal(item.occurredAt, "1970-01-01T00:00:00.000Z");
});

test("a calendar event is kept and a cancelled one is not", () => {
  const item = eventEvidence({
    id: "evt-1",
    title: "Review the signup drop",
    start: "2026-11-20T18:00:00.000Z",
    end: "2026-11-20T18:30:00.000Z",
    allDay: false,
    location: "Meet",
    description: "Look at the step after email verification.",
    organizer: "Ada",
    link: "https://calendar.google.com/event?eid=evt-1",
  });
  assert.equal(item.title, "Review the signup drop");
  assert.match(item.body, /Meet/);
  assert.equal(item.author, "Ada");
  assert.equal(item.url, "https://calendar.google.com/event?eid=evt-1");
  assert.equal(eventEvidence({
    id: "evt-2",
    title: "Cancelled standup",
    start: "2026-11-20",
    end: "2026-11-21",
    allDay: true,
    status: "cancelled",
  }), null);
});

test("an all-day event says it is all day", () => {
  const item = eventEvidence({
    id: "evt-3",
    title: "Offsite",
    start: "2026-12-02",
    end: "2026-12-03",
    allDay: true,
  });
  assert.match(item.body, /All day 2026-12-02/);
  assert.equal(item.author, "Google Calendar");
});
