export interface EligibleApprover {
  userId: string;
  emails: string[];
}

interface ApprovalInput {
  slackUserId: string;
  installerUserId?: string | null;
  slackEmail?: string | null;
  accountId: string;
  admins: readonly EligibleApprover[];
}

function normalizedEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function canApproveFromSlack(input: ApprovalInput): boolean {
  if (input.installerUserId && input.slackUserId === input.installerUserId) return true;

  const email = input.slackEmail ? normalizedEmail(input.slackEmail) : "";
  if (!email) return false;

  return input.admins.some((admin) =>
    admin.emails.some((candidate) => normalizedEmail(candidate) === email),
  );
}

const RECONNECT_MESSAGE = "To approve from Slack, reconnect Slack in Kismet (Settings → Connectors → Slack) once.";

export function slackApprovalDenialMessage(
  slackEmail: string | null | undefined,
  installerUserId?: string | null,
): string {
  if (slackEmail?.trim()) return "Only Kismet workspace admins can approve from Slack.";
  if (!installerUserId) return RECONNECT_MESSAGE;
  return "To let workspace admins approve from Slack, reconnect Slack in Kismet (Settings → Connectors → Slack) once."
    + ` Until then only <@${installerUserId}> can approve.`;
}
