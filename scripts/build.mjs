import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

function supported(version) {
  const [major, minor] = version.split(".").map(Number);
  return (major === 20 && minor >= 19) || (major === 22 && minor >= 12) || major >= 24;
}

function findNode() {
  if (supported(process.versions.node)) return process.execPath;

  const nvmRoot = join(homedir(), ".nvm/versions/node");
  if (!existsSync(nvmRoot)) return null;

  const bins = readdirSync(nvmRoot)
    .map((name) => ({ name, bin: join(nvmRoot, name, "bin", "node") }))
    .filter((candidate) => existsSync(candidate.bin))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
    .reverse();

  for (const candidate of bins) {
    const result = spawnSync(candidate.bin, ["-p", "process.versions.node"], {
      encoding: "utf8",
    });
    if (result.status === 0 && supported(result.stdout.trim())) return candidate.bin;
  }

  return null;
}

const node = findNode();
if (!node) {
  console.error(
    `npm run build needs Node 20.19+, 22.12+, or 24+. This shell is on Node ${process.versions.node}.`,
  );
  process.exit(1);
}

if (node !== process.execPath) {
  const version = spawnSync(node, ["-p", "process.versions.node"], { encoding: "utf8" });
  console.log(
    `Using Node ${version.stdout.trim()} for the build. This shell is on Node ${process.versions.node}, which Prisma cannot run.`,
  );
}

const env = {
  ...process.env,
  PATH: `${join(node, "..")}${delimiter}${process.env.PATH ?? ""}`,
};

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, env, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(join(root, "node_modules/.bin/prisma"), ["generate"]);
run(join(root, "node_modules/.bin/next"), ["build"]);
