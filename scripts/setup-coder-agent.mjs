// One-time setup for Kismet's coding agent (Claude Managed Agents).
//
//   node --env-file=.env.local scripts/setup-coder-agent.mjs
//
// Creates the agent and its sandbox environment the first time and prints their IDs; set them as
// KISMET_CODER_AGENT_ID and KISMET_CODER_ENVIRONMENT_ID (locally and in Vercel). Run it again with those
// set and it updates the agent in place: running sessions keep their version, new sessions get the new one.
// Never call this from a request path.
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

const ENVIRONMENT = {
  name: "kismet-coder",
  config: { type: "cloud", networking: { type: "limited", allow_package_managers: true } },
};

async function main() {
  const client = new Anthropic();
  const agentId = process.env.KISMET_CODER_AGENT_ID?.trim();
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

  let environment;
  if (environmentId) {
    environment = await client.beta.environments.retrieve(environmentId);
    console.log(`Using environment ${environment.id}`);
  } else {
    environment = await client.beta.environments.create(ENVIRONMENT);
    console.log(`Created environment ${environment.id}`);
  }

  console.log(`\nKISMET_CODER_AGENT_ID=${agent.id}\nKISMET_CODER_ENVIRONMENT_ID=${environment.id}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
