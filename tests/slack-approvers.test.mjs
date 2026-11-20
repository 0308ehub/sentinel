import assert from "node:assert/strict";
import test from "node:test";

import { canApproveFromSlack, slackApprovalDenialMessage } from "../src/lib/slack/approvers-core.ts";

const base = {
  slackUserId: "U-clicker",
  installerUserId: "U-installer",
  slackEmail: null,
  accountId: "org_kismet",
  admins: [],
};

test("the Slack installer can approve", () => {
  assert.equal(canApproveFromSlack({ ...base, slackUserId: "U-installer" }), true);
});

test("a matching admin email can approve case-insensitively", () => {
  assert.equal(canApproveFromSlack({
    ...base,
    slackEmail: "  ADA@Example.com ",
    admins: [{ userId: "user_ada", emails: ["ada@example.COM"] }],
  }), true);
});

test("a non-admin or unmatched email cannot approve", () => {
  assert.equal(canApproveFromSlack({
    ...base,
    slackEmail: "grace@example.com",
    admins: [{ userId: "user_ada", emails: ["ada@example.com"] }],
  }), false);
});

test("missing Slack email asks for reconnect and names the installer", () => {
  const message = slackApprovalDenialMessage(null, "U-installer");
  assert.match(message, /reconnect Slack/i);
  assert.match(message, /<@U-installer>/);
});
