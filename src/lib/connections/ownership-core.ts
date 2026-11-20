export interface SlackOwnershipCandidate {
  userId: string;
  createdAt: string | Date | null;
}

export interface RepoOwnershipCandidate {
  userId: string;
  repo: string;
  createdAt: string | Date | null;
  updatedAt: string | Date | null;
}

function time(value: string | Date | null): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const parsed = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

export function normalizedRepo(repo: string): string {
  return repo.trim().toLowerCase();
}

/** The deployment owner keeps a workspace it is connected to; otherwise the earliest connection wins. */
export function slackOwner(candidates: readonly SlackOwnershipCandidate[], deploymentUserId: string | null = null): string | null {
  if (deploymentUserId && candidates.some((candidate) => candidate.userId === deploymentUserId)) return deploymentUserId;
  return [...candidates]
    .sort((a, b) => time(a.createdAt) - time(b.createdAt) || a.userId.localeCompare(b.userId))[0]?.userId ?? null;
}

export function repositoryOwner(input: {
  repo: string;
  candidates: readonly RepoOwnershipCandidate[];
  deploymentUserId: string | null;
  deploymentRepo: string | null;
}): string | null {
  const target = normalizedRepo(input.repo);
  if (!target) return null;
  if (input.deploymentUserId && input.deploymentRepo && normalizedRepo(input.deploymentRepo) === target) {
    return input.deploymentUserId;
  }
  return input.candidates
    .filter((candidate) => normalizedRepo(candidate.repo) === target)
    .sort((a, b) =>
      time(a.createdAt) - time(b.createdAt)
      || time(a.updatedAt) - time(b.updatedAt)
      || a.userId.localeCompare(b.userId))[0]?.userId ?? null;
}
