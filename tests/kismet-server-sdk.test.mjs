import assert from "node:assert/strict";
import test from "node:test";
import { armFor } from "../src/lib/autopilot/assign.ts";
import { SERVER_SDK_SOURCE } from "../src/lib/sdk/kismet-server.ts";

const sdk = await import(`data:text/javascript;base64,${Buffer.from(SERVER_SDK_SOURCE).toString("base64")}`);

const flags = [
  { key: "plain-10", status: "running", treatmentPct: 10, layer: null, slotStart: 0, slotEnd: 100 },
  { key: "layer-a", status: "running", treatmentPct: 50, layer: "page:/home", slotStart: 0, slotEnd: 35 },
  { key: "layer-b", status: "running", treatmentPct: 25, layer: "page:/home", slotStart: 35, slotEnd: 100 },
  { key: "rolled", status: "rolled_out", treatmentPct: 0, layer: null, slotStart: 0, slotEnd: 100 },
];

test("server SDK assignment exactly matches the application assignment", () => {
  for (let index = 0; index < 2000; index += 1) {
    const visitor = `visitor-${index}-${(index * 2654435761) >>> 0}`;
    for (const flag of flags) assert.equal(sdk.armFor(visitor, flag), armFor(visitor, flag));
  }
});

test("other ids become a stable id the events endpoint accepts", () => {
  const id = sdk.visitorId("user@example.com");
  assert.equal(id, sdk.visitorId("user@example.com"));
  assert.notEqual(id, sdk.visitorId("other@example.com"));
  assert.match(id, /^[A-Za-z0-9-]{8,64}$/);
  assert.equal(sdk.visitorId("0b7c1d2e-aaaa-bbbb-cccc-123456789abc"), "0b7c1d2e-aaaa-bbbb-cccc-123456789abc");
});

test("visitorFrom reuses the browser cookie or issues a new one", () => {
  const kismet = sdk.createKismet({ site: "ks_test" });
  assert.deepEqual(kismet.visitorFrom("a=1; kismet_vid=abcdef12-3456; b=2"), { id: "abcdef12-3456", setCookie: null });
  const fresh = kismet.visitorFrom(null);
  assert.match(fresh.id, /^[A-Za-z0-9-]{8,64}$/);
  assert.match(fresh.setCookie, /^kismet_vid=[^;]+; Path=\/; Max-Age=31536000; SameSite=Lax$/);
});

test("variant records one exposure and track carries the visitor's experiments", async () => {
  const posts = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (String(url).includes("/api/autopilot/flags")) return new Response(JSON.stringify({ flags }), { status: 200 });
    posts.push(JSON.parse(init.body));
    return new Response(null, { status: 204 });
  };
  try {
    const kismet = sdk.createKismet({ site: "ks_test", host: "https://kismet.test" });
    const visitor = "abcdef12-3456-7890";
    const arm = await kismet.variant("plain-10", visitor);
    assert.equal(arm, armFor(visitor, flags[0]));
    await kismet.variant("plain-10", visitor);
    assert.equal(await kismet.variant("missing", visitor), "control");
    await kismet.track("purchase", visitor);
    await kismet.flush();
    const events = posts.flatMap((post) => post.events);
    assert.equal(events.filter((event) => event.name === "exposure").length, 1);
    const purchase = events.find((event) => event.name === "track");
    assert.equal(purchase.element, "purchase");
    assert.equal(purchase.visitor, visitor);
    assert.equal(purchase.arms["plain-10"], arm);
    await assert.rejects(() => kismet.track("bad name!", visitor));
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("without a site key the SDK serves control and sends nothing", async () => {
  const realFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return new Response(null, { status: 204 }); };
  try {
    const kismet = sdk.createKismet({ site: "" });
    assert.equal(await kismet.variant("plain-10", "abcdef12-3456"), "control");
    await kismet.track("purchase", "abcdef12-3456");
    await kismet.flush();
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = realFetch;
  }
});
