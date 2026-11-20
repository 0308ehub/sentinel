import assert from "node:assert/strict";
import test from "node:test";

import { previewSources } from "../src/lib/autopilot/preview-source-core.ts";

const available = {
  ready: true,
  isLive: true,
  hasLiveOrigin: true,
  hasRoutePage: true,
  when: "",
  kind: "test",
  chosen: null,
};

test("own-repo live flagged experiments default to account comparison", () => {
  assert.deepEqual(previewSources(available), {
    accountAvailable: true,
    offerToggle: true,
    shown: "account",
    accountMode: "compare",
  });
});

test("live fixes default to a single account frame", () => {
  const result = previewSources({ ...available, kind: "fix" });
  assert.equal(result.shown, "account");
  assert.equal(result.accountMode, "single");
});

test("a when condition defaults to sample data", () => {
  assert.equal(previewSources({ ...available, when: "when the list is empty" }).shown, "sample");
});

test("account previews are unavailable before an experiment is live", () => {
  const result = previewSources({ ...available, isLive: false });
  assert.equal(result.accountAvailable, false);
  assert.equal(result.offerToggle, false);
  assert.equal(result.shown, "sample");
});

test("without a snapshot, account is shown when available and otherwise nothing is shown", () => {
  assert.equal(previewSources({ ...available, ready: false }).shown, "account");
  assert.equal(previewSources({ ...available, ready: false, isLive: false }).shown, "none");
});

test("an explicit choice is respected only while its source is available", () => {
  assert.equal(previewSources({ ...available, chosen: "sample" }).shown, "sample");
  assert.equal(previewSources({ ...available, chosen: "account" }).shown, "account");
  assert.equal(previewSources({ ...available, chosen: "sample", ready: false }).shown, "account");
  assert.equal(previewSources({ ...available, chosen: "account", isLive: false }).shown, "sample");
});
