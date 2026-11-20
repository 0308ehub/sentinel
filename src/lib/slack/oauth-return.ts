// Only plain in-app paths: no scheme, host, backslash, whitespace or control characters,
// which URL parsers strip or reinterpret (e.g. "/\t/evil.com" becomes "//evil.com").
const SAFE_PATH = /^\/(?![/\\])[A-Za-z0-9\-._~/?=&%]*$/;

export const SLACK_TEAM_TAKEN_NOTICE = "This Slack workspace is already connected to another Kismet account. Until shared team workspaces arrive, one account per Slack workspace.";

export function slackOAuthErrorMessage(code: string): string {
  if (code === "not_configured") return "Slack sign-in isn't set up on this server yet.";
  if (code === "slack_team_taken") return SLACK_TEAM_TAKEN_NOTICE;
  return code;
}

export function validOAuthReturnPath(value: string | null | undefined): value is string {
  return typeof value === "string" && value.length <= 200 && SAFE_PATH.test(value);
}
