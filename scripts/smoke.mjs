const baseUrl = (process.argv[2] || "https://app.sentinelai.one").replace(/\/$/, "");
let failed = false;

async function check(name, path, verify) {
  try {
    const response = await fetch(`${baseUrl}${path}`, { redirect: "follow" });
    const result = await verify(response);
    if (result === "skip") {
      console.info(`SKIP ${name}`);
      return;
    }
    if (result !== true) throw new Error(result);
    console.info(`PASS ${name}`);
  } catch (error) {
    failed = true;
    console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function json(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

await check("GET /", "/", (response) => response.status === 200 || `expected 200, got ${response.status}`);
await check("GET /api/health", "/api/health", async (response) => {
  const body = await json(response);
  if (response.status !== 200) return `expected 200, got ${response.status}`;
  return body?.database === "ok" || `expected database ok, got ${body?.database ?? "invalid JSON"}`;
});
await check("GET /api/autopilot/flags", "/api/autopilot/flags", async (response) => {
  const body = await json(response);
  if (response.status !== 200) return `expected 200, got ${response.status}`;
  return Array.isArray(body?.flags) || "expected a flags array";
});
await check("GET /api/workspace/state", "/api/workspace/state", (response) =>
  response.status === 401 || `expected 401, got ${response.status}`,
);
await check("GET /kismet.js", "/kismet.js", (response) => {
  if (response.status === 404) return "skip";
  return response.status === 200 || `expected 200 or 404, got ${response.status}`;
});

process.exitCode = failed ? 1 : 0;
