import assert from "node:assert/strict";
import test from "node:test";
import { slackOAuthErrorMessage, validOAuthReturnPath } from "../src/lib/slack/oauth-return.ts";

test("Slack OAuth accepts only local absolute paths", () => {
  for (const path of ["/onboarding/evidence", "/onboarding/evidence?from=slack", "/"]) {
    assert.equal(validOAuthReturnPath(path), true);
  }
  for (const path of [null, "", "onboarding/evidence", "//evil.example/path", "/\\evil.example/path", "https://evil.example/path", "/\t/evil.example", "/\n/evil.example", "/ /evil.example", "/x\\y"]) {
    assert.equal(validOAuthReturnPath(path), false);
  }
});

test("Slack OAuth explains a workspace ownership conflict", () => {
  assert.equal(
    slackOAuthErrorMessage("slack_team_taken"),
    "This Slack workspace is already connected to another Kismet account. Until shared team workspaces arrive, one account per Slack workspace.",
  );
});
