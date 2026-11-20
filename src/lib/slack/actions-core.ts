export interface SlackActionPayload {
  teamId: string;
  slackUserId: string;
  actionId: string;
  experimentId: string;
  responseUrl: string;
  channelId: string;
  messageTs: string;
}

interface BlockActionEnvelope {
  type?: unknown;
  team?: { id?: unknown };
  user?: { id?: unknown };
  actions?: Array<{ action_id?: unknown; value?: unknown }>;
  response_url?: unknown;
  channel?: { id?: unknown };
  message?: { ts?: unknown };
}

export function reviewActionBlocks(text: string, experimentId: string): unknown[] {
  return [
    { type: "section", text: { type: "mrkdwn", text } },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Approve & merge" },
          style: "primary",
          action_id: "kismet_approve",
          value: experimentId,
          confirm: {
            title: { type: "plain_text", text: "Approve & merge?" },
            text: { type: "mrkdwn", text: "This merges the pull request and ships the change." },
            confirm: { type: "plain_text", text: "Approve & merge" },
            deny: { type: "plain_text", text: "Cancel" },
          },
        },
        {
          type: "button",
          text: { type: "plain_text", text: "Decline" },
          action_id: "kismet_decline",
          value: experimentId,
        },
      ],
    },
  ];
}

export function tryActionBlocks(text: string, signalId: string): unknown[] {
  return [
    { type: "section", text: { type: "mrkdwn", text } },
    {
      type: "actions",
      elements: [{
        type: "button",
        text: { type: "plain_text", text: "Try it now" },
        style: "primary",
        action_id: "kismet_try",
        value: signalId,
      }],
    },
  ];
}

export function startedActionBlocks(text: string, slackUserId: string): unknown[] {
  return [
    { type: "section", text: { type: "mrkdwn", text } },
    { type: "context", elements: [{ type: "mrkdwn", text: `<@${slackUserId}> asked Kismet to try this · designing…` }] },
  ];
}

export function parseActionPayload(body: string): SlackActionPayload | null {
  let envelope: BlockActionEnvelope;
  try {
    const payload = new URLSearchParams(body).get("payload");
    if (!payload) return null;
    envelope = JSON.parse(payload) as BlockActionEnvelope;
  } catch {
    return null;
  }
  const action = envelope.actions?.[0];
  const values = {
    teamId: envelope.team?.id,
    slackUserId: envelope.user?.id,
    actionId: action?.action_id,
    experimentId: action?.value,
    responseUrl: envelope.response_url,
    channelId: envelope.channel?.id,
    messageTs: envelope.message?.ts,
  };
  if (envelope.type !== "block_actions" || Object.values(values).some((value) => typeof value !== "string" || !value)) {
    return null;
  }
  return values as SlackActionPayload;
}

export function handledActionBlocks(text: string, slackUserId: string, action: "approved" | "declined"): unknown[] {
  const status = action === "approved" ? `Approved by <@${slackUserId}> · merging…` : `Declined by <@${slackUserId}>`;
  return [
    { type: "section", text: { type: "mrkdwn", text } },
    { type: "context", elements: [{ type: "mrkdwn", text: status }] },
  ];
}
