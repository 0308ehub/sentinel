// One-time setup for Kismet's coding agent (Claude Managed Agents).
//
//   node --env-file=.env.local scripts/setup-coder-agent.mjs
//
// Creates the agent and its sandbox environment the first time and prints their IDs; set them as
// KISMET_CODER_AGENT_ID and KISMET_CODER_ENVIRONMENT_ID (locally and in Vercel). Run it again with those
// set and it updates the agent in place: running sessions keep their version, new sessions get the new one.
// Never call this from a request path.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";

const SYSTEM = `You are Kismet's engineer. Kismet is a product tool; the person talking to you is a product
person or engineer on the team that owns the repository mounted at /workspace/repo.

How you work:
- Answer questions from the actual code. Read before you answer, and cite files as path:line.
- Keep answers short and plain. Say what you checked and what you are unsure about.
- When asked to change code: create a branch named kismet/<short-slug> from the default branch, make the
  smallest change that does the job, match the existing style, and run the project's own checks when they
  exist and finish in a few minutes (look at package.json scripts or the equivalent: tests, lint, build).
  Commit with a clear message and push the branch with git. Never push to the default branch, never
  force-push, never rewrite history.
- Dependencies for this repository are already installed globally. Never run npm ci, npm install, yarn, pnpm,
  or bun install, and never spend a turn downloading packages. If a command cannot resolve a package from
  /workspace/repo, link the global install once with ln -s "$(npm root -g)" /workspace/repo/node_modules
  and continue. That link is not an install.
- When you have pushed a branch, end your final message with a line exactly like:
  BRANCH: kismet/<short-slug>
  Kismet uses that line to offer a pull request.
- Never print, copy or commit secrets, tokens or .env files. Do not try to reach the internet beyond
  package registries.`;

const AGENT = {
  name: "Kismet coder",
  description: "Reads and changes the team's repository from Kismet chat and experiments.",
  model: { id: "claude-opus-5-5", effort: "high" },
  system: SYSTEM,
  tools: [
    {
      type: "agent_toolset_20260401",
      default_config: { enabled: true, permission_policy: { type: "auto" } },
      configs: [
        { name: "web_fetch", enabled: false },
        { name: "web_search", enabled: false },
      ],
    },
  ],
};

const RENDERER_SYSTEM = `You are Kismet's static HTML renderer. The repository is mounted at /workspace/repo.

Render the requested control and treatment page states faithfully and quickly using react-dom/server and the
repository's own CSS toolchain. Never commit, push, or open pull requests. Never print, copy, or use secrets.
Never install or use browsers, Puppeteer, Playwright, or Chromium, and never make screenshots or other images.
Do not run a development server or production build. Write only the requested files under /mnt/session/outputs.
Dependencies are already installed globally. Never run npm ci, npm install, yarn, or pnpm. If /workspace/repo
has no node_modules, link the global install once with ln -s "$(npm root -g)" /workspace/repo/node_modules
and render. Do not try to reach the internet beyond package registries.`;

const RENDERER = {
  name: "Kismet renderer",
  description: "Renders static HTML samples of experiment control and treatment states.",
  model: { id: "claude-sonnet-5-5", effort: "medium" },
  system: RENDERER_SYSTEM,
  tools: AGENT.tools,
};

// Installed into the environment image so a session never downloads them. Versions come from package.json.
// The git checkout replaces /workspace/repo, so the agent links this global root to node_modules instead of npm ci.
const pkg = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../package.json"), "utf8"));

function specs(deps) {
  return Object.entries(deps ?? {}).map(([name, version]) => `${name}@${String(version).replace(/^[\^~]/, "")}`);
}

const EXTRA = ["tsx@4", "esbuild@0.25", "@tailwindcss/cli@4", "postcss@8"];
const NPM_PACKAGES = [...new Set([...specs(pkg.dependencies), ...specs(pkg.devDependencies), ...EXTRA])].sort();

const PACKAGES = { type: "packages", apt: ["git"], npm: NPM_PACKAGES };

const ENVIRONMENT = {
  name: "kismet-coder",
  config: { type: "cloud", networking: { type: "limited", allow_package_managers: true }, packages: PACKAGES },
};

async function main() {
  const client = new Anthropic();
  const agentId = process.env.KISMET_CODER_AGENT_ID?.trim();
  const rendererId = process.env.KISMET_RENDER_AGENT_ID?.trim();
  const environmentId = process.env.KISMET_CODER_ENVIRONMENT_ID?.trim();

  let agent;
  if (agentId) {
    const current = await client.beta.agents.retrieve(agentId);
    agent = await client.beta.agents.update(agentId, { ...AGENT, version: current.version });
    console.log(`Updated agent ${agent.id} -> version ${agent.version}`);
  } else {
    agent = await client.beta.agents.create(AGENT);
    console.log(`Created agent ${agent.id} (version ${agent.version})`);
  }

  let renderer;
  if (rendererId) {
    const current = await client.beta.agents.retrieve(rendererId);
    renderer = await client.beta.agents.update(rendererId, { ...RENDERER, version: current.version });
    console.log(`Updated renderer ${renderer.id} -> version ${renderer.version}`);
  } else {
    renderer = await client.beta.agents.create(RENDERER);
    console.log(`Created renderer ${renderer.id} (version ${renderer.version})`);
  }

  let environment;
  if (environmentId) {
    // Only packages are updated; omitted fields (networking and its allowed hosts) keep their live values.
    environment = await client.beta.environments.update(environmentId, { config: { type: "cloud", packages: PACKAGES } });
    console.log(`Updated environment ${environment.id} packages`);
  } else {
    environment = await client.beta.environments.create(ENVIRONMENT);
    console.log(`Created environment ${environment.id}`);
  }

  console.log(`\nKISMET_CODER_AGENT_ID=${agent.id}\nKISMET_RENDER_AGENT_ID=${renderer.id}\nKISMET_CODER_ENVIRONMENT_ID=${environment.id}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
