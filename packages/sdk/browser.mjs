// Kismet in the browser. Loads the Kismet script once and returns the same API as window.kismet.
const DEFAULT_HOST = "https://app.sentinelai.one";
let loading = null;

function readyKismet() {
  return window.kismet.ready.then(() => window.kismet);
}

export function loadKismet(options) {
  if (typeof window === "undefined" || typeof document === "undefined") return Promise.resolve(null);
  if (window.kismet) return readyKismet();
  if (loading) return loading;
  const site = options && options.site;
  if (!site) return Promise.reject(new Error('Kismet needs your site key: loadKismet({ site: "..." }).'));
  const host = ((options && options.host) || DEFAULT_HOST).replace(/\/$/, "");
  loading = new Promise((resolve) => {
    const existing = document.querySelector("script[data-site][src]");
    if (existing) {
      window.addEventListener("kismet:ready", () => resolve(window.kismet || null), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = host + "/kismet.js";
    script.async = true;
    script.setAttribute("data-site", site);
    script.onload = () => (window.kismet ? readyKismet().then(resolve) : resolve(null));
    script.onerror = () => {
      loading = null;
      resolve(null);
    };
    document.head.appendChild(script);
  });
  return loading;
}

// "treatment" or "control". Returns "control" until loadKismet has finished.
export function variant(flag) {
  return typeof window !== "undefined" && window.kismet ? window.kismet.variant(flag) : "control";
}

// Reports a business event, such as "purchase". Events sent before the script loads wait for it.
export function track(name) {
  if (typeof window === "undefined") return;
  if (window.kismet) return window.kismet.track(name);
  if (loading) loading.then((kismet) => kismet && kismet.track(name));
}
