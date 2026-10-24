export interface GitHubRepo {
  id: string;
  fullName: string;
  url: string;
  description: string;
  defaultBranch: string;
}

export const MOCK_REPOS: GitHubRepo[] = [];

export const PRODUCT_DEFAULT_REPO = "";

export function findRepo(fullNameOrUrl: string): GitHubRepo | undefined {
  const normalized = fullNameOrUrl.trim().toLowerCase();
  return MOCK_REPOS.find(
    (r) =>
      r.fullName.toLowerCase() === normalized ||
      r.url.toLowerCase() === normalized ||
      r.url.toLowerCase().replace("https://github.com/", "") === normalized
  );
}

export function parseCustomRepo(input: string): { fullName: string; url: string } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("https://github.com/")) {
    const fullName = trimmed.replace("https://github.com/", "").replace(/\/$/, "");
    if (fullName.includes("/")) return { fullName, url: trimmed };
    return null;
  }

  if (/^[\w.-]+\/[\w.-]+$/.test(trimmed)) {
    return { fullName: trimmed, url: `https://github.com/${trimmed}` };
  }

  return null;
}
