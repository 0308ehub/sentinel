/**
 * The Kismet server SDK, as the exact files a site adds to its repository. Kismet serves them at
 * /sdk/kismet-server.mjs and /sdk/kismet-server.d.mts, and hands them to the coding agent when an
 * experiment runs in server code. The source is plain JavaScript with no dependencies and must keep
 * assigning visitors exactly like public/kismet.js and src/lib/autopilot/assign.ts.
 */
export const SERVER_SDK_FILE = "kismet-server.mjs";
export const SERVER_SDK_TYPES_FILE = "kismet-server.d.mts";

export const SERVER_SDK_SOURCE = String.raw`// Kismet server SDK. Puts each visitor in the same experiment version as the browser script does.
// Set KISMET_SITE_KEY to the data-site value of your Kismet script tag.
const DEFAULT_HOST = "https://app.sentinelai.one";
const COOKIE = "kismet_vid";
const VISITOR = /^[A-Za-z0-9-]{8,64}$/;
const EVENT = /^[A-Za-z0-9_.:-]{1,80}$/;
const FLAGS_TTL_MS = 30000;
const FLUSH_MS = 2000;
const BATCH = 50;

function env(name) {
  return typeof process !== "undefined" && process.env ? process.env[name] : undefined;
}

function hash(input, seed) {
  let h = seed === undefined ? 0x811c9dc5 : seed;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function armFor(visitor, flag) {
  if (flag.status === "rolled_out") return "treatment";
  if (flag.status !== "running") return null;
  if (flag.layer) {
    const slot = hash("layer:" + flag.layer + ":" + visitor) % 100;
    if (slot < flag.slotStart || slot >= flag.slotEnd) return null;
  }
  return hash(flag.key + ":" + visitor) % 100 < flag.treatmentPct ? "treatment" : "control";
}

// The browser's visitor id is used as is. Any other id (a user id, an email) becomes a stable id
// Kismet accepts, so the same person always gets the same version.
export function visitorId(id) {
  const value = String(id);
  if (VISITOR.test(value)) return value;
  return "u-" + hash(value).toString(16).padStart(8, "0") + hash(value, 0x01000193).toString(16).padStart(8, "0");
}

function newId() {
  if (globalThis.crypto && globalThis.crypto.randomUUID) return globalThis.crypto.randomUUID();
  return "v-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 14);
}

export function createKismet(options) {
  const site = (options && options.site) || env("KISMET_SITE_KEY") || "";
  const host = ((options && options.host) || env("KISMET_HOST") || DEFAULT_HOST).replace(/\/$/, "");
  let flags = [];
  let fetchedAt = 0;
  let loading = null;
  let timer = null;
  const queue = [];
  const exposed = new Set();

  async function load() {
    if (!site) return [];
    if (Date.now() - fetchedAt < FLAGS_TTL_MS) return flags;
    if (!loading) {
      loading = fetch(host + "/api/autopilot/flags?site=" + encodeURIComponent(site), { cache: "no-store" })
        .then((response) => (response.ok ? response.json() : { flags: [] }))
        .then((body) => { flags = Array.isArray(body.flags) ? body.flags : []; })
        .catch(() => {})
        .finally(() => { fetchedAt = Date.now(); loading = null; });
    }
    await loading;
    return flags;
  }

  function armsOf(id, list) {
    const arms = {};
    for (const flag of list) {
      const arm = armFor(id, flag);
      if (arm) arms[flag.key] = arm;
    }
    return arms;
  }

  function push(event) {
    queue.push(event);
    if (queue.length >= BATCH) { void flush(); return; }
    if (timer) return;
    timer = setTimeout(() => { timer = null; void flush(); }, FLUSH_MS);
    if (timer && typeof timer.unref === "function") timer.unref();
  }

  async function flush() {
    while (queue.length) {
      const events = queue.splice(0, BATCH);
      await fetch(host + "/api/autopilot/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site, visitor: events[0].visitor, events }),
        keepalive: true,
      }).catch(() => {});
    }
  }

  return {
    // "treatment" or "control". Visitors outside the experiment get "control".
    async variant(flag, visitor) {
      const id = visitorId(visitor);
      const list = await load();
      const found = list.find((item) => item.key === flag);
      const arm = found ? armFor(id, found) : null;
      if (!arm) return "control";
      const seen = flag + ":" + id;
      if (!exposed.has(seen)) {
        if (exposed.size > 50000) exposed.clear();
        exposed.add(seen);
        push({ visitor: id, name: "exposure", page: "", element: flag, arms: armsOf(id, list) });
      }
      return arm;
    },
    // Reports a business event, such as "purchase" or "signup", for this visitor.
    async track(name, visitor) {
      if (!EVENT.test(name)) throw new Error("Kismet event names use letters, numbers, and _ . : - (up to 80).");
      if (!site) return;
      const id = visitorId(visitor);
      push({ visitor: id, name: "track", page: "", element: name, arms: armsOf(id, await load()) });
    },
    // Reads the browser's visitor id from a Cookie header. When there is none, returns a new id and
    // the Set-Cookie value to send, so the browser script uses the same id.
    visitorFrom(cookieHeader) {
      const match = String(cookieHeader || "").match(/(?:^|;\s*)kismet_vid=([^;]+)/);
      const found = match ? decodeURIComponent(match[1]) : "";
      if (VISITOR.test(found)) return { id: found, setCookie: null };
      const id = newId();
      return { id, setCookie: COOKIE + "=" + id + "; Path=/; Max-Age=31536000; SameSite=Lax" };
    },
    // Sends queued events now. Call it before a serverless function returns.
    flush,
  };
}

export const kismet = createKismet();
`;

export const SERVER_SDK_TYPES = `export type Arm = "control" | "treatment";

export interface Kismet {
  variant(flag: string, visitor: string): Promise<Arm>;
  track(name: string, visitor: string): Promise<void>;
  visitorFrom(cookieHeader: string | null | undefined): { id: string; setCookie: string | null };
  flush(): Promise<void>;
}

export function createKismet(options?: { site?: string; host?: string }): Kismet;
export function visitorId(id: string): string;
export const kismet: Kismet;
`;
