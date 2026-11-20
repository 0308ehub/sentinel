import assert from "node:assert/strict";
import test from "node:test";
import { repositoryOwner, slackOwner } from "../src/lib/connections/ownership-core.ts";

test("earliest Slack connection owns the team", () => {
  assert.equal(slackOwner([
    { userId: "later", createdAt: "2026-01-02T00:00:00Z" },
    { userId: "first", createdAt: "2026-01-01T00:00:00Z" },
  ]), "first");
});

test("Slack connection ties go to the smaller user id", () => {
  assert.equal(slackOwner([
    { userId: "user-b", createdAt: "2026-01-01T00:00:00Z" },
    { userId: "user-a", createdAt: "2026-01-01T00:00:00Z" },
  ]), "user-a");
});

test("repository matching is case-insensitive and uses created, updated, then user id", () => {
  assert.equal(repositoryOwner({
    repo: "Acme/App",
    deploymentUserId: null,
    deploymentRepo: null,
    candidates: [
      { userId: "user-c", repo: "other/repo", createdAt: "2025-01-01", updatedAt: "2025-01-01" },
      { userId: "user-b", repo: "acme/app", createdAt: "2026-01-01", updatedAt: "2026-01-02" },
      { userId: "user-a", repo: "ACME/APP", createdAt: "2026-01-01", updatedAt: "2026-01-02" },
    ],
  }), "user-a");
});

test("repository creation ties use the oldest update before user id", () => {
  assert.equal(repositoryOwner({
    repo: "acme/app",
    deploymentUserId: null,
    deploymentRepo: null,
    candidates: [
      { userId: "user-a", repo: "acme/app", createdAt: "2026-01-01", updatedAt: "2026-01-03" },
      { userId: "user-z", repo: "acme/app", createdAt: "2026-01-01", updatedAt: "2026-01-02" },
    ],
  }), "user-z");
});

test("deployment owner wins the repository it ships to", () => {
  assert.equal(repositoryOwner({
    repo: "acme/app",
    deploymentUserId: "deployment-owner",
    deploymentRepo: "ACME/APP",
    candidates: [
      { userId: "older", repo: "acme/app", createdAt: "2020-01-01", updatedAt: "2020-01-01" },
    ],
  }), "deployment-owner");
});

test("the deployment owner keeps its Slack workspace even if it reconnected later", async () => {
  const { slackOwner } = await import("../src/lib/connections/ownership-core.ts");
  const candidates = [
    { userId: "mathan", createdAt: "2026-11-18T00:00:00.000Z" },
    { userId: "owner", createdAt: "2026-11-19T21:12:00.000Z" },
  ];
  assert.equal(slackOwner(candidates, "owner"), "owner");
  assert.equal(slackOwner(candidates, null), "mathan");
  assert.equal(slackOwner(candidates, "someone-else"), "mathan");
});
