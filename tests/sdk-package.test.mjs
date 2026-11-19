import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { SERVER_SDK_SOURCE, SERVER_SDK_TYPES } from "../src/lib/sdk/kismet-server.ts";

const read = (file) => readFileSync(new URL(`../packages/sdk/${file}`, import.meta.url), "utf8");

test("the npm package ships the same server SDK Kismet serves (run npm run sdk:build)", () => {
  assert.equal(read("index.mjs"), SERVER_SDK_SOURCE);
  assert.equal(read("index.d.mts"), SERVER_SDK_TYPES);
});

test("the npm package lists every file its exports point to", () => {
  const pkg = JSON.parse(read("package.json"));
  for (const entry of Object.values(pkg.exports)) {
    for (const file of Object.values(entry)) assert.ok(pkg.files.includes(file.replace("./", "")), file);
  }
});

test("the browser entry is safe to import on the server", async () => {
  const browser = await import("../packages/sdk/browser.mjs");
  assert.equal(await browser.loadKismet({ site: "site-key" }), null);
  assert.equal(browser.variant("new_checkout"), "control");
  assert.doesNotThrow(() => browser.track("purchase"));
});
