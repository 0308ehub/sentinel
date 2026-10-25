import "server-only";

import { readdir, readFile as readLocal } from "node:fs/promises";
import path from "node:path";
import { isUiPath, listUiFiles, rankUiPath, readFile, repoDefaultBranch, type GitHubFile } from "@/lib/github/client";
import { autopilotRepo } from "@/lib/autopilot/repo";

// Where Autopilot reads the product's code: GitHub normally, or a local checkout
// (AUTOPILOT_LOCAL_REPO) so the loop can be tested without touching GitHub at all.

const MAX_FILE_BYTES = 24_000;
const SKIP = new Set(["node_modules", ".next", ".git", ".vercel"]);

function localRoot(): string | null {
  return process.env.AUTOPILOT_LOCAL_REPO?.trim() || null;
}

export function sourceLabel(): string {
  return localRoot() ? "your local code" : autopilotRepo();
}

async function walk(root: string, dir = ""): Promise<string[]> {
  const entries = await readdir(path.join(root, dir), { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (SKIP.has(entry.name)) continue;
    const rel = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...(await walk(root, rel)));
    else if (isUiPath(rel)) files.push(rel);
  }
  return files;
}

export async function baseBranch(): Promise<string> {
  return localRoot() ? "local" : repoDefaultBranch(autopilotRepo());
}

export async function listSourceFiles(base: string, limit: number): Promise<string[]> {
  const root = localRoot();
  if (!root) return listUiFiles(autopilotRepo(), base, limit);
  const files = await walk(root);
  files.sort((a, b) => rankUiPath(a) - rankUiPath(b) || a.length - b.length);
  return files.slice(0, limit);
}

export async function readSourceFile(file: string, base: string): Promise<GitHubFile | null> {
  const root = localRoot();
  if (!root) return readFile(autopilotRepo(), file, base);
  if (!isUiPath(file)) return null;
  const content = await readLocal(path.join(root, file), "utf8").catch(() => null);
  if (content === null || Buffer.byteLength(content) > MAX_FILE_BYTES) return null;
  return { path: file, content, sha: "local" };
}

export function isLocalSource(): boolean {
  return localRoot() !== null;
}
