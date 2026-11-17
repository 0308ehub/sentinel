(function (root) {
  "use strict";

  function hash(input) {
    var h = 0x811c9dc5;
    for (var i = 0; i < input.length; i += 1) {
      h ^= input.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  function armFor(visitor, flag) {
    if (flag.status === "rolled_out") return "treatment";
    if (flag.status !== "running") return null;
    if (flag.layer) {
      var slot = hash("layer:" + flag.layer + ":" + visitor) % 100;
      if (slot < flag.slotStart || slot >= flag.slotEnd) return null;
    }
    return hash(flag.key + ":" + visitor) % 100 < flag.treatmentPct ? "treatment" : "control";
  }

  if (root.__KISMET_TEST__) {
    root.__kismetArmFor = armFor;
    return;
  }
  if (typeof document === "undefined" || typeof window === "undefined") return;

  var script = document.currentScript;
  if (!script || !script.getAttribute("data-site")) script = document.querySelector("script[data-site][src]");
  var site = script && script.getAttribute("data-site");
  if (!script || !site) return;

  var origin = new URL(script.src, window.location.href).origin;
  if (!origin) return;

  function visitorId() {
    var match = document.cookie.match(/(?:^|; )kismet_vid=([^;]+)/);
    if (match) return decodeURIComponent(match[1]);
    var id = crypto.randomUUID();
    document.cookie = "kismet_vid=" + id + "; path=/; max-age=31536000; samesite=lax";
    return id;
  }

  function labelFor(target) {
    var el = target.closest("[data-track], button, a, [role='button'], [role='menuitem'], [role='option']");
    if (!el) return null;
    var label = el.getAttribute("data-track") || el.getAttribute("aria-label") || (el.textContent || "").replace(/\s+/g, " ").trim();
    return label ? label.slice(0, 80) : null;
  }

  var visitor = visitorId();
  var arms = {};
  var queue = [];
  var resolveReady;
  var ready = new Promise(function (resolve) { resolveReady = resolve; });
  var api = {
    visitor: visitor,
    ready: ready,
    variant: function (flag) { return arms[flag] || "control"; }
  };
  window.kismet = api;

  function record(name, page, element) {
    var snapshot = {};
    Object.keys(arms).forEach(function (key) { snapshot[key] = arms[key]; });
    queue.push({ name: name, page: page, element: element, arms: snapshot });
  }

  function view() {
    var page = window.location.pathname;
    ready.then(function () { record("view", page, ""); });
  }

  function flush() {
    if (!queue.length) return;
    var events = queue.splice(0, 50);
    fetch(origin + "/api/autopilot/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ site: site, visitor: visitor, events: events }),
      keepalive: true
    }).catch(function () {});
  }

  function wrapHistory(name) {
    var original = history[name];
    history[name] = function () {
      var result = original.apply(this, arguments);
      view();
      return result;
    };
  }

  document.addEventListener("click", function (event) {
    if (!(event.target instanceof Element)) return;
    var label = labelFor(event.target);
    if (label) record("click", window.location.pathname, label);
  }, true);
  wrapHistory("pushState");
  wrapHistory("replaceState");
  window.addEventListener("popstate", view);
  window.addEventListener("pagehide", flush);
  setInterval(flush, 4000);

  fetch(origin + "/api/autopilot/flags?site=" + encodeURIComponent(site), { cache: "no-store" })
    .then(function (response) { return response.ok ? response.json() : { flags: [] }; })
    .then(function (body) {
      (Array.isArray(body.flags) ? body.flags : []).forEach(function (flag) {
        var arm = armFor(visitor, flag);
        if (arm) arms[flag.key] = arm;
      });
    })
    .catch(function () {})
    .then(function () {
      resolveReady();
      window.dispatchEvent(new Event("kismet:ready"));
      view();
    });
})(typeof globalThis === "undefined" ? this : globalThis);
