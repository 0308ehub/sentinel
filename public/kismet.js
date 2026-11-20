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

  function parsePreview(value) {
    var result = {};
    if (!value || value === "off") return result;
    value.split(",").forEach(function (item) {
      var separator = item.lastIndexOf(":");
      if (separator <= 0) return;
      var flag = item.slice(0, separator).trim();
      var arm = item.slice(separator + 1).trim();
      if (flag && (arm === "control" || arm === "treatment")) result[flag] = arm;
    });
    return result;
  }

  function parseStoredPreview(value, now) {
    if (!value) return null;
    try {
      var stored = JSON.parse(value);
      if (!stored || typeof stored.value !== "string" || typeof stored.at !== "number") return null;
      if (stored.at > now || now - stored.at > 30 * 60 * 1000) return null;
      return stored;
    } catch (e) {
      return null;
    }
  }

  if (root.__KISMET_TEST__) {
    root.__kismetArmFor = armFor;
    root.__kismetParsePreview = parsePreview;
    return;
  }
  if (typeof document === "undefined" || typeof window === "undefined") return;

  var script = document.currentScript;
  if (!script || !script.getAttribute("data-site")) script = document.querySelector("script[data-site][src]");
  var site = script && script.getAttribute("data-site");
  if (!script || !site) return;

  var origin = new URL(script.src, window.location.href).origin;
  if (!origin) return;

  var previewValue = new URL(window.location.href).searchParams.get("kismet_preview");
  var embedded = new URL(window.location.href).searchParams.get("kismet_embed") === "1";
  var preview = {};
  if (!embedded) {
    try {
      var storedPreview = parseStoredPreview(window.sessionStorage.getItem("kismet-preview"), Date.now());
      preview = parsePreview(storedPreview && storedPreview.value);
    } catch (e) {}
  }
  if (!embedded && previewValue === "off") {
    try { window.sessionStorage.removeItem("kismet-preview"); } catch (e) {}
  } else if (previewValue) {
    var requestedPreview = parsePreview(previewValue);
    if (embedded) {
      preview = requestedPreview;
    } else {
      Object.keys(requestedPreview).forEach(function (key) { preview[key] = requestedPreview[key]; });
      try {
        window.sessionStorage.setItem("kismet-preview", JSON.stringify({
          value: Object.keys(preview).map(function (key) { return key + ":" + preview[key]; }).join(","),
          at: Date.now()
        }));
      } catch (e) {}
    }
  }
  var previewing = Object.keys(preview).length > 0;

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
  var automated = false;
  try { automated = navigator.webdriver === true; } catch (e) {}
  var arms = {};
  var queue = [];
  var resolveReady;
  var ready = new Promise(function (resolve) { resolveReady = resolve; });
  var api = {
    visitor: visitor,
    ready: ready,
    variant: function (flag) { return preview[flag] || arms[flag] || "control"; },
    // Waits for the flags so the event carries the experiments this visitor is in.
    track: function (name) {
      if (typeof name !== "string" || !/^[A-Za-z0-9_.:-]{1,80}$/.test(name)) return;
      var page = window.location.pathname;
      ready.then(function () { record("track", page, name); });
    }
  };
  window.kismet = api;

  function record(name, page, element) {
    if (previewing) return;
    // Clicks can happen before the flags arrive. Wait, then stamp the version this person is in.
    ready.then(function () {
      var snapshot = {};
      Object.keys(arms).forEach(function (key) { snapshot[key] = arms[key]; });
      queue.push({ name: name, page: page, element: element, arms: snapshot });
    });
  }

  function view() {
    record("view", window.location.pathname, "");
  }

  function flush() {
    if (!queue.length) return;
    var events = queue.splice(0, 50);
    fetch(origin + "/api/autopilot/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ site: site, visitor: visitor, automated: automated, events: events }),
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
    if (!label) return;
    // Wait for assignment. A click before the flags arrive has no version, so it would never count.
    var page = window.location.pathname;
    ready.then(function () { record("click", page, label); });
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
      Object.keys(preview).forEach(function (key) { arms[key] = preview[key]; });
    })
    .catch(function () {})
    .then(function () {
      resolveReady();
      window.dispatchEvent(new Event("kismet:ready"));
      view();
    });
})(typeof globalThis === "undefined" ? this : globalThis);
