export class GitHubApiError extends Error {
  constructor(
    public code: string,
    public hint?: string,
    public status = 502,
  ) {
    super(code);
  }
}
